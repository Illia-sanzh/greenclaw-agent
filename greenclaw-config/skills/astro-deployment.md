# Astro Deployment (Cloudflare Workers)

## How It Works
Astro on Cloudflare uses the Workers runtime (not Pages). Deploy with `wrangler deploy`
or connect the repo to Cloudflare for automatic git-push deploys.

## Required Setup

### astro.config.mjs
```javascript
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
});
```

### wrangler.toml (required)
```toml
name = "my-astro-site"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./dist/client"
```

### Install the adapter
```bash
npx astro add cloudflare
```

## Deploy Workflow

### Manual deploy
```
1. git_operations add → commit → push
2. run_command: npx wrangler deploy
```

### Automatic (git-connected)
If the Cloudflare Workers dashboard is connected to the repo, pushing to the
configured branch triggers an automatic build and deploy.

```
1. git_operations action="add"
2. git_operations action="commit" message="your message"
3. git_operations action="push"
```

## Environment Variables
- Set in Cloudflare Workers dashboard: Settings → Variables and Secrets
- Or in `wrangler.toml`:
  ```toml
  [vars]
  PUBLIC_SITE_URL = "https://mysite.workers.dev"
  ```
- Access in Astro: `import.meta.env.PUBLIC_SITE_URL`
- Prefix with `PUBLIC_` to expose to client-side code

## Troubleshooting
- Run `npx wrangler dev` locally to test the Workers build
- Run `npm run build` first to check for build errors before deploying
- Common issues: missing `wrangler.toml`, wrong `compatibility_date`, Node.js APIs needing `nodejs_compat` flag
