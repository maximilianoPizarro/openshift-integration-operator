const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'docs', 'flow-catalog.json');
const htmlPath = path.join(__dirname, '..', 'docs', 'ready-flows.html');

let FLOWS;
try {
  FLOWS = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  console.log('[OK] flow-catalog.json parses as valid JSON');
} catch (e) {
  console.log('[FAIL] JSON parse error:', e.message);
  process.exit(1);
}

if (!Array.isArray(FLOWS)) {
  console.log('[FAIL] flow-catalog.json root must be an array');
  process.exit(1);
}

let total = 0;
FLOWS.forEach(c => { total += c.flows.length; });
console.log(`[OK] ${FLOWS.length} categories, ${total} flows total`);
FLOWS.forEach(c => console.log(`     ${c.id}: ${c.flows.length} flows`));

// Check ready-flows.html loads catalog via fetch (no inline FLOWS array)
const html = fs.readFileSync(htmlPath, 'utf8');
if (html.includes('const FLOWS = [')) {
  console.log('[FAIL] ready-flows.html still contains inline FLOWS array');
  process.exit(1);
}
if (!html.includes('flow-catalog.json')) {
  console.log('[FAIL] ready-flows.html does not fetch flow-catalog.json');
  process.exit(1);
}
if (html.includes('Showing 0 of 0')) {
  console.log('[FAIL] ready-flows.html still shows static "Showing 0 of 0" before catalog loads');
  process.exit(1);
}
if (!html.includes('FALLBACK_CATALOG')) {
  console.log('[WARN] ready-flows.html has no FALLBACK_CATALOG for fetch failures');
}
console.log('[OK] ready-flows.html fetches flow-catalog.json');

// Check for dead APIs in catalog
const catalogText = fs.readFileSync(catalogPath, 'utf8');
const deadAPIs = ['coindesk.com', 'numbersapi.com', 'bpi.USD'];
deadAPIs.forEach(api => {
  if (catalogText.includes(api)) console.log(`[WARN] Dead API reference: ${api}`);
});

const GITHUB_USER_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

// Check all flows have required fields
let missing = [];
FLOWS.forEach(cat => {
  if (!cat.id) missing.push('category missing id');
  if (!cat.title) missing.push(`${cat.id || '?'}: category missing title`);
  if (!Array.isArray(cat.flows)) missing.push(`${cat.id}: flows must be array`);
  (cat.flows || []).forEach(flow => {
    if (!flow.name) missing.push(`${cat.id}: flow missing name`);
    if (!flow.kaotoDesign) missing.push(`${cat.id}/${flow.name}: missing kaotoDesign`);
    if (!flow.components) missing.push(`${cat.id}/${flow.name}: missing components`);
    if (!flow.description) missing.push(`${cat.id}/${flow.name}: missing description`);
    if (!flow.type) missing.push(`${cat.id}/${flow.name}: missing type`);
    if (!flow.pattern) missing.push(`${cat.id}/${flow.name}: missing pattern`);
    if (flow.owner && !GITHUB_USER_RE.test(flow.owner)) {
      missing.push(`${cat.id}/${flow.name}: invalid owner username "${flow.owner}"`);
    }
    // Community flows (new contributions) must declare owner; legacy publicapi-* entries remain valid without it.
    const REQUIRES_OWNER = new Set(['publicapi-open-meteo-weather']);
    if (flow.name && REQUIRES_OWNER.has(flow.name) && !flow.owner) {
      missing.push(`${cat.id}/${flow.name}: missing owner (required for community flow contributions)`);
    }
  });
});
if (missing.length > 0) {
  console.log(`[FAIL] ${missing.length} issues:`);
  missing.slice(0, 10).forEach(m => console.log('  ', m));
  process.exit(1);
}
console.log('[OK] All flows have required fields (name, kaotoDesign, components, description, type, pattern)');

// Check kaotoDesign contains Camel expressions (unescaped ${} is correct in JSON)
let hasExpressions = 0;
FLOWS.forEach(cat => {
  cat.flows.forEach(flow => {
    if (flow.kaotoDesign && flow.kaotoDesign.includes('${')) hasExpressions++;
  });
});
console.log(`[OK] ${hasExpressions} flows contain Camel \${} expressions (stored as plain text in JSON)`);

console.log('\n=== VALIDATION PASSED ===');
