// Probe configured partner adapters live (prints results, never secrets).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && m[2]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
const { planRun } = await import('../public/engine.js');
const { DEFAULT_PROFILE } = await import('../public/catalog.js');
const { ADAPTERS, dispatch } = await import('../integrations.js');
const run = await planRun('Noise-cancelling headphones for long flights under $300', structuredClone(DEFAULT_PROFILE));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ADAPTERS).filter(id => ADAPTERS[id].configured());
console.log('configured:', Object.keys(ADAPTERS).filter(id => ADAPTERS[id].configured()).join(', ') || 'none');
for (const r of await dispatch(ids, { run, profile: DEFAULT_PROFILE, events: run.ledger.slice(0, 4), drills: { results: [], total: 0, passed: 0, score: 0 } })) console.log(`${r.id.padEnd(12)} ${r.mode.padEnd(5)} ${r.ok ? 'OK ' : 'ERR'} ${r.ms}ms  ${r.detail}`);
