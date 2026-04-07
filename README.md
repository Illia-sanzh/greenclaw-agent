# Greenclaw Agent

Manage your WordPress or Astro site by texting a Telegram bot. Write what you want in plain English, send a photo, or speak a voice note — the AI agent figures out the rest.

**WordPress mode:**
```
You: "Create a landing page that looks like stripe.com with a dark hero section"
Agent: 🌍 Fetching stripe.com layout...
       📝 Writing HTML with animations...
       🔌 Converting to Greenshift blocks...
       🖥 Inserting into WordPress...
       📸 Taking screenshot...
       ✅ Published "Landing Page" — here's how it looks:
       [screenshot]
```

**Astro mode:**
```
You: "Write a blog post about the new product launch, here's the draft doc"
Agent: 📄 Converting document to markdown...
       🖼 Extracting images to src/assets/...
       ✍️  Writing content collection entry...
       📦 Committing and pushing to main...
       ✅ Post published — Cloudflare Workers will deploy in ~30s
```

## How It Works

Eight Docker containers on an isolated network. Only the proxy touches the internet.

```
Telegram → Bot → Agent → LiteLLM → Squid → AI APIs
                   │
                   ├── WP-CLI / REST API → WordPress
                   ├── Git operations  → Astro project
                   ├── SearXNG → Web search
                   ├── Browserless → Screenshots
                   ├── MCP Runner → GitHub, etc.
                   └── Custom skills (YAML/JS/Markdown)
```

| Container | What it does |
|-----------|-------------|
| **bot** | Telegram interface (grammY) — messages, photos, voice, progress streaming |
| **agent** | Express API — agentic LLM loop, tool execution, task scheduling |
| **litellm** | Model proxy — routes to any provider, budget caps, prompt caching |
| **squid** | Egress proxy — SSRF protection, blocks private IP ranges |
| **mcp-runner** | Sandboxed MCP tool servers (GitHub, etc.) |
| **searxng** | Self-hosted metasearch — no API keys needed |
| **browser** | Headless Chrome — screenshots and page rendering |
| **relay** | Socat bridge — connects internal network to host (WordPress mode only) |

## Site Modes

Set `SITE_MODE` in `.env` to switch the entire agent between two modes.

### WordPress mode (default)

