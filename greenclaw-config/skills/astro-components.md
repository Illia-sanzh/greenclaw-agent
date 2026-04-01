# Astro Component Development

## .astro File Structure
Every .astro file has two parts separated by `---` fences:
1. **Component script** (top) — runs at build time, JavaScript/TypeScript
2. **Component template** (bottom) — HTML with `{expressions}`

```astro
---
// Script: imports, props, data fetching
import Button from "./Button.astro";
const { title, items = [] } = Astro.props;
const formatted = items.map(i => i.toUpperCase());
---
<!-- Template: HTML output -->
<div>
  <h2>{title}</h2>
  <ul>
    {formatted.map(item => <li>{item}</li>)}
  </ul>
  <Button label="Click me" />
</div>

<style>
  div { padding: 1rem; }
  h2 { color: var(--accent); }
</style>
```

## Props and TypeScript
```astro
---
interface Props {
  title: string;
  count?: number;
  variant?: "primary" | "secondary";
}
const { title, count = 0, variant = "primary" } = Astro.props;
---
```

## Slots (Child Content)
```astro
<!-- Card.astro -->
<div class="card">
  <slot name="header" />   <!-- Named slot -->
  <slot />                  <!-- Default slot -->
  <slot name="footer" />
</div>

<!-- Usage -->
<Card>
  <h2 slot="header">Title</h2>
  <p>Default content here</p>
  <span slot="footer">Footer</span>
</Card>
```

## Scoped vs Global Styles
```astro
<!-- Scoped (default) — only affects this component -->
<style>
  h1 { color: red; }
</style>

<!-- Global — affects entire page -->
<style is:global>
  .prose h1 { color: red; }
</style>
```

## CSS Variables and Theming
```astro
<style>
  :root {
    --accent: #2337ff;
    --accent-dark: #000d8a;
    --text: #444;
  }
  /* Use: color: var(--accent); */
</style>
```

## Client Directives (Islands Architecture)
For framework components (React, Vue, Svelte, Solid):
```astro
---
import Counter from "./Counter.jsx";
---
<!-- Hydrate on page load -->
<Counter client:load />

<!-- Hydrate when visible in viewport -->
<Counter client:visible />

<!-- Hydrate when browser is idle -->
<Counter client:idle />

<!-- Client-only, no SSR -->
<Counter client:only="react" />
```

## Common File Locations
- `src/components/` — Reusable components
- `src/layouts/` — Page wrappers (BaseLayout, BlogPost)
- `src/pages/` — Routes (file-based routing)
- `src/pages/index.astro` — Homepage
- `src/pages/blog/index.astro` — Blog listing
- `src/pages/blog/[...slug].astro` — Individual post pages
- `src/styles/global.css` — Site-wide styles
- `src/consts.ts` — Site title, description, nav links
