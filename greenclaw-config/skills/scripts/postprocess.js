#!/usr/bin/env node

// Post-process converted Greenshift blocks:
// 1. Add "CSSRender":"1" to all blocks that need it (styleAttributes or dynamicGClasses)
// 2. Detect customJs scripts and output save command
//
// Always writes to a file and outputs a summary (never raw blocks to stdout)
//
// Usage:
//   node postprocess.js input.txt -o output.txt

'use strict';

const fs = require('fs');
const path = require('path');

function addCSSRender(content) {
  let added = 0;
  let total = 0;

  // Process line by line — block comments are always single-line
  const lines = content.split('\n');
  const result = lines.map(line => {
    // Match opening block comment for greenshift-blocks
    if (!line.startsWith('<!-- wp:greenshift-blocks/')) return line;
    total++;

    const needsCSSRender =
      (line.includes('"styleAttributes"') || line.includes('"dynamicGClasses"')) &&
      !line.includes('"CSSRender"');

    if (!needsCSSRender) return line;

    // Find the JSON object boundary: first { after block name, last } before -->
    const jsonStart = line.indexOf('{');
    const jsonEnd = line.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart) return line;

    // Insert "CSSRender":"1" before the final }
    const before = line.slice(0, jsonEnd);
    const after = line.slice(jsonEnd);
    added++;
    return before + ',"CSSRender":"1"' + after;
  });

  return { content: result.join('\n'), added, total };
}

function detectScripts(content) {
  // Check if any blocks have customJsEnabled
  const hasScripts = content.includes('"customJsEnabled":true');
  const scriptBlockCount = (content.match(/"customJsEnabled":true/g) || []).length;
  return { hasScripts, scriptBlockCount };
}

// --- CLI ---
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node postprocess.js <input.txt> -o <output.txt>
Adds CSSRender:"1" to Greenshift blocks and writes result to output file.`);
  process.exit(0);
}

const fileArg = args.find(a => a !== '-o' && !a.startsWith('-') && args[args.indexOf(a) - 1] !== '-o');
if (!fileArg) {
  console.error('[postprocess] ERROR: No input file specified');
  process.exit(1);
}

const outIdx = args.indexOf('-o');
const outPath = (outIdx !== -1 && args[outIdx + 1])
  ? path.resolve(args[outIdx + 1])
  : path.resolve(fileArg.replace(/\.[^.]+$/, '') + '_final.txt');

const input = fs.readFileSync(path.resolve(fileArg), 'utf8');
const { content: result, added, total } = addCSSRender(input);
const { hasScripts, scriptBlockCount } = detectScripts(result);

fs.writeFileSync(outPath, result, 'utf8');

// Output summary (this is what the agent sees)
const stats = `[postprocess] ${total} GS blocks found, CSSRender added to ${added} blocks`;
const fileInfo = `Output: ${outPath} (${result.length} bytes)`;
const scriptInfo = hasScripts
  ? `\n[postprocess] ${scriptBlockCount} block(s) have custom scripts — save them with:\nEXISTING=$(wp option get gspb_block_js --format=json 2>/dev/null || echo '{}')\n# Then merge and update (see validate-scripts.md)`
  : '';

console.log(`${stats}\n${fileInfo}${scriptInfo}\nUse: wp post update <POST_ID> ${outPath}`);