Full WordPress management via WP-CLI and REST API. Posts, plugins, users, themes, settings, WooCommerce, design replication, plugin development, bug fix pipeline. See [Features](#features) for the full list.

### Astro mode

Manages a static Astro site that deploys to Cloudflare Workers.

- Create and edit blog posts as Markdown content collection entries
- Import `.docx` and `.pdf` documents — converted to Markdown with images extracted
- Edit `.astro` components, layouts, and styles
- Commit and push changes via git (auto-generated SSH deploy key)
- Run build commands (`npm run build`, `npx wrangler deploy`)

Switch the stack to Astro mode by combining the overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.astro.yml up -d
```

The Ansible installer handles this automatically when you choose Astro during setup.

## Install

### Ansible (recommended for production)

```bash
git clone https://github.com/Illia-sanzh/greenclaw-agent.git
cd greenclaw-agent/ansible
cp inventory.example.yml inventory.yml            # set your server IP
cp group_vars/all.example.yml group_vars/all.yml  # fill in API keys, tokens, etc.
ansible-playbook -i inventory.yml install.yml
```

Idempotent — safe to run multiple times. Handles Docker, WordPress or Astro setup, firewall, secret generation, bridge plugin, health check, and SSH deploy key (Astro mode). Works on any Ubuntu 24.04 VPS.

### Bash installer (quick local testing)

```bash
git clone https://github.com/Illia-sanzh/greenclaw-agent.git
cd greenclaw-agent
sudo bash install.sh
```

Interactive single-command setup. Fine for local testing but not idempotent — use Ansible for any real deployment.

### Manual

Copy `.env.template` to `.env`, fill in your keys, and run `docker compose up -d`.

## Uninstall

```bash
# Remove agent stack only (keeps WordPress, Nginx, PHP, MariaDB, Docker)
ansible-playbook -i ansible/inventory.yml ansible/uninstall.yml

# Full removal (adds WordPress, system packages, and Docker)
ansible-playbook -i ansible/inventory.yml ansible/uninstall.yml -e remove_all=true
```

## Features

### Content & Site Management
Create posts, manage plugins, handle users, configure settings — anything you'd do in wp-admin.

### Web Design
Send a URL and the agent replicates its design as WordPress content. Supports Greenshift block conversion, CSS animations, dark/light sections, responsive layouts. Takes screenshots to verify the result.

### Plugin Development
Describe a plugin and the agent scaffolds, writes, and activates it. Checks code against WordPress security standards (sanitization, escaping, nonces, capabilities).

### Astro Content & Components
In Astro mode: create posts from scratch or import documents, edit components and layouts, manage assets. All changes committed and pushed via git automatically.

### Scheduling
"Update all plugins every Monday at 3am UTC" — the agent sets up persistent cron jobs that survive container restarts.

### Custom Skills
Extend the agent with YAML tools, markdown knowledge docs, or JS scripts. Install from GitHub repos or create interactively with `/skill`.

### Bug Fix Pipeline
Forum post marked as bug → Telegram notification with "Fix this" button → agent searches GitHub, creates a fix branch, opens a PR, replies on the forum. Requires GitHub MCP (`/mcp install server-github`).

### Web Search & Screenshots
SearXNG provides search without API keys. Browserless Chrome takes screenshots for visual verification and design reference.

### Voice & Photos
Send voice notes (transcribed via Whisper) or photos (uploaded to WordPress media library, or used as context for tasks). Multi-photo albums supported.

### Agent Memory
Tell the bot "remember to always use Greenshift blocks" and it saves to a persistent AGENT.md file. The agent reads this on every request so it learns from past mistakes and follows your preferences.

### MCP Tools
Install MCP servers on the fly with `/mcp install <package>`. GitHub MCP enables the bug fix pipeline. Any MCP-compatible tool server works.

## AI Models

Works with any combination of providers. The agent probes each model on startup and only uses ones with valid keys.

| Provider | Models | Env var |
|----------|--------|---------|
| Anthropic | Sonnet 4.6, Opus 4.6 | `ANTHROPIC_API_KEY` |
| OpenAI | GPT-5.4 Mini | `OPENAI_API_KEY` |
| DeepSeek | Chat, Reasoner | `DEEPSEEK_API_KEY` |
| Google | Gemini 2.5 Flash/Pro | `GEMINI_API_KEY` |
| OpenRouter | All of the above + Llama, Mistral, Qwen, etc. | `OPENROUTER_API_KEY` |

Smart routing (`/model auto`) picks the right model per task — cheap for simple lookups, capable for complex work. Cross-provider fallback means if one provider is down, the agent tries another automatically.

## Bot Commands

| Command | What it does |
|---------|-------------|
| `/model` | Show or switch AI model (`/model auto` for smart routing) |
| `/status` | Agent health, loaded skills, active site mode |
| `/tasks` | List/cancel scheduled tasks |
| `/skill` | Manage skills — list, create, delete, install from GitHub |
| `/mcp` | Install and manage MCP tool servers |
| `/stats` | Usage stats — tasks by profile, model, errors |
| `/stop` | Abort current request |
| `/cancel` | Clear conversation history and stop everything |

## Task Profiles

The agent automatically classifies each request and picks the right tool set.

**WordPress mode:**

| Profile | When | Tools |
|---------|------|-------|
| **wp_admin** | Plugin/user/settings management, small fixes | WP-CLI, REST API, file read/write |
| **web_design** | Page creation, layout design, CSS | All creative tools + screenshot + skills |
| **greenshift** | Greenshift/GreenLight block work | Block converter, design skills |
| **plugin_dev** | Building new plugins from scratch | Full dev toolset + security standards |
| **bug_fix** | GitHub bug investigation and PR creation | GitHub MCP + file tools |
| **scheduling** | Cron jobs, timed tasks | Scheduler + basics |
| **general** | Everything else | All tools |

**Astro mode:**

| Profile | When | Tools |
|---------|------|-------|
| **astro_content** | Posts, markdown, importing documents, image uploads | file, git, convert_document |
| **astro_component** | Editing components, layouts, styles, colors | file, git, run_command |
| **astro_general** | Config, builds, deploys, and anything else | All Astro tools |

## Security

- Network isolation — containers can't reach the internet directly, only through Squid
- SSRF protection — private IP ranges blocked at the proxy
- Admin lock — only your Telegram user ID can interact with the bot
- Budget cap — monthly AI spend limit enforced by LiteLLM
- Command blocklist — `db drop`, `eval`, `shell` and other dangerous WP-CLI commands rejected
- MCP sandboxing — read-only filesystem, dropped capabilities, no host bind mounts
- Webhook auth — inbound endpoints require a bearer token

## Config

All configuration lives in `.env`. See [.env.template](.env.template) for the full list.

**Minimum required:**
- One AI API key
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_USER_ID`
- `LITELLM_MASTER_KEY` (generate: `openssl rand -hex 32`)
- `SITE_MODE` — `wordpress` (default) or `astro`

**WordPress mode additionally needs:**
- `WP_URL` and WordPress credentials

**Astro mode additionally needs:**
- `ASTRO_PROJECT_PATH` — path to the cloned Astro repo on the server
- `ASTRO_GIT_REMOTE` / `ASTRO_GIT_BRANCH` — defaults to `origin` / `main`

### Astro git authentication

The Ansible installer generates an ed25519 SSH deploy key and prints the public key at the end of installation. Add it to your GitHub repo under **Settings → Deploy Keys** (write access). The key is mounted into the agent container automatically.

To generate manually:
```bash
ssh-keygen -t ed25519 -f ./astro-deploy-key -N ''
ssh-keyscan -t ed25519 github.com > ./astro-known-hosts
# Add astro-deploy-key.pub to GitHub → repo Settings → Deploy Keys
```

## Docker Compose Variants

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base stack (always required) |
| `docker-compose.override.yml` | Dev mode — hot-reload, debug logging (auto-loaded locally) |
| `docker-compose.prod.yml` | Production — memory limits, log rotation, restart policies |
| `docker-compose.astro.yml` | Astro mode — mounts Astro project, disables relay, injects SSH key |

Production + Astro combined:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.astro.yml up -d
```

## Distribution

Build a clean archive to share — no secrets, no git history, no dev files:

```bash
ansible-playbook ansible/dist.yml
```

Outputs `/tmp/greenclaw-agent-<version>.tar.gz`. The recipient unpacks and runs the Ansible installer or bash installer.

Both the playbook and the bash installer scan for leaked secrets before packaging.

## Development

```bash
npm test          # run tests
npm run typecheck # type check agent + bot
npm run lint      # eslint
npm run format    # prettier
```

## License

MIT
