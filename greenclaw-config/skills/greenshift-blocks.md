# Greenshift Block System

When creating pages with the Greenshift plugin, use `skill_convert_html_to_greenshift` to transform HTML into Greenshift blocks.

## CRITICAL RULES

### Never manually edit Greenshift block JSON
The converter produces correct block code with CSSRender already applied. After conversion:

- **DO NOT** read, open, or inspect the output file (`/tmp/gs_output.txt`)
- **DO NOT** write the blocks to a different file
- **DO NOT** try to fix, validate, or improve the block code
- Run `wp post update <ID> /tmp/gs_output.txt` DIRECTLY — nothing else

### NEVER use wp:html blocks
When Greenshift is active, **NEVER** use `<!-- wp:html -->` blocks for page content. Always use the converter. If styles look wrong after saving, the issue is in the HTML source — fix the HTML and re-convert. Do NOT replace GS blocks with an HTML block.

## Creating New Pages

1. Write clean HTML+CSS to `/tmp/design.html`
2. Create the page: `wp post create --post_type=page --post_status=publish --post_title="Title" --porcelain` → get ID
3. Convert: `skill_convert_html_to_greenshift` with `file_path: "/tmp/design.html"`
4. Save: `wp post update <ID> /tmp/gs_output.txt`
5. Done. Do NOT read or modify `/tmp/gs_output.txt`.

If the page has custom JS scripts, the converter will tell you — follow the instructions it outputs.

## Editing Existing Greenshift Pages

### Simple changes (edit blocks directly)
For small changes (typo, color, link) — edit block JSON directly via `wp post get/update`.

### Complex changes (deconvert → edit HTML → convert back)
1. `wp post get <ID> --field=post_content > /tmp/blocks.txt`
2. `skill_deconvert_greenshift_to_html` with `file_path: "/tmp/blocks.txt"`
3. Edit the HTML
4. `skill_convert_html_to_greenshift` with `file_path: "/tmp/edit.html"`
5. `wp post update <ID> /tmp/gs_output.txt`

## HTML Rules

1. Vanilla HTML + CSS only — no React, Tailwind, or frameworks
2. All CSS in `<style>` tags, all JS in `<script>` tags
3. Unique class prefixes — 4+ letters, e.g. `.strp-hero`
4. No `:root`, `body`, or `*` styles
5. Headings/paragraphs must have explicit `margin-top` and `margin-bottom`
6. Lists must disable left margin/spacing
7. Full-width sections: use `wp-section alignfull` + `wp-content-wrap` pattern (see greenlight-vibe.md)
