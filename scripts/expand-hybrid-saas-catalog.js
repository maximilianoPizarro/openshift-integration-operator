#!/usr/bin/env node
/**
 * Expand Hybrid Cloud catalog with AWS (ROSA), Azure (ARO), and GCP SaaS flows.
 * Flow definitions live in scripts/hybrid-saas-flows.json (safe JSON, no JS template issues).
 */
const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'docs', 'flow-catalog.json');
const flowsPath = path.join(__dirname, 'hybrid-saas-flows.json');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const newFlows = JSON.parse(fs.readFileSync(flowsPath, 'utf8'));

const hybrid = catalog.find(c => c.id === 'hybrid');
if (!hybrid) {
  console.error('[FAIL] hybrid category not found');
  process.exit(1);
}

const existingNames = new Set(hybrid.flows.map(f => f.name));
const toAdd = newFlows.filter(f => !existingNames.has(f.name));
hybrid.flows.push(...toAdd);
hybrid.title = 'Hybrid Cloud & Multi-Cloud SaaS';
hybrid.icon = '\u2601\uFE0F';

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

const total = catalog.reduce((sum, c) => sum + c.flows.length, 0);
console.log(`[OK] Added ${toAdd.length} hybrid SaaS flows (${hybrid.flows.length} total in hybrid)`);
console.log(`[OK] Catalog total: ${total} flows`);
toAdd.forEach(f => console.log(`     + ${f.name}`));
