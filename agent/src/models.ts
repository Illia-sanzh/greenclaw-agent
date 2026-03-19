import { log, DEFAULT_MODEL } from "./config";
import { state } from "./state";
import { client } from "./http";
import { ROUTER_MODEL, TASK_PROFILES, DEFAULT_PROFILE, effortBody } from "./profiles";
import type { TaskProfile } from "./types";

export async function probeModels(): Promise<void> {
  if (state.modelsProbed) return;
  state.modelsProbed = true;

  const candidates = [
    ROUTER_MODEL,
    DEFAULT_MODEL,
    process.env.FALLBACK_MODEL ?? "gpt-5.4-mini",
    process.env.OR_FALLBACK_MODEL ?? "openrouter/gpt-5.4-mini",
    "gemini-2.5-flash",
    "openrouter/gemini-2.5-flash",
    "deepseek-chat",
    "openrouter/deepseek-chat",
  ].filter(Boolean);
  const unique = [...new Set(candidates)];

  log.info(`[probe] Testing ${unique.length} model(s): ${unique.join(", ")}`);

  await Promise.allSettled(
    unique.map(async (m) => {
      try {
        await client.chat.completions.create({
          model: m,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
        });
        state.availableModels.add(m);
        log.info(`[probe] ✓ ${m}`);
      } catch (e: any) {
        const msg = String(e?.message ?? e).slice(0, 120);
        if (msg.includes("timeout") || msg.includes("429") || msg.includes("max_tokens")) {
          state.availableModels.add(m);
          log.info(`[probe] ~ ${m} (transient: ${msg})`);
        } else {
          log.info(`[probe] ✗ ${m} (${msg})`);
        }
      }
    }),
  );

  log.info(`[probe] Available models: ${[...state.availableModels].join(", ") || "(none)"}`);
}

export function pickAvailableModel(...prefs: string[]): string {
  for (const m of prefs) {
    if (state.availableModels.has(m)) return m;
  }
  return prefs[0] ?? DEFAULT_MODEL;
}

export async function routeTask(
  message: string,
  history: Array<{ role: string; content: string }> = [],
  lastProfile?: string,
): Promise<TaskProfile> {
  const routerPrompt = `You are a task router. Given a user message, classify it into exactly one category.
Categories:
- forum_reply: replying to a forum post or comment, answering a question from a forum user
- inbound_notify: event that only needs to be forwarded (votes, priority changes, type changes) — no AI response needed
- bug_fix: investigating a bug report, searching code in GitHub, creating a fix, submitting a pull request
- wp_admin: WordPress admin tasks (plugin management, user management, settings, content CRUD, database queries, site maintenance). Also small plugin fixes: changing a URL, fixing a bug, tweaking a value, editing a single file.
- scheduling: scheduling tasks for the future, cron jobs, reminders
- greenshift: creating or editing Greenshift/GreenLight blocks, converting HTML to Greenshift block format, working with the Greenshift page builder or its element blocks
- web_design: creating or modifying web pages, HTML/CSS, designing layouts, replicating designs (NOT Greenshift-specific — use greenshift for that)
- plugin_dev: creating NEW WordPress plugins from scratch, or MAJOR rewrites (adding multiple features, restructuring, building multi-file plugins). NOT for small edits or quick fixes — use wp_admin for those.
- general: anything that doesn't fit above, or complex multi-domain tasks

IMPORTANT — follow-up detection:
If the conversation history shows the user was just working on a design/content task (web_design, greenshift, plugin_dev) and the new message is a follow-up like "change X", "make it Y", "update the Z", "fix the colors", "add a section", keep the SAME category as the previous task. Short modification requests after a creative task are continuations, not new tasks.
${lastProfile ? `The previous task used the "${lastProfile}" profile.` : ""}

Respond with ONLY the category name, nothing else.`;

  const routerModel = pickAvailableModel(ROUTER_MODEL, "openrouter/gpt-5.4-mini", DEFAULT_MODEL);

  // Include last 2 history entries for follow-up detection
  const contextMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: routerPrompt },
  ];
  const recentHistory = history.slice(-2);
  for (const h of recentHistory) {
    const role = h.role === "assistant" ? "assistant" : "user";
    contextMessages.push({ role, content: h.content.slice(0, 300) });
  }
  contextMessages.push({ role: "user", content: message.slice(0, 500) });

  try {
    const resp = await client.chat.completions.create({
      model: routerModel,
      messages: contextMessages,
      max_tokens: 20,
      temperature: 0,
      ...effortBody(routerModel, "low"),
    });
    const category = (resp.choices?.[0]?.message?.content ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z_]/g, "");
    if (TASK_PROFILES[category]) {
      log.info(`[router] Classified as: ${category} (via ${routerModel})`);
      return TASK_PROFILES[category];
    }
    log.info(`[router] Unknown category "${category}", using general`);
    return DEFAULT_PROFILE;
  } catch (e) {
    log.warn(`[router] Router call failed (${e}), using general profile`);
    return DEFAULT_PROFILE;
  }
}

export function routeInboundEvent(event: string, autoRespond: boolean, metadata?: any): TaskProfile {
  if (!autoRespond) return TASK_PROFILES.inbound_notify;
  if (event === "new_topic" || event === "new_comment") {
    const topicType = (metadata?.type ?? "").toLowerCase();
    if (topicType === "bug") return TASK_PROFILES.inbound_notify;
    return TASK_PROFILES.forum_reply;
  }
  return TASK_PROFILES.inbound_notify;
}
