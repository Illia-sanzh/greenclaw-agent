# Astro Content Collections

## Schema Definition
Content schemas are defined in `src/content/config.ts`:
```typescript
import { defineCollection, z } from "astro:content";
const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});
export const collections = { blog };
```

## Querying Collections
```astro
---
import { getCollection, getEntry } from "astro:content";

// Get all non-draft posts
const posts = await getCollection("blog", ({ data }) => !data.draft);

// Sort by date
posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

// Get single entry
const entry = await getEntry("blog", "my-post-slug");
const { Content } = await entry.render();
---
```

## Slug Rules
- Filename becomes the slug: `my-post.md` → `/blog/my-post`
- Use lowercase, hyphens only
- No spaces or special characters

## Image References in Content
```markdown
<!-- From src/assets/ (optimized at build) -->
![Photo](~/assets/blog/photo.jpg)

<!-- From public/ (served as-is) -->
![Logo](/images/logo.png)
```

## MDX Content
For posts needing components, use `.mdx`:
```mdx
---
title: "Interactive Post"
pubDate: 2024-01-15
---
import Callout from "../../components/Callout.astro";

Regular markdown paragraph.

<Callout type="warning">
  This is a styled callout box.
</Callout>
```
