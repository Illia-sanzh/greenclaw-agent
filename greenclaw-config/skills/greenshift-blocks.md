# Greenshift Block System

When creating pages with the Greenshift plugin, use `skill_convert_html_to_greenshift` to transform HTML into Greenshift blocks.

## CRITICAL RULES

### Never manually edit Greenshift block JSON
The `skill_convert_html_to_greenshift` script produces correct, validated block code with CSSRender already applied. After conversion:

- **DO NOT** rewrite, restructure, or "validate" the block JSON output
- **DO NOT** write the converted blocks to a new file and then modify them
- **DO NOT** try to fix or improve the block code — the converter output is correct
- Save the converter output DIRECTLY to WordPress — do not process it further

If you need to make changes to the design, go back to the HTML, edit it there, and re-convert.

### NEVER use wp:html blocks as fallback
When the Greenshift plugin is active, you MUST use proper Greenshift blocks. **NEVER** fall back to `<!-- wp:html -->` blocks. The `skill_convert_html_to_greenshift` tool handles all conversion correctly. If something looks wrong after saving, the issue is in the HTML source — fix the HTML and re-convert.

## Creating New Pages

1. Write clean HTML+CSS to `/tmp/design.html` (vanilla HTML, `<style>` tags, no frameworks)
2. Run `skill_convert_html_to_greenshift` with `file_path: "/tmp/design.html"` — redirect output to a file
3. **Scripts**: if the page has JS, save scripts to `gspb_block_js` option — read `/app/config/skills/greenlight-instructions/validate-scripts.md` for instructions
4. Save the output to WordPress: `wp post update <ID> /tmp/output.txt`
5. Done — CSSRender is already added by the converter. Do NOT edit the block output.

## Editing Existing Greenshift Pages

### Simple changes (edit blocks directly)
For small changes like fixing a typo, changing a color value, updating a link — edit the block code directly.

### Complex changes (deconvert → edit HTML → convert back)
For structural changes, layout rework, adding/removing sections:

1. Export: `wp post get <ID> --field=post_content > /tmp/blocks.txt`
2. Deconvert: `skill_deconvert_greenshift_to_html` with `file_path: "/tmp/blocks.txt"`
3. Edit the HTML
4. Convert back: `skill_convert_html_to_greenshift` with `file_path: "/tmp/edit.html"`
5. If page has JS, save scripts (see step 3 of Creating New Pages)
6. Update: `wp post update <ID> /tmp/output.txt`

## HTML Rules for Clean Conversion

1. **Vanilla HTML + CSS only** — no React, Tailwind, or frameworks
2. **All CSS in `<style>` tags**, all JS in `<script>` tags
3. **Unique class prefixes** — 4+ letters, e.g. `.strp-hero`, `.strp-card`
4. **No `:root`, `body`, or `*` styles** — only your prefixed classes
5. **Headings/paragraphs** must have explicit `margin-top` and `margin-bottom`
6. **Lists** must have `list-style-position: inside; margin-left: 0; padding-left: 0`
7. **Images**: `https://picsum.photos/seed/KEYWORD/WIDTH/HEIGHT`
8. **Full-width sections**: use `wp-section alignfull` + `wp-content-wrap` pattern (see greenlight-vibe.md)
