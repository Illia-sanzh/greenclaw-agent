import type OpenAI from "openai";
import { SITE_MODE } from "./config";

const BASE_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Run a bash command on the agent server. " +
        "Use this for WP-CLI commands (wp --path=/wordpress --allow-root ...), " +
        "file operations, and server-side tasks. Output is limited to 8000 characters.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The bash command to execute." },
          reason: {
            type: "string",
            description: "One short sentence describing what this step does in plain English, shown to the user.",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_rest",
      description:
        "Call the WordPress REST API. " +
        "Use for reading/writing posts, pages, media, users, settings, plugins, etc. " +
        "Works for both local and remote WordPress installations.",
      parameters: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], description: "HTTP method." },
          endpoint: { type: "string", description: "REST API endpoint path, e.g. /wp/v2/posts or /wc/v3/products" },
          body: { type: "object", description: "Request body as JSON object (for POST/PUT/PATCH)." },
          params: { type: "object", description: "Query string parameters as key-value pairs." },
          reason: {
            type: "string",
            description: "One short sentence describing what this step does in plain English.",
          },
        },
        required: ["method", "endpoint"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wp_cli_remote",
      description:
        "Run a WP-CLI command on a remote WordPress site via the GreenClaw bridge plugin. " +
        "Use when WordPress is hosted on a different server. " +
        "Provide the WP-CLI command WITHOUT the 'wp' prefix.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "WP-CLI command without the 'wp' prefix. E.g.: 'plugin list --format=json'",
          },
          reason: {
            type: "string",
            description: "One short sentence describing what this step does in plain English.",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_task",
      description:
        "Schedule a WordPress management task to run at a specific future time or on a " +
        "recurring schedule. Use this when the user says things like 'at 5pm', " +
        "'every Monday', 'publish tomorrow', 'weekly backup', etc.",
      parameters: {
        type: "object",
        properties: {
          task: { type: "string", description: "Full plain-English description of what to do." },
          run_at: { type: "string", description: "ISO 8601 UTC datetime for a one-time task. Omit if using cron." },
          cron: { type: "string", description: "5-part cron for recurring tasks. Omit if using run_at." },
          label: { type: "string", description: "Short human-readable name shown in /tasks list." },
          reason: { type: "string", description: "One short sentence describing what this step does." },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file. Use this to inspect plugin/theme PHP code before modifying it. " +
        "Reads from: WordPress directory, /tmp/, /app/config/, /app/data/.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute file path, e.g. /wordpress/wp-content/plugins/myplugin/myplugin.php",
          },
          reason: { type: "string", description: "One short sentence describing why you're reading this file." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write content to a file on the agent server. Use this to create or modify HTML, CSS, PHP, " +
        "or any text files. PREFERRED over run_command with cat/heredoc for writing files — " +
        "especially large HTML files. You can call this multiple times with append=true " +
        "to build up a file in chunks. " +
        "Allowed paths: /tmp/, /app/data/, WordPress plugins/themes/mu-plugins directories.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Absolute file path. Allowed: /tmp/*, /wordpress/wp-content/plugins/*, /wordpress/wp-content/themes/*, /wordpress/wp-content/mu-plugins/*",
          },
          content: { type: "string", description: "The text content to write to the file." },
          append: {
            type: "boolean",
            description: "If true, append to the file instead of overwriting. Default: false.",
          },
          reason: { type: "string", description: "One short sentence describing what this step does." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reply_to_forum",
      description:
        "Post a reply (comment) to a forum topic on the WordPress site. " +
        "Use this when responding to forum messages received via the /inbound channel. " +
        "Requires the post_id of the topic to reply to.",
      parameters: {
        type: "object",
        properties: {
          post_id: { type: "number", description: "The WordPress post ID of the forum topic to reply to." },
          content: { type: "string", description: "The reply content (plain text or HTML)." },
          reason: { type: "string", description: "One short sentence describing what this step does." },
        },
        required: ["post_id", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_page",
      description:
        "Fetch a web page and return its cleaned HTML content (scripts, SVGs, iframes, " +
        "base64 data stripped). Use this to study the design/layout of any public website. " +
        "Returns cleaned HTML truncated to 20000 chars.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full URL to fetch, e.g. https://nytimes.com" },
          reason: { type: "string", description: "One short sentence describing why you're fetching this page." },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the internet for information. Returns titles, URLs, and snippets from multiple search engines. " +
        "Use this to look up WordPress APIs, plugin documentation, PHP functions, or any other reference material.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
          max_results: {
            type: "number",
            description: "Max results to return (default 5, max 20).",
          },
          reason: { type: "string", description: "One short sentence describing why you're searching." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_agent_memory",
      description:
        "Update the agent's persistent memory file at /app/data/AGENT.md. Use this when the user says things like " +
        "'remember that...', 'don't do X again', 'always do Y', 'from now on...'. " +
        "The memory persists across conversations so the agent learns from past mistakes. " +
        "Pass the FULL updated content — this replaces the entire file. " +
        "IMPORTANT: First use read_file on /app/data/AGENT.md to get existing entries, then include them in the new content.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description:
              "The full markdown content to write to AGENT.md. Must include all existing entries plus new ones.",
          },
          reason: { type: "string", description: "One short sentence describing what memory is being saved." },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "screenshot",
      description:
        "Take a screenshot of a web page using a headless browser. Returns the screenshot uploaded to WordPress media library. " +
        "Use this to visually verify how a page looks after making changes, or to capture a reference design.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full URL to screenshot, e.g. https://example.com" },
          full_page: {
            type: "boolean",
            description: "Capture full scrollable page (default false, captures viewport only).",
          },
          reason: { type: "string", description: "One short sentence describing why you're taking this screenshot." },
        },
        required: ["url"],
      },
    },
  },
];

const ASTRO_TOOL_DEFS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "git_operations",
      description:
        "Perform git operations in the Astro project. Use this to stage changes, commit, " +
        "push to deploy (Cloudflare Pages), pull updates, or check status/diff.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["status", "add", "commit", "push", "pull", "diff"],
            description: "Git operation to perform.",
          },
          message: { type: "string", description: "Commit message (required for 'commit' action)." },
          files: {
            type: "string",
            description: "Space-separated file paths for 'add'. If omitted, stages all changes.",
          },
          reason: { type: "string", description: "One short sentence describing what this step does." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "convert_document",
      description:
        "Convert a document (.docx, .pdf) to Astro-compatible markdown. " +
        "Extracts text and images, generates frontmatter, and saves to the content collection. " +
        "Images are placed in src/assets/<output_name>/.",
      parameters: {
        type: "object",
        properties: {
          input_path: {
            type: "string",
            description: "Path to the uploaded document file (usually in /tmp/).",
          },
          output_name: {
            type: "string",
            description: "Target filename without extension (becomes src/content/blog/<output_name>.md).",
          },
          reason: { type: "string", description: "One short sentence describing what this step does." },
        },
        required: ["input_path", "output_name"],
      },
    },
  },
];

const WP_ONLY_TOOLS = new Set(["wp_rest", "wp_cli_remote", "reply_to_forum"]);
const ASTRO_ONLY_TOOLS = new Set(["git_operations", "convert_document"]);

export const TOOLS: OpenAI.Chat.ChatCompletionTool[] =
  SITE_MODE === "astro"
    ? BASE_TOOLS.filter((t) => !WP_ONLY_TOOLS.has(t.function.name)).concat(ASTRO_TOOL_DEFS)
    : BASE_TOOLS.filter((t) => !ASTRO_ONLY_TOOLS.has(t.function.name));
