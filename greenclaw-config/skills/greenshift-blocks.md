# Greenshift Block System

When creating pages with the Greenshift plugin, use `skill_convert` to transform HTML into Greenshift blocks.

## CRITICAL RULE: Never manually edit Greenshift block JSON

The `skill_convert` script produces correct, validated block code. After conversion:

- **DO NOT** rewrite, restructure, or "validate" the block JSON output
- **DO NOT** write the converted blocks to a new file and then modify them
- **DO NOT** try to fix or improve the block code — the converter output is correct
- Use the converter output DIRECTLY with `wp post update <ID> /tmp/output.txt`
- The ONLY post-conversion changes allowed are: adding `"CSSRender": "1"` and saving scripts to `gspb_block_js`

If you need to make changes to the design, go back to the HTML, edit it there, and re-convert. Never hand-edit block JSON unless it's a simple attribute change (color, text, URL).

## Creating New Pages

1. Write clean HTML+CSS to `/tmp/design.html` (vanilla HTML, `<style>` tags, no frameworks)
2. Run `skill_convert` with `file_path: "/tmp/design.html"` — output goes to stdout, redirect to file: `node /app/config/skills/scripts/convert.js /tmp/design.html -o /tmp/output.txt`
3. **CSSRender**: add `"CSSRender": "1"` to all blocks with `styleAttributes` or `dynamicGClasses` (required when saving programmatically) — see `/app/config/skills/greenlight-instructions/validate-styles.md`
4. **Scripts**: if the page has JS, save scripts to `gspb_block_js` option — see `/app/config/skills/greenlight-instructions/validate-scripts.md`
5. Insert the output into WordPress via `wp post update <ID> /tmp/output.txt`

## Editing Existing Greenshift Pages

When the user asks to change something on an existing page that uses Greenshift blocks, pick the right approach:

### Simple changes (edit blocks directly)
For small, targeted changes like fixing a typo, changing a color value, updating a link, or swapping an image URL — edit the block code directly. Use `wp post get <ID> --field=post_content` to read the current blocks, find the relevant JSON attribute, change it, and update the post.

Examples: "change the button color to red", "fix the typo in the heading", "update the logo URL"

### Complex changes (deconvert → edit HTML → convert back)
For structural changes, layout rework, adding/removing sections, or anything that touches multiple blocks — do NOT try to edit block JSON manually. Instead:

1. Export: `run_command` → `wp post get <ID> --field=post_content > /tmp/blocks.txt`
2. Deconvert: `skill_deconvert` with `file_path: "/tmp/blocks.txt"` — saves HTML to stdout, redirect to `/tmp/edit.html`
3. Edit the HTML (this is where you make your changes — much easier than editing block JSON)
4. Convert back: `skill_convert` with `file_path: "/tmp/edit.html"`
5. Add CSSRender + save scripts (same as "Creating New Pages" steps 3-4)
6. Update with FULL content: `wp post update <ID> /tmp/output.txt` — always replace all blocks, not partial

Examples: "add a testimonials section", "reorganize the layout", "make the hero section completely different", "add a pricing table"

**Rule of thumb:** If you'd need to edit more than 2-3 JSON attributes across multiple blocks, use the deconvert→edit→convert workflow.

## HTML Rules for Clean Conversion

1. **Vanilla HTML + CSS only** — no React, Tailwind, or frameworks
2. **All CSS in `<style>` tags**, all JS in `<script>` tags
3. **Unique class prefixes** — 4+ letters, e.g. `.strp-hero`, `.strp-card`
4. **No `:root`, `body`, or `*` styles** — only your prefixed classes
5. **Headings/paragraphs** must have explicit `margin-top` and `margin-bottom`
6. **Lists** must have `list-style-position: inside; margin-left: 0; padding-left: 0`
7. **Images**: `https://picsum.photos/seed/KEYWORD/WIDTH/HEIGHT`
8. **Full-width sections**: use `wp-section alignfull` + `wp-content-wrap` pattern (see greenlight-vibe.md)

## Without skill_convert (fallback)

Wrap entire HTML+CSS in `<!-- wp:html -->...<style>...</style><section>...</section>...<!-- /wp:html -->`
