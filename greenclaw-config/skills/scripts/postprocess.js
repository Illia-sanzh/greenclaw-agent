#!/usr/bin/env node

// Post-process converted Greenshift blocks:
// 1. Add "CSSRender":"1" to all blocks with styleAttributes or dynamicGClasses
// 2. Extract customJs scripts and output a save command
//
// Usage:
//   node postprocess.js input.txt -o output.txt
//   node postprocess.js input.txt                  # stdout
//   cat input.txt | node postprocess.js

'use strict';

const fs = require('fs');
const path = require('path');

function addCSSRender(content) {
  // Match block comment openers: <!-- wp:greenshift-blocks/element {JSON} -->
  return content.replace(
    /<!-- wp:(greenshift-blocks\/\w+) (\{[^}]*(?:\{[^}]*\}[^}]*)*\}) -->/g,
    (match, blockType, jsonStr) => {
      // Only add to blocks that have styleAttributes or dynamicGClasses
      if (
        (jsonStr.includes('"styleAttributes"') || jsonStr.includes('"dynamicGClasses"')) &&
        !jsonStr.includes('"CSSRender"')
      ) {
        // Insert CSSRender before the closing brace
        const patched = jsonStr.replace(/\}$/, ',"CSSRender":"1"}');
        return `<!-- wp:${blockType} ${patched} -->`;
      }
      return match;
    }
  );
}

function extractScripts(content) {
  // Find all blocks with customJsEnabled and extract id + customJs pairs
  const scripts = {};
  const blockPattern = /<!-- wp:greenshift-blocks\/\w+ (\{[\s\S]*?\}) -->/g;
  let m;
  while ((m = blockPattern.exec(content)) !== null) {
    try {
      const attrs = JSON.parse(m[1]);
      if (attrs.customJsEnabled && attrs.id && attrs.customJs) {
        scripts[attrs.id] = attrs.customJs;
      }
    } catch {
      // JSON too complex for simple parse — try regex extraction
      const idMatch = m[1].match(/"id"\s*:\s*"([^"]+)"/);
      const jsMatch = m[1].match(/"customJs"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const enabledMatch = m[1].match(/"customJsEnabled"\s*:\s*true/);
      if (idMatch && jsMatch && enabledMatch) {
        scripts[idMatch[1]] = jsMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    }
  }
  return scripts;
}

// --- CLI ---
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  node postprocess.js <input.txt>              Process file, output to stdout
  node postprocess.js <input.txt> -o out.txt   Process file, write to out.txt
  cat file.txt | node postprocess.js           Process from stdin

Adds CSSRender:"1" to all Greenshift blocks that need it.
If blocks contain custom scripts, outputs a WP-CLI command to stderr.`);
  process.exit(0);
}

let input;
const fileArg = args.find(a => a !== '-o' && !a.startsWith('-') && args[args.indexOf(a) - 1] !== '-o');

if (fileArg) {
  input = fs.readFileSync(path.resolve(fileArg), 'utf8');
} else if (!process.stdin.isTTY) {
  input = fs.readFileSync('/dev/stdin', 'utf8');
} else {
  console.error('Error: No input file or stdin');
  process.exit(1);
}

const result = addCSSRender(input);
const scripts = extractScripts(result);

// Output processed blocks
const outIdx = args.indexOf('-o');
if (outIdx !== -1 && args[outIdx + 1]) {
  const outPath = path.resolve(args[outIdx + 1]);
  fs.writeFileSync(outPath, result, 'utf8');
  console.error(`Written to ${outPath}`);
} else {
  process.stdout.write(result);
}

// If scripts found, output the save command to stderr
if (Object.keys(scripts).length > 0) {
  const json = JSON.stringify(scripts);
  console.error(`\n[postprocess] Scripts detected. Save with:\nEXISTING=$(wp option get gspb_block_js --format=json 2>/dev/null || echo '{}')\nMERGED=$(node -e "const e=JSON.parse(process.argv[1]||'{}');const n=${json.replace(/'/g, "\\'")};process.stdout.write(JSON.stringify({...e,...n}))" "$EXISTING")\nwp option update gspb_block_js "$MERGED" --format=json`);
}
