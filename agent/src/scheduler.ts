import Database from "better-sqlite3";
import schedule from "node-schedule";
import { log, SCHEDULE_DB, DEFAULT_MODEL } from "./config";
import { notifyTelegram } from "./notify";
import { logAudit } from "./audit";
import { DEFAULT_PROFILE } from "./profiles";
import type { StoredJob, TaskProfile } from "./types";

export class PersistentScheduler {
  private db: Database.Database;
  private activeJobs = new Map<string, schedule.Job>();

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        task       TEXT NOT NULL,
        cron_expr  TEXT,
        run_at     TEXT,
        created_at TEXT NOT NULL
      )
    `);
  }

  start(): void {
    const rows = this.db.prepare("SELECT * FROM scheduled_jobs").all() as StoredJob[];
    // Deduplicate by cron_expr AND by similar task name (normalized)
    const seen = new Map<string, StoredJob>();
    const dupes: string[] = [];
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z]+/g, " ")
        .trim();
    for (const row of rows) {
      if (!row.cron_expr) {
        this._register(row);
        continue;
      }
      // Dedup by cron OR by similar name (catches dupes with different cron times)
      const cronKey = `cron:${row.cron_expr}`;
      const nameKey = `name:${normalize(row.name)}`;
      const existingByCron = seen.get(cronKey);
      const existingByName = seen.get(nameKey);
      const existing = existingByCron ?? existingByName;
      if (existing) {
        const keepExisting = (existing.created_at ?? "") >= (row.created_at ?? "");
        const dupe = keepExisting ? row : existing;
        const keeper = keepExisting ? existing : row;
        dupes.push(dupe.id);
        this._removeFromDb(dupe.id);
        seen.set(cronKey, keeper);
        seen.set(nameKey, keeper);
      } else {
        seen.set(cronKey, row);
        seen.set(nameKey, row);
      }
    }
    // Collect unique jobs (values may appear under both keys)
    const uniqueJobs = new Map<string, StoredJob>();
    for (const job of seen.values()) uniqueJobs.set(job.id, job);
    for (const job of uniqueJobs.values()) this._register(job);
    if (dupes.length > 0) log.info(`[scheduler] Removed ${dupes.length} duplicate job(s)`);
    log.info(`[scheduler] Loaded ${uniqueJobs.size} job(s) from DB`);
  }

  private _register(job: StoredJob): void {
    if (job.cron_expr) {
      const nodeJob = schedule.scheduleJob(job.id, job.cron_expr, async () => {
        await executeScheduledTask(job.name, job.task);
      });
      if (nodeJob) this.activeJobs.set(job.id, nodeJob);
    } else if (job.run_at) {
      const dt = new Date(job.run_at);
      if (dt > new Date()) {
        const nodeJob = schedule.scheduleJob(job.id, dt, async () => {
          await executeScheduledTask(job.name, job.task);
          this._removeFromDb(job.id);
          this.activeJobs.delete(job.id);
        });
        if (nodeJob) this.activeJobs.set(job.id, nodeJob);
      } else {
        this._removeFromDb(job.id);
      }
    }
  }

  addJob(id: string, name: string, task: string, cronExpr?: string, runAt?: Date): { nextRun: string } {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO scheduled_jobs (id, name, task, cron_expr, run_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, name, task, cronExpr ?? null, runAt?.toISOString() ?? null, new Date().toISOString());

    this._register({
      id,
      name,
      task,
      cron_expr: cronExpr ?? null,
      run_at: runAt?.toISOString() ?? null,
      created_at: new Date().toISOString(),
    });

    const activeJob = this.activeJobs.get(id);
    const nextRunDt = activeJob?.nextInvocation() as Date | undefined;
    const nextRun = nextRunDt ? nextRunDt.toISOString().replace("T", " ").slice(0, 16) + " UTC" : "N/A";
    return { nextRun };
  }

  removeJob(id: string): void {
    const job = this.activeJobs.get(id);
    if (job) {
      job.cancel();
      this.activeJobs.delete(id);
    }
    this._removeFromDb(id);
  }

  private _removeFromDb(id: string): void {
    this.db.prepare("DELETE FROM scheduled_jobs WHERE id = ?").run(id);
  }

  getJobs(): Array<{ id: string; name: string; next_run: string; trigger: string }> {
    const rows = this.db.prepare("SELECT * FROM scheduled_jobs").all() as StoredJob[];
    return rows.map((row) => {
      const activeJob = this.activeJobs.get(row.id);
      const nextRunDt = activeJob?.nextInvocation() as Date | undefined;
      return {
        id: row.id,
        name: row.name,
        next_run: nextRunDt ? nextRunDt.toISOString().replace("T", " ").slice(0, 16) + " UTC" : "N/A",
        trigger: row.cron_expr ? `cron: ${row.cron_expr}` : `date: ${row.run_at}`,
      };
    });
  }

  get jobCount(): number {
    return (this.db.prepare("SELECT COUNT(*) AS c FROM scheduled_jobs").get() as { c: number }).c;
  }

  get running(): boolean {
    return true;
  }

  close(): void {
    for (const job of this.activeJobs.values()) job.cancel();
    this.activeJobs.clear();
    this.db.close();
  }
}

// Dynamic import to break scheduler → agent-loop circular dependency
async function executeScheduledTask(taskLabel: string, taskText: string): Promise<void> {
  log.info(`[scheduler] Running: ${taskLabel}`);
  let resultText = "(no result)";
  let elapsed = 0;
  try {
    const { runAgent } = await import("./agent-loop");
    // Exclude schedule_task to prevent recursive scheduling
    const schedulerProfile: TaskProfile = {
      ...DEFAULT_PROFILE,
      name: "scheduler",
      excludeTools: ["schedule_task"],
    };
    const prefixedTask = `[SCHEDULED TASK — do NOT create new scheduled tasks, just execute the work]\n${taskText}`;
    for await (const event of runAgent(prefixedTask, undefined, [], schedulerProfile)) {
      if (event.type === "result") {
        resultText = event.text ?? "(no result)";
        elapsed = event.elapsed ?? 0;
      }
    }
  } catch (e) {
    resultText = `❌ Scheduled task error: ${e}`;
    log.error({ err: e, task: taskLabel }, "scheduled task error");
    await notifyTelegram(`❌ *Scheduled task failed:* _${taskLabel}_\n\n${e}`);
    logAudit({
      source: "scheduler",
      message: taskLabel,
      model: DEFAULT_MODEL,
      status: "error",
      result: String(e),
      elapsed_ms: elapsed * 1000,
    });
    return;
  }
  log.info(`[scheduler] Done: ${taskLabel} in ${elapsed}s`);
  logAudit({
    source: "scheduler",
    message: taskLabel,
    model: DEFAULT_MODEL,
    status: "ok",
    result: resultText,
    elapsed_ms: elapsed * 1000,
  });
  await notifyTelegram(`⏰ *Scheduled task complete:* _${taskLabel}_\n\n${resultText}`);
}

export function createScheduler(): PersistentScheduler {
  try {
    return new PersistentScheduler(SCHEDULE_DB);
  } catch (e) {
    log.warn(`[scheduler] SQLite job store failed (${e}). Using in-memory store.`);
    return new PersistentScheduler(":memory:");
  }
}
