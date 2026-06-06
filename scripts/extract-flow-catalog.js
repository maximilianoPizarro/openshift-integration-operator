#!/usr/bin/env node
/**
 * One-time / maintenance script: extract FLOWS from ready-flows.html into docs/flow-catalog.json.
 * After initial extraction, edit flow-catalog.json directly (single source of truth).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, '..', 'docs', 'ready-flows.html');
const outPath = path.join(__dirname, '..', 'docs', 'flow-catalog.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const scriptStart = html.indexOf('<script>') + 8;
const scriptEnd = html.indexOf('</script>');
const script = html.substring(scriptStart, scriptEnd);

const lines = script.split('\n');
const closingIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '];');
if (closingIdx < 0) {
  console.error('[FAIL] Could not find end of FLOWS array');
  process.exit(1);
}

const flowsCode = lines.slice(0, closingIdx + 1).join('\n').replace('const FLOWS', 'var FLOWS');
const ctx = {};
vm.createContext(ctx);
try {
  vm.runInContext(flowsCode, ctx);
} catch (e) {
  console.error('[FAIL] Could not evaluate FLOWS:', e.message);
  process.exit(1);
}

if (!ctx.FLOWS || !Array.isArray(ctx.FLOWS)) {
  console.error('[FAIL] FLOWS array not defined');
  process.exit(1);
}

const total = ctx.FLOWS.reduce((sum, cat) => sum + cat.flows.length, 0);
fs.writeFileSync(outPath, JSON.stringify(ctx.FLOWS, null, 2) + '\n', 'utf8');

console.log(`[OK] Wrote ${ctx.FLOWS.length} categories, ${total} flows to ${outPath}`);
ctx.FLOWS.forEach(c => console.log(`     ${c.id}: ${c.flows.length} flows`));
