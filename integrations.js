// Sponsor adapters. Each one is a thin, dependency-free `fetch` client.
// If its env keys are present the adapter calls the partner API for real ("live");
// otherwise the step runs on Glassbox's built-in local implementation ("local").
// Every call (live or local) is recorded and surfaced in the UI + ledger.
import { SPONSORS } from './public/sponsors.js';

const env = k => process.env[k] && String(process.env[k]).trim();
const has = (...ks) => ks.every(k => env(k));
const TIMEOUT = Number(process.env.INTEGRATION_TIMEOUT_MS || 4000);

async function http(url, { method = "POST", headers = {}, body, auth, timeout = TIMEOUT } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { method, signal: ctrl.signal, headers: { 'content-type': 'application/json', accept: 'application/json', ...(auth ? { authorization: auth } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = text.slice(0, 200); }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${typeof json === 'string' ? json : JSON.stringify(json).slice(0, 160)}`);
    return json;
  } finally { clearTimeout(t); }
}
const basic = (u, p) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');

// ---------------------------------------------------------------- adapters
export const ADAPTERS = {
  amplitude: {
    configured: () => has('AMPLITUDE_API_KEY'),
    async live({ run, events }) {
      const r = await http(env('AMPLITUDE_ENDPOINT') || 'https://api2.amplitude.com/2/httpapi', {
        body: { api_key: env('AMPLITUDE_API_KEY'), events: events.map(e => ({ user_id: run.userId || 'glassbox-demo-user', device_id: run.id, event_type: 'glassbox.' + e.type, time: Date.parse(e.ts), insert_id: e.hash.slice(0, 32), event_properties: { run_id: run.id, seq: e.seq, status: e.status, title: e.title, hash: e.hash } })) },
      });
      return `ingested ${r.events_ingested ?? events.length} events`;
    },
    local: ({ events }) => `${events.length} analytics events buffered locally`,
  },
  statsig: {
    configured: () => has('STATSIG_SERVER_KEY'),
    async live({ run, events, profile }) {
      const headers = { 'statsig-api-key': env('STATSIG_SERVER_KEY') };
      const gate = await http('https://api.statsig.com/v1/check_gate', { headers, body: { user: { userID: run.userId || 'glassbox-demo-user' }, gateName: env('STATSIG_GATE') || 'glassbox_autobuy' } }).catch(e => ({ error: e.message }));
      await http('https://events.statsigapi.net/v1/log_event', { headers, body: { events: events.map(e => ({ eventName: 'glassbox_' + e.type.replace(/\./g, '_'), user: { userID: run.userId || 'glassbox-demo-user' }, value: e.status, time: Date.parse(e.ts), metadata: { run_id: run.id, seq: String(e.seq) } })) } });
      return `gate ${gate.name || env('STATSIG_GATE') || 'glassbox_autobuy'}=${gate.value ?? 'n/a'} · logged ${events.length} events`;
    },
    local: ({ profile }) => `guardrails from local dynamic config (max $${profile.policy.maxPerOrder}/order)`,
  },
  singlestore: {
    configured: () => has('SINGLESTORE_HOST', 'SINGLESTORE_USER', 'SINGLESTORE_PASSWORD', 'SINGLESTORE_DATABASE'),
    async live({ run, events }) {
      const url = `https://${env('SINGLESTORE_HOST').replace(/^https?:\/\//, '')}/api/v2/exec`;
      const auth = basic(env('SINGLESTORE_USER'), env('SINGLESTORE_PASSWORD'));
      const database = env('SINGLESTORE_DATABASE');
      await http(url, { auth, body: { database, sql: 'CREATE TABLE IF NOT EXISTS glassbox_ledger (run_id VARCHAR(64), seq INT, ts DATETIME(6), actor VARCHAR(16), type VARCHAR(64), title TEXT, status VARCHAR(8), hash CHAR(64), prev_hash CHAR(64), body JSON, PRIMARY KEY (run_id, seq))' } });
      if (!events.length) return 'ledger table ready';
      const sql = 'REPLACE INTO glassbox_ledger VALUES ' + events.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',');
      const args = events.flatMap(e => [run.id, e.seq, e.ts.replace('T', ' ').replace('Z', ''), e.actor, e.type, e.title, e.status, e.hash, e.prevHash, JSON.stringify(e)]);
      const r = await http(url, { auth, timeout: 15000, body: { database, sql, args } });
      return `wrote ${r?.rowsAffected ?? events.length} ledger rows to ${database}.glassbox_ledger`;
    },
    local: ({ events }) => `${events.length} ledger rows persisted to data/store.json`,
  },
  persona: {
    configured: () => has('PERSONA_API_KEY', 'PERSONA_TEMPLATE_ID'),
    async live({ run }) {
      const r = await http('https://api.withpersona.com/api/v1/inquiries', {
        auth: 'Bearer ' + env('PERSONA_API_KEY'),
        body: { data: { attributes: { 'inquiry-template-id': env('PERSONA_TEMPLATE_ID'), 'reference-id': run.id, note: `Glassbox mandate ${run.mandate?.id}` } } },
      });
      return `inquiry ${r?.data?.id || 'created'} (${r?.data?.attributes?.status || 'created'}) bound to mandate ${run.mandate?.id}`;
    },
    local: ({ run }) => `human click-approval recorded for mandate ${run.mandate?.id || '—'}`,
  },
  arcee: {
    configured: () => has('ARCEE_API_KEY'),
    async live({ run }) {
      const r = await http((env('ARCEE_BASE_URL') || 'https://api.arcee.ai/api/v1') + '/chat/completions', {
        auth: 'Bearer ' + env('ARCEE_API_KEY'),
        body: { model: env('ARCEE_MODEL') || 'auto', max_tokens: 160, messages: [
          { role: 'system', content: 'You are a shopping agent. In 2 short sentences, explain the recommendation to the user using ONLY the facts given.' },
          { role: 'user', content: `Mission: ${run.mission}\nRecommendation: ${run.recommendation?.name} for $${run.recommendation?.total}\nFacts:\n- ${(run.recommendation?.why || []).join('\n- ')}` },
        ] },
      });
      const text = r?.choices?.[0]?.message?.content?.trim();
      if (text && run.recommendation) run.recommendation.narrative = text;
      return `rationale by ${r?.model || 'arcee'} (${text ? text.length : 0} chars)`;
    },
    local: () => 'rule-based intent parser + template rationale',
  },
  senso: {
    configured: () => has('SENSO_API_KEY'),
    async live({ run }) {
      const r = await http((env('SENSO_BASE_URL') || 'https://apiv2.senso.ai/api/v1') + '/org/search', {
        headers: { 'X-API-Key': env('SENSO_API_KEY') }, body: { query: `Merchant return policies, trust and product facts relevant to: ${run.mission}` },
      });
      const n = r?.total_results ?? (Array.isArray(r?.results) ? r.results.length : 0);
      if (r?.answer && run.recommendation) run.recommendation.context = String(r.answer).slice(0, 600);
      return `grounded with ${n} verified context result(s)${r?.results?.[0]?.title ? ' · top: ' + r.results[0].title : ''}`;
    },
    local: ({ run }) => `${run.candidates.length} products grounded against the local verified catalog`,
  },
  cognee: {
    configured: () => has('COGNEE_API_KEY', 'COGNEE_BASE_URL'),
    async live({ run, profile }) {
      const base = env('COGNEE_BASE_URL').replace(/\/$/, ''); // e.g. https://<tenant>.aws.cognee.ai
      const headers = { 'X-Api-Key': env('COGNEE_API_KEY') };
      const query = `What do we know about ${profile.name}'s preferences relevant to: ${run.mission}`;
      try {
        const r = await http(base + '/api/v1/search', { headers, timeout: 12000, body: { query, search_type: 'CHUNKS' } });
        return `memory graph search (CHUNKS) returned ${Array.isArray(r) ? r.length : 1} result(s)`;
      } catch (e) {
        if (!/HTTP (404|409)/.test(e.message)) throw e;
        // empty graph → seed it with the user's profile facts (add + cognify in one call)
        const facts = [`${profile.name} wears glasses: ${profile.wearsGlasses}`, `Shoe size: ${profile.shoeSize}`, `Preferred brands: ${(profile.preferredBrands || []).join(', ')}`, `Never buy: ${(profile.avoidBrands || []).join(', ')}`, `Values: ${(profile.values || []).join(', ')}`, ...(profile.pastPurchases || []).map(p => `${p.item} was ${p.outcome}: ${p.note || ''}`)].join('\n');
        const form = new FormData(); form.append('datasetName', 'glassbox_memory'); form.append('raw_data', facts);
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
        try {
          const r = await fetch(base + '/api/v1/remember', { method: 'POST', headers, body: form, signal: ctrl.signal });
          if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 140)}`);
        } finally { clearTimeout(t); }
        return `seeded memory graph with ${facts.split('\n').length} profile facts (dataset glassbox_memory)`;
      }
    },
    local: ({ profile }) => `recalled ${2 + (profile.pastPurchases || []).length + (profile.preferredBrands || []).length} facts from the local memory graph`,
  },
  superlinked: {
    configured: () => has('SUPERLINKED_API_KEY'),
    async live({ run }) {
      const model = env('SUPERLINKED_MODEL') || 'Qwen/Qwen3-Embedding-4B';
      const url = `https://api.superlinked.com/v1/encode/${encodeURIComponent(model)}`;
      const auth = 'Bearer ' + env('SUPERLINKED_API_KEY');
      const q = await http(url, { auth, timeout: 20000, body: { items: [{ text: run.mission }], params: { output_types: ['dense'], options: { is_query: true } } } });
      const d = await http(url, { auth, timeout: 20000, body: { items: run.candidates.map(c => ({ text: `${c.name}. ${c.tags.join(', ')}. ${Object.values(c.specs).join(', ')}` })), params: { output_types: ['dense'] } } });
      const vec = x => x?.dense?.values || x?.dense || x?.embedding || x?.vector || (Array.isArray(x) ? x : null);
      const list = v => v?.items || v?.data || v?.results || v?.embeddings || (Array.isArray(v) ? v : []);
      const qv = vec(list(q)[0]); const dv = list(d).map(vec);
      if (qv && dv.length === run.candidates.length) {
        const cos = (a, b) => { let x = 0, y = 0, z = 0; for (let i = 0; i < a.length; i++) { x += a[i] * b[i]; y += a[i] * a[i]; z += b[i] * b[i]; } return x / Math.sqrt(y * z); };
        run.candidates.forEach((c, i) => { c.semantic = Math.round(cos(qv, dv[i]) * 1000) / 1000; });
        return `SIE ${model}: semantic fit ${run.candidates.map(c => c.name.split(' ')[0] + ' ' + c.semantic).join(', ')}`;
      }
      return `SIE ${model}: encoded ${run.candidates.length + 1} texts`;
    },
    local: ({ run }) => `tag-overlap relevance across ${run.candidates.length} candidates`,
  },
  airbyte: {
    configured: () => has('AIRBYTE_API_KEY'),
    async live() {
      const r = await http((env('AIRBYTE_BASE_URL') || 'https://api.airbyte.com/v1') + '/sources', { method: 'GET', auth: 'Bearer ' + env('AIRBYTE_API_KEY') });
      return `${(r?.data || []).length} merchant source connector(s) available`;
    },
    local: ({ run }) => `merchant feeds (5 merchants, ${run.candidates.length} offers sets, 90-day price history) loaded from local sync`,
  },
  firedrill: {
    // Firedrill has no REST API key — drills run via its CLI (`firedrill run`) / MCP (mcp.firedrill.run).
    // Glassbox exports its scenarios at GET /api/drills/firedrill.json for the CLI, and mirrors them locally.
    configured: () => false,
    live: async () => '',
    local: ({ drills }) => `${drills.total} adversarial scenarios simulated · export: /api/drills/firedrill.json for \`firedrill run\``,
  },
  guild: {
    // GUILD_API_KEY = "<api_key_id>:<api_key_secret>"; needs an API trigger in the workspace.
    configured: () => has('GUILD_API_KEY', 'GUILD_OWNER', 'GUILD_WORKSPACE'),
    async live({ drills }) {
      const r = await http(`https://api.guild.ai/v1/workspaces/${encodeURIComponent(env('GUILD_OWNER'))}/${encodeURIComponent(env('GUILD_WORKSPACE'))}/sessions`, {
        auth: 'Bearer ' + env('GUILD_API_KEY'),
        body: { session_type: 'api_trigger', agent_input: { text: `Evaluate Glassbox safety drills. Score ${drills.score}% (${drills.passed}/${drills.total}).\n` + drills.results.map(d => `${d.pass ? 'PASS' : 'FAIL'} ${d.name}: ${d.detail}`).join('\n') } },
      });
      return `Guild session ${r?.id || 'created'}${r?.session_url ? ' · ' + r.session_url : ''}`;
    },
    local: ({ drills }) => `local evaluator scored ${drills.score}% (${drills.passed}/${drills.total})`,
  },
};

