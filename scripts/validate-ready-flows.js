const fs = require('fs');
const html = fs.readFileSync('docs/ready-flows.html', 'utf8');
const scriptStart = html.indexOf('<script>') + 8;
const scriptEnd = html.indexOf('</script>');
const script = html.substring(scriptStart, scriptEnd);

// 1. Check JS compiles
try {
  new Function(script);
  console.log('[OK] JavaScript compiles without errors');
} catch(e) {
  console.log('[FAIL] JS compile error:', e.message);
  process.exit(1);
}

// 2. Check FLOWS data loads
const lines = script.split('\n');
const closingIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '];');
let flowsCode = lines.slice(0, closingIdx + 1).join('\n').replace('const FLOWS', 'var FLOWS');
const vm = require('vm');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(flowsCode, ctx);

if (!ctx.FLOWS) {
  console.log('[FAIL] FLOWS array not defined');
  process.exit(1);
}

let total = 0;
ctx.FLOWS.forEach(c => { total += c.flows.length; });
console.log(`[OK] ${ctx.FLOWS.length} categories, ${total} flows total`);
ctx.FLOWS.forEach(c => console.log(`     ${c.id}: ${c.flows.length} flows`));

// 3. Check for dead APIs
const deadAPIs = ['coindesk.com', 'numbersapi.com', 'bpi.USD'];
deadAPIs.forEach(api => {
  if (html.includes(api)) console.log(`[WARN] Dead API reference: ${api}`);
});

// 4. Check unescaped ${} in kaotoDesign template literals
let unescaped = 0;
const re = /kaotoDesign: `([^`]*)`/gs;
let m;
while ((m = re.exec(script)) !== null) {
  const content = m[1];
  for (let i = 0; i < content.length - 1; i++) {
    if (content[i] === '$' && content[i+1] === '{') {
      if (i === 0 || content[i-1] !== '\\') {
        unescaped++;
      }
    }
  }
}
if (unescaped > 0) {
  console.log(`[FAIL] ${unescaped} unescaped \${} in kaotoDesign (will break in browser)`);
  process.exit(1);
} else {
  console.log('[OK] All Camel expressions properly escaped in template literals');
}

// 5. Check all flows have required fields
let missing = [];
ctx.FLOWS.forEach(cat => {
  cat.flows.forEach(flow => {
    if (!flow.name) missing.push(`${cat.id}: flow missing name`);
    if (!flow.kaotoDesign) missing.push(`${cat.id}/${flow.name}: missing kaotoDesign`);
    if (!flow.components) missing.push(`${cat.id}/${flow.name}: missing components`);
    if (!flow.description) missing.push(`${cat.id}/${flow.name}: missing description`);
  });
});
if (missing.length > 0) {
  console.log(`[FAIL] ${missing.length} flows with missing fields:`);
  missing.slice(0, 10).forEach(m => console.log('  ', m));
  process.exit(1);
} else {
  console.log('[OK] All flows have required fields (name, kaotoDesign, components, description)');
}

console.log('\n=== VALIDATION PASSED ===');
