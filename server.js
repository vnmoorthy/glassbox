// Glassbox server — zero-dependency Node HTTP server.
// Serves the UI and exposes the agent + ledger over a small JSON API.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planRun, approveRun, rejectRun, cancelOrder, chooseAlternative, verifyLedger, toMarkdownReceipt, applyPurchaseToProfile, appendEvent } from './public/engine.js';
import { runDrills, DRILLS } from './public/drills.js';
import { SPONSORS } from './public/sponsors.js';
import { dispatch, status as stackStatus } from './integrations.js';
import { DEFAULT_PROFILE, PRODUCTS, MERCHANTS, CATEGORIES } from './public/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// tiny .env loader (no dependency)
try { for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); } } catch {}
const PUBLIC = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const STORE = path.join(DATA, 'store.json');
const PORT = Number(process.env.PORT || 8787);

fs.mkdirSync(DATA, { recursive: true });
const load = () => { try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch { return { profile: structuredClone(DEFAULT_PROFILE), runs: {} }; } };
let db = load();
const save = () => fs.writeFileSync(STORE, JSON.stringify(db, null, 2));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };

function send(res, code, body, headers = {}) {
  const isStr = typeof body === 'string';
  res.writeHead(code, { 'content-type': isStr ? 'text/plain; charset=utf-8' : 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(isStr ? body : JSON.stringify(body));
}
async function readBody(req) {
  let s = ''; for await (const c of req) s += c;
  if (!s) return {};
  try { return JSON.parse(s); } catch { throw Object.assign(new Error('Invalid JSON'), { code: 400 }); }
}
const summary = r => ({ id: r.id, mission: r.mission, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt, root: r.root, events: r.ledger.length, order: r.order, recommendation: r.recommendation && { name: r.recommendation.name, total: r.recommendation.total } });

const sponsorName = id => SPONSORS.find(s => s.id === id)?.name || id;
async function stack(run, phase, ids, from) {
  const calls = await dispatch(ids, { run, profile: db.profile, events: run.ledger.slice(from) });
  const live = calls.filter(c => c.mode === 'live' && c.ok).length;
  await appendEvent(run, 'stack.dispatched', `Sponsor stack · ${phase}`, {
    status: calls.some(c => !c.ok) ? 'warn' : 'ok',
    summary: `${calls.length} partner adapters · ${live} live · ${calls.length - live} local`,
    evidence: calls.map(c => ({ source: sponsorName(c.id), ref: `${c.mode}:${c.id}`, fact: `${c.ok ? '' : '⚠ '}${c.detail} (${c.ms}ms)` })),
    data: { phase, calls: calls.map(c => ({ id: c.id, mode: c.mode, ok: c.ok, ms: c.ms })) },
  });
  run.root = run.ledger[run.ledger.length - 1].hash;
}
const PLAN_STACK = ['airbyte', 'senso', 'cognee', 'superlinked', 'arcee', 'statsig', 'amplitude'];

const routes = [
  ['GET', /^\/api\/health$/, () => ({ ok: true, mode: 'server', runs: Object.keys(db.runs).length, products: PRODUCTS.length, merchants: Object.keys(MERCHANTS).length })],
  ['GET', /^\/api\/catalog$/, () => ({ products: PRODUCTS, merchants: MERCHANTS, categories: CATEGORIES })],
  ['GET', /^\/api\/profile$/, () => db.profile],
  ['PUT', /^\/api\/profile$/, async (req) => { const b = await readBody(req); db.profile = { ...db.profile, ...b, policy: { ...db.profile.policy, ...(b.policy || {}) } }; save(); return db.profile; }],
  ['POST', /^\/api\/profile\/reset$/, () => { db.profile = structuredClone(DEFAULT_PROFILE); save(); return db.profile; }],
  ['GET', /^\/api\/runs$/, () => Object.values(db.runs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summary)],
  ['POST', /^\/api\/runs$/, async (req) => {
    const { mission } = await readBody(req);
    if (!mission || !String(mission).trim()) throw Object.assign(new Error('mission is required'), { code: 400 });
    const run = await planRun(String(mission).slice(0, 500), db.profile);
    await stack(run, 'plan', run.status === 'awaiting_approval' ? PLAN_STACK : ['cognee', 'statsig', 'amplitude'], 0);
    db.runs[run.id] = run; save(); return run;
  }],
  ['GET', /^\/api\/runs\/([\w-]+)$/, (req, m) => getRun(m[1])],
  ['POST', /^\/api\/runs\/([\w-]+)\/approve$/, async (req, m) => {
    const r0 = getRun(m[1]); let mark = r0.ledger.length;
    const run = await approveRun(r0, db.profile, {
      afterApprove: async r => { await stack(r, 'human verification', ['persona'], mark); },
      beforeSeal: async r => { const from = r.ledger.findIndex(e => e.type === 'mandate.approved'); await stack(r, 'record & learn', ['singlestore', 'cognee', 'amplitude'], from); },
    });
    applyPurchaseToProfile(db.profile, run); save(); return run; }],
  ['POST', /^\/api\/runs\/([\w-]+)\/reject$/, async (req, m) => { const b = await readBody(req); const r0 = getRun(m[1]); const from = r0.ledger.length; const run = await rejectRun(r0, b.reason); await stack(run, 'record', ['singlestore', 'amplitude'], from); save(); return run; }],
  ['POST', /^\/api\/runs\/([\w-]+)\/choose$/, async (req, m) => { const b = await readBody(req); const run = await chooseAlternative(getRun(m[1]), b.productId, db.profile); save(); return run; }],
  ['POST', /^\/api\/runs\/([\w-]+)\/cancel$/, async (req, m) => { const r0 = getRun(m[1]); const from = r0.ledger.length; const run = await cancelOrder(r0); await stack(run, 'record', ['singlestore', 'amplitude'], from); const pp = db.profile.pastPurchases.find(x => x.runId === run.id); if (pp) pp.outcome = 'cancelled'; save(); return run; }],
  ['GET', /^\/api\/runs\/([\w-]+)\/verify$/, (req, m) => verifyLedger(getRun(m[1]).ledger)],
  ['GET', /^\/api\/runs\/([\w-]+)\/receipt\.md$/, (req, m) => ({ __raw: toMarkdownReceipt(getRun(m[1])), type: 'text/markdown; charset=utf-8' })],
  ['GET', /^\/api\/integrations$/, () => stackStatus()],
  ['POST', /^\/api\/integrations\/ping$/, async () => { const run = await planRun('Noise-cancelling headphones for flights under $300', structuredClone(db.profile)); run.id = 'ping_' + run.id; await dispatch(SPONSORS.map(s => s.id).filter(id => !['firedrill', 'guild', 'persona'].includes(id)), { run, profile: db.profile, events: run.ledger.slice(0, 3), drills: { results: [], total: 0, passed: 0, score: 0 } }); return stackStatus(); }],
  ['POST', /^\/api\/drills$/, async () => { const drills = await runDrills(DEFAULT_PROFILE); const calls = await dispatch(['firedrill', 'guild'], { drills, run: {}, profile: db.profile, events: [] }); drills.external = calls.map(c => ({ id: c.id, name: sponsorName(c.id), live: c.mode === 'live' && c.ok, detail: c.detail })); return drills; }],
  ['GET', /^\/api\/drills\/firedrill\.json$/, () => ({ agent: 'glassbox', description: 'Adversarial shopping-agent scenarios for `firedrill run`', scenarios: DRILLS.map(d => ({ id: d.id, name: d.name, description: d.desc, input: d.mission })) })],
  ['DELETE', /^\/api\/runs$/, () => { db.runs = {}; save(); return { ok: true }; }],
];
function getRun(id) { const r = db.runs[id]; if (!r) throw Object.assign(new Error('run not found'), { code: 404 }); return r; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) {
      for (const [method, re, fn] of routes) {
        const m = url.pathname.match(re);
        if (m && req.method === method) {
          const out = await fn(req, m);
          if (out && out.__raw) return send(res, 200, out.__raw, { 'content-type': out.type });
          return send(res, 200, out);
        }
      }
      return send(res, 404, { error: 'not found' });
    }
    let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (!p) p = 'index.html';
    const file = path.join(PUBLIC, p);
    if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden');
    fs.readFile(file, (err, buf) => {
      if (err) return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, b2) => e2 ? send(res, 404, 'not found') : send(res, 200, b2.toString(), { 'content-type': MIME['.html'] }));
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    });
  } catch (e) {
    send(res, e.code && e.code < 600 ? e.code : 500, { error: e.message });
  }
});
server.listen(PORT, () => console.log(`\n  ◆ Glassbox running → http://localhost:${PORT}\n`));
