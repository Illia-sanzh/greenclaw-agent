# Astro Site Management — Agent Knowledge

## Capabilities

You can manage an Astro static site through these operations:
- Create, edit, and delete blog posts (markdown/MDX in content collections)
- Import documents (.docx, .pdf) and convert them to markdown
- Upload and organize images in src/assets/
- Edit components (.astro), layouts, and pages
- Edit MDX files with interactive components
- Modify global and component-scoped styles
- Push changes to git for automatic Cloudflare Workers deployment (or run `npx wrangler deploy`)
- Run npm commands (build, dev, add packages)

## Content Collections

Content collections use `src/content/` with a schema defined in `src/content/config.ts`.

### Blog Posts
Location: `src/content/blog/*.md` or `*.mdx`

Required frontmatter:
```yaml
---
title: "Post Title"
description: "SEO description"
pubDate: 2024-01-15
---
```

Optional fields: `updatedDate`, `heroImage`, `draft`, `tags`

### Creating a Post
1. Write the markdown file with frontmatter to `src/content/blog/<slug>.md`
2. Place any images in `src/assets/<slug>/`
3. Reference images: `![alt](~/assets/<slug>/image.jpg)`
4. Git add, commit, push to deploy

### Querying Collections
In .astro pages:
```astro
---
import { getCollection } from "astro:content";
const posts = await getCollection("blog");
const sorted = posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
---
```

## Component Patterns

### Basic .astro Component
```astro
---
const { title, class: className } = Astro.props;
---
<section class:list={["section", className]}>
  <h2>{title}</h2>
  <slot />
</section>

<style>
  .section { padding: 2rem; }
</style>
```

### Layout Pattern
```astro
---
import BaseHead from "../components/BaseHead.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
const { title, description } = Astro.props;
---
<html lang="en">
<head><BaseHead title={title} description={description} /></head>
<body>
  <Header />
  <main><slot /></main>
  <Footer />
</body>
</html>
```

### Dynamic Routes
File: `src/pages/blog/[...slug].astro`
```astro
---
import { getCollection } from "astro:content";
export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({ params: { slug: post.slug }, props: post }));
}
const post = Astro.props;
const { Content } = await post.render();
---
<Content />
```

## Safety Rules

- NEVER delete the `.git` directory
- NEVER delete `node_modules/` or `package-lock.json` unless reinstalling
- NEVER force-push (`git push --force`)
- NEVER push to branches other than the configured deployment branch
- Do NOT modify `astro.config.mjs` or `wrangler.toml` without explicit user request
- NEVER run `rm -rf` on the project root
- Ask confirmation before deleting any component or page file

## Common Tasks

### Add a blog post
1. `write_file` to create `src/content/blog/<slug>.md` with frontmatter + content
2. `git_operations` status → add → commit → push

### Import a document
1. `convert_document` with the uploaded file path
2. `read_file` the generated markdown to review
3. Edit frontmatter if needed with `write_file`
4. `git_operations` add → commit → push

### Edit a component
1. `read_file` the component to understand current code
2. `write_file` with the updated component
3. `git_operations` add → commit → push

### Change site styling
1. `read_file` the relevant CSS file or component
2. `write_file` with updated styles
3. `git_operations` add → commit → push

### Upload an image
1. Save image to `src/assets/<folder>/` using `write_file` or `run_command`
2. Reference in markdown: `![alt](~/assets/<folder>/image.jpg)`
3. Or in .astro: `import img from "~/assets/<folder>/image.jpg"`