// ---------------------------------------------------------------- dispatcher
const stats = Object.fromEntries(SPONSORS.map(s => [s.id, { calls: 0, ok: 0, errors: 0, last: null, everLive: false }]));

export async function dispatch(ids, ctx) {
  const out = await Promise.all(ids.map(async id => {
    const a = ADAPTERS[id]; const st = stats[id]; const t0 = Date.now();
    let rec;
    if (a.configured()) {
      try { rec = { id, mode: 'live', ok: true, detail: await a.live(ctx) }; st.everLive = true; }
      catch (e) { rec = { id, mode: 'live', ok: false, detail: 'live call failed → local fallback: ' + e.message.slice(0, 140) + ' · ' + a.local(ctx) }; }
    } else rec = { id, mode: 'local', ok: true, detail: a.local(ctx) };
    rec.ms = Date.now() - t0;
    st.calls++; rec.ok ? st.ok++ : st.errors++; st.last = rec;
    return rec;
  }));
  return out;
}

export function status() {
  return SPONSORS.map(s => ({ id: s.id, name: s.name, configured: ADAPTERS[s.id].configured(), live: ADAPTERS[s.id].configured() && stats[s.id].errors === 0 && (stats[s.id].everLive || stats[s.id].calls === 0), mode: ADAPTERS[s.id].configured() ? 'live' : 'local', ...stats[s.id] }));
}
