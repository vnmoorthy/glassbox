import { planRun, approveRun, rejectRun, cancelOrder, chooseAlternative, verifyLedger, toMarkdownReceipt, applyPurchaseToProfile } from './engine.js';
import { DEFAULT_PROFILE, MERCHANTS, PRODUCTS } from './catalog.js';
import { SPONSORS, STAGE_SPONSORS } from './sponsors.js';
import { runDrills } from './drills.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Number(n || 0).toFixed(2);
const short = h => h ? h.slice(0, 10) + '…' + h.slice(-6) : '';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------- API adapter: server mode, or fully in-browser local mode ----------------
const LS = 'glassbox:v1';
const local = {
  read() { try { return JSON.parse(localStorage.getItem(LS)) || null; } catch { return null; } },
  write(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch {} },
  db() { let d = this.read(); if (!d) { d = { profile: structuredClone(DEFAULT_PROFILE), runs: {} }; this.write(d); } return d; },
};
const api = {
  mode: 'local', stack: null,
  async init() {
    try { const r = await fetch('api/health', { cache: 'no-store' }); if (r.ok && (r.headers.get('content-type') || '').includes('json')) this.mode = 'server'; } catch {}
  },
  async req(method, url, body) {
    const r = await fetch('api/' + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  },
  async profile() { return this.mode === 'server' ? this.req('GET', 'profile') : local.db().profile; },
  async saveProfile(p) { if (this.mode === 'server') return this.req('PUT', 'profile', p); const d = local.db(); d.profile = { ...d.profile, ...p, policy: { ...d.profile.policy, ...p.policy } }; local.write(d); return d.profile; },
  async resetProfile() { if (this.mode === 'server') return this.req('POST', 'profile/reset'); const d = local.db(); d.profile = structuredClone(DEFAULT_PROFILE); local.write(d); return d.profile; },
  async runs() { if (this.mode === 'server') return this.req('GET', 'runs?full=1'); return Object.values(local.db().runs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  async run(id) { return this.mode === 'server' ? this.req('GET', 'runs/' + id) : local.db().runs[id]; },
  async localMut(id, fn) { const d = local.db(); const run = await fn(d.runs[id], d); d.runs[run.id] = run; local.write(d); return run; },
  async plan(mission) {
    if (this.mode === 'server') return this.req('POST', 'runs', { mission });
    const d = local.db(); const run = await planRun(mission, d.profile); d.runs[run.id] = run; local.write(d); return run;
  },
  async approve(id) { return this.mode === 'server' ? this.req('POST', `runs/${id}/approve`) : this.localMut(id, async (r, d) => { const out = await approveRun(r, d.profile); applyPurchaseToProfile(d.profile, out); return out; }); },
  async reject(id) { return this.mode === 'server' ? this.req('POST', `runs/${id}/reject`, { reason: 'Declined by user' }) : this.localMut(id, r => rejectRun(r, 'Declined by user')); },
  async choose(id, productId) { return this.mode === 'server' ? this.req('POST', `runs/${id}/choose`, { productId }) : this.localMut(id, (r, d) => chooseAlternative(r, productId, d.profile)); },
  async cancel(id) { return this.mode === 'server' ? this.req('POST', `runs/${id}/cancel`) : this.localMut(id, async (r, d) => { const out = await cancelOrder(r); const pp = d.profile.pastPurchases.find(x => x.runId === id); if (pp) pp.outcome = 'cancelled'; return out; }); },
  async clear() { if (this.mode === 'server') return this.req('DELETE', 'runs'); const d = local.db(); d.runs = {}; local.write(d); },
  async integrations() { if (this.mode === 'server') return this.req('GET', 'integrations'); return SPONSORS.map(s => ({ id: s.id, live: false, configured: false, mode: 'local', calls: 0, last: null })); },
  async ping() { return this.mode === 'server' ? this.req('POST', 'integrations/ping') : this.integrations(); },
  async drills() { if (this.mode === 'server') return this.req('POST', 'drills'); return runDrills(DEFAULT_PROFILE); },
};

// ---------------- state ----------------
const state = { profile: null, run: null, runs: [], ledgerRunId: null, tampered: null, stack: [], timer: null };

// ---------------- icons ----------------
const ICONS = {
  headphones: '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/></svg>',
  'running-shoes': '<svg viewBox="0 0 24 24"><path d="M3 16c0-3 1-6 2-8l4 2c2 1 3 0 4-1l2 3c2 2 5 2 6 4v2H3z"/><path d="M3 19h18"/></svg>',
  'carry-on': '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="14" rx="2"/><path d="M9 6V3h6v3M10 10v6M14 10v6M8 20v1M16 20v1"/></svg>',
  espresso: '<svg viewBox="0 0 24 24"><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/></svg>',
  backpack: '<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 4V3h6v1M9 14h6v4H9z"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>',
};
const productCat = id => PRODUCTS.find(p => p.id === id)?.category || 'headphones';
const pimg = (c, cls = '') => `<div class="pimg ${cls}" style="background:radial-gradient(circle at 30% 25%,hsla(${c.hue},90%,70%,.9),hsla(${(c.hue + 50) % 360},80%,45%,.85) 60%,hsla(${(c.hue + 90) % 360},70%,25%,.9))">${ICONS[productCat(c.productId || c.id)]}</div>`;

// ---------------- helpers ----------------
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }
function download(name, text, type = 'application/json') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function sponsorTags(type) {
  const ids = STAGE_SPONSORS[type] || [];
  if (!ids.length) return '';
  return `<span class="sponsor-tags">${ids.map(id => { const s = SPONSORS.find(x => x.id === id); const st = state.stack.find(x => x.id === id); return `<span class="stag ${st?.live ? 'live' : ''}" title="${esc(s.role)}${st?.live ? ' · live' : ' · local adapter'}">${esc(s.name)}</span>`; }).join('')}</span>`;
}
const stepIcon = e => e.actor === 'user' ? '✓' : e.status === 'fail' ? '✕' : e.status === 'warn' ? '!' : '✓';

// ---------------- navigation ----------------
function show(view) {
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'orders') renderOrders();
  if (view === 'ledger') renderLedgerView();
  if (view === 'memory') renderMemory();
  if (view === 'stack') renderStack();
  if (view === 'drills' && !$('#drillList').children.length) renderDrillsIdle();
  $('main').scrollTop = 0;
}
$$('.nav-btn').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));

// ---------------- agent view ----------------
const EXAMPLES = [
  'Noise-cancelling headphones for long flights under $300',
  'Running shoes for marathon training by Friday',
  'Carry-on that fits budget airlines in Europe',
  'Espresso machine for lattes, beginner friendly',
  'Waterproof laptop backpack, eco materials',
];
$('#chips').innerHTML = EXAMPLES.map(e => `<button type="button" class="chip">${esc(e)}</button>`).join('');
$$('#chips .chip').forEach(c => c.addEventListener('click', () => { $('#mission').value = c.textContent; $('#mission').focus(); }));
$('#mission').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) { e.preventDefault(); $('#composer').requestSubmit(); } });
$('#composer').addEventListener('submit', async e => {
  e.preventDefault();
  const mission = $('#mission').value.trim();
  if (!mission) { $('#mission').focus(); toast('Tell the agent what to buy'); return; }
  $('#runBtn').disabled = true;
  try {
    $('#hero').classList.add('hidden');
    $('#workspace').classList.remove('hidden');
    $('#wsMission').textContent = '“' + mission + '”';
    setStatus('planning');
    $('#steps').innerHTML = '<li class="step thinking"><span class="ico"></span><div class="t">Thinking…</div><div class="s">Reading your memory, rules and the market</div></li>';
    $('#decision').innerHTML = '';
    $('#comparePanel').classList.add('hidden');
    const run = await api.plan(mission);
    state.run = run;
    await animateTrace(run.ledger);
    renderDecision();
    refreshStats();
  } catch (err) { toast('Error: ' + err.message); $('#steps').innerHTML = ''; }
  finally { $('#runBtn').disabled = false; }
});
$('#newMission').addEventListener('click', () => { clearInterval(state.timer); $('#workspace').classList.add('hidden'); $('#hero').classList.remove('hidden'); $('#mission').value = ''; $('#mission').focus(); });

function setStatus(s) { const c = $('#wsStatus'); c.className = 'status-chip ' + s; c.textContent = s.replace('_', ' '); }

function callTags(e) {
  return `<span class="sponsor-tags">${(e.data?.calls || []).map(c => `<span class="stag ${c.mode === 'live' && c.ok ? 'live' : ''}" title="${c.mode} · ${c.ms}ms">${esc(SPONSORS.find(s => s.id === c.id)?.name || c.id)}${c.mode === 'live' && c.ok ? ' ●' : ''}</span>`).join('')}</span>`;
}
function stepHTML(e) {
  const cls = e.actor === 'user' ? 'user' : e.status;
  if (e.type === 'stack.dispatched') return `<li class="step ${cls}" data-seq="${e.seq}"><span class="ico">⇄</span><div class="t">${esc(e.title)} <span class="ty">${esc(e.type)}</span></div><div class="s">${esc(e.summary)}</div><div style="margin-top:4px">${callTags(e)}</div><div class="hash">#${e.seq} · ${short(e.hash)}</div></li>`;
  return `<li class="step ${cls}" data-seq="${e.seq}"><span class="ico">${stepIcon(e)}</span>
    <div class="t">${esc(e.title)} <span class="ty">${esc(e.type)}</span> ${sponsorTags(e.type)}</div>
    <div class="s">${esc(e.summary)}</div><div class="hash">#${e.seq} · ${short(e.hash)}</div></li>`;
}
async function animateTrace(ledger, from = 0) {
  const ol = $('#steps');
  if (from === 0) ol.innerHTML = '';
  ol.querySelector('.thinking')?.remove();
  for (const e of ledger.slice(from)) {
    ol.insertAdjacentHTML('beforeend', stepHTML(e));
    ol.lastElementChild.addEventListener('click', () => openEvent(e));
    $('#traceCount').textContent = `${ledger.length} events · hash-chained`;
    ol.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    await sleep(e.type.startsWith('candidate') ? 160 : 300);
  }
  $('#traceCount').textContent = `${ledger.length} events · hash-chained`;
}

function renderDecision() {
  const run = state.run; const d = $('#decision');
  setStatus(run.status);
  clearInterval(state.timer);
  if (run.status === 'needs_input' || run.status === 'no_match') {
    d.innerHTML = `<div class="notice panel"><h3>${run.status === 'no_match' ? 'I won’t buy anything that breaks your rules' : 'I need a bit more detail'}</h3><p class="muted" style="font-size:13.5px">${esc(run.error)}</p><div class="btn-row" style="margin-top:10px"><button class="btn" id="tryAgain">Edit mission</button><button class="btn ghost" data-goto="memory">Adjust rules</button></div></div>`;
    $('#tryAgain').onclick = () => { $('#newMission').click(); $('#mission').value = run.mission; };
    d.querySelector('[data-goto]').onclick = () => show('memory');
    renderCandidates();
    return;
  }
  const rec = run.recommendation; const top = run.candidates.find(c => c.productId === rec.productId);
  const recHTML = `<div class="panel rec">
    <div class="rec-top">${pimg(top)}
      <div><div class="eyebrow">Recommended · ${esc(top.brand)}</div><h3>${esc(top.name)}</h3>
        <div class="price">${money(rec.subtotal)}<small>+ ${money(rec.tax)} tax · ${esc(rec.offer.merchantName)}</small></div>
        <div class="muted" style="margin-top:4px">${top.adjRating}★ adjusted · ${top.reviews.toLocaleString()} reviews · ships ${rec.offer.shipDays}d · ${rec.offer.returnDays}-day returns</div></div>
      <div class="ring" style="--v:${rec.score}"><b>${rec.score}</b><span>agent score</span></div></div>
    ${rec.narrative ? `<p style="padding:0 20px;margin:0 0 10px;color:#dfe3ff;font-size:13.5px">“${esc(rec.narrative)}” <span class="stag live">Arcee</span></p>` : ''}
    <ul class="why">${rec.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    <div class="meta-row">${Object.entries(top.specs).map(([k, v]) => `<span class="tag">${esc(k)}: ${esc(v)}</span>`).join('')}${top.flags.map(f => `<span class="tag warn">⚠ ${esc(f)}</span>`).join('')}</div>
  </div>`;
  let actHTML = '';
  if (run.status === 'awaiting_approval') {
    const m = run.mandate;
    actHTML = `<div class="panel mandate"><div class="panel-head">✍️ Spending mandate — your approval required <span class="countdown" id="countdown"></span></div>
      <dl class="kv"><dt>Mandate ID</dt><dd class="mono">${esc(m.id)}</dd><dt>Item</dt><dd>${esc(rec.name)}</dd><dt>Merchant</dt><dd>${esc(rec.offer.merchantName)} · trust ${rec.offer.trust}/100</dd>
      <dt>Max amount</dt><dd><b>${money(m.maxAmount)}</b> USD</dd><dt>Pay with</dt><dd>${esc(m.payment)}</dd><dt>Ship to</dt><dd>${esc(m.shipTo)}</dd></dl>
      <ul class="checks">${m.checks.map(c => `<li><span class="${c.pass ? 'p' : 'f'}">${c.pass ? '✓' : '✗'}</span>${esc(c.rule)} <span class="muted">${esc(c.detail)}</span></li>`).join('')}</ul>
      ${m.requiresOverride ? '<p class="tag bad" style="display:block;margin:0 0 12px">A guardrail failed. Approving overrides it, and that override is written to the ledger.</p>' : ''}
      <div class="btn-row"><button class="btn success lg" id="approveBtn">Approve & buy · ${money(m.maxAmount)}</button><button class="btn ghost danger" id="rejectBtn">Decline</button></div></div>`;
  } else if (run.order) {
    const o = run.order;
    actHTML = `<div class="panel receipt"><div class="seal">SEALED<br/>${run.ledger.length} EVT</div>
      <div class="big">${o.status === 'cancelled' ? '↩︎ Order cancelled' : '✓ Order confirmed'}</div>
      <dl class="kv" style="margin-top:12px"><dt>Order</dt><dd class="mono">${esc(o.id)}</dd><dt>Charged</dt><dd><b>${money(o.total)}</b> to ${esc(o.payment)}${o.status === 'cancelled' ? ' · <span style="color:var(--green)">refunded</span>' : ''}</dd>
      <dt>Arrives</dt><dd>${new Date(o.eta).toDateString()} · tracking <span class="mono">${esc(o.tracking)}</span></dd><dt>Return by</dt><dd>${new Date(o.returnBy).toDateString()}</dd>
      <dt>Mandate</dt><dd class="mono">${esc(o.mandateId)}</dd><dt>Ledger root</dt><dd class="mono">${short(run.root)}</dd></dl>
      <div class="btn-row"><button class="btn primary" id="viewTrail">View audit trail</button><button class="btn" id="dlReceipt">Download receipt</button>${o.status === 'confirmed' ? '<button class="btn ghost danger" id="cancelBtn">Cancel order</button>' : ''}</div></div>`;
  } else {
    actHTML = `<div class="notice panel"><h3>${run.status === 'declined' ? 'Declined — nothing was purchased' : 'Run ' + esc(run.status)}</h3><p class="muted">The decision and your response are on the ledger.</p><div class="btn-row"><button class="btn" id="viewTrail">View audit trail</button></div></div>`;
  }
  d.innerHTML = recHTML + actHTML;
  if (run.status === 'awaiting_approval') {
    const exp = new Date(run.mandate.expiresAt).getTime();
    const tick = () => { const s = Math.max(0, Math.round((exp - Date.now()) / 1000)); const el = $('#countdown'); if (el) el.textContent = `expires in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    tick(); state.timer = setInterval(tick, 1000);
    $('#approveBtn').onclick = () => act('approve');
    $('#rejectBtn').onclick = () => act('reject');
  }
  $('#viewTrail') && ($('#viewTrail').onclick = () => { state.ledgerRunId = run.id; show('ledger'); });
  $('#dlReceipt') && ($('#dlReceipt').onclick = () => download(`glassbox-${run.order.id}.md`, toMarkdownReceipt(run), 'text/markdown'));
  $('#cancelBtn') && ($('#cancelBtn').onclick = () => act('cancel'));
  renderCandidates();
}

async function act(kind, arg) {
  const run = state.run; const before = run.ledger.length;
  try {
    $$('#decision button').forEach(b => b.disabled = true);
    if (kind === 'approve') toast('Verifying a human approved the mandate, then checking out…');
    const out = kind === 'approve' ? await api.approve(run.id) : kind === 'reject' ? await api.reject(run.id) : kind === 'cancel' ? await api.cancel(run.id) : await api.choose(run.id, arg);
    state.run = out;
    await animateTrace(out.ledger, before);
    renderDecision();
    refreshStats();
    if (kind === 'approve' && out.order) toast('Purchased ✓ ' + out.order.id);
    if (kind === 'choose') $('#decision').scrollIntoView({ behavior: 'smooth' });
  } catch (e) { toast('Error: ' + e.message); renderDecision(); }
}

function renderCandidates() {
  const run = state.run; if (!run.candidates.length) return;
  $('#comparePanel').classList.remove('hidden');
  const COLORS = { fit: '#a78bfa', quality: '#60a5fa', value: '#22d3ee', trust: '#34d399', delivery: '#fbbf24', returns: '#f472b6', personal: '#fb923c' };
  $('#cands').innerHTML = run.candidates.map((c, i) => {
    const isTop = run.recommendation && c.productId === run.recommendation.productId;
    return `<div class="cand ${isTop ? 'top' : ''} ${c.eligible ? '' : 'rejected'}" style="animation-delay:${i * 60}ms">
      <div class="cand-h">${pimg(c, 'sm')}<div><h4>${esc(c.name)}</h4><div class="muted">${c.offer ? `${money(c.offer.price)} · ${esc(c.offer.merchantName)}` : 'no eligible offer'} · ${c.adjRating}★</div></div><div class="sc" style="color:${c.eligible ? (isTop ? 'var(--cyan)' : 'var(--text)') : 'var(--red)'}">${c.score}</div></div>
      <div class="bar">${Object.entries(c.breakdown).map(([k, v]) => `<i style="width:${v}%;background:${COLORS[k]}" title="${k}: ${v}/${c.weights[k]}"></i>`).join('')}</div>
      <div class="legend">${Object.entries(c.breakdown).map(([k, v]) => `<span><b style="background:${COLORS[k]}"></b>${k} ${v}</span>`).join('')}</div>
      <ul class="reasons">
        ${isTop ? '<li class="ok">★ Recommended</li>' : ''}
        ${c.reasons.map(r => `<li class="bad">✕ ${esc(r)}</li>`).join('')}
        ${c.flags.map(r => `<li class="warn">⚠ ${esc(r)}</li>`).join('')}
        ${c.missing.length ? `<li class="warn">Missing: ${esc(c.missing.join(', '))}</li>` : ''}
        ${c.personalNotes.map(r => `<li class="ok">♥ ${esc(r)}</li>`).join('')}
        ${c.offerNotes.map(r => `<li class="bad">⊘ ${esc(r)}</li>`).join('')}
      </ul>
      ${c.eligible && !isTop && run.status === 'awaiting_approval' ? `<button class="btn ghost" data-choose="${c.productId}">Choose this instead</button>` : ''}
    </div>`;
  }).join('');
  $$('[data-choose]').forEach(b => b.onclick = () => act('choose', b.dataset.choose));
}

// ---------------- event drawer ----------------
function openEvent(e) {
  $('#drawerBody').innerHTML = `<div class="eyebrow">Ledger event #${e.seq} · ${esc(e.type)}</div><h2 style="margin:6px 0 4px">${esc(e.title)}</h2>
    <div class="muted">${esc(e.ts)} · actor: <b>${esc(e.actor)}</b> · status: <b>${esc(e.status)}</b></div>
    <p style="font-size:14px">${esc(e.summary)}</p>
    ${(STAGE_SPONSORS[e.type] || []).length ? `<div class="panel-head sub">Powered by</div><div>${sponsorTags(e.type)}</div>` : ''}${e.type === 'stack.dispatched' ? `<div class="panel-head sub">Partner calls</div><div>${callTags(e)}</div>` : ''}
    ${e.evidence?.length ? `<div class="panel-head sub">Evidence (${e.evidence.length})</div><ul class="evlist">${e.evidence.map(v => `<li><span class="src">${esc(v.source)}</span><span class="ref">${esc(v.ref)}</span><div>${esc(v.fact)}</div></li>`).join('')}</ul>` : ''}
    <div class="panel-head sub">Integrity</div>
    <div class="mono" style="word-break:break-all;font-size:11px">hash&nbsp;&nbsp;${e.hash}<br/>prev&nbsp;&nbsp;${e.prevHash}</div>
    <div class="panel-head sub">Raw event</div><pre class="json">${esc(JSON.stringify(e, null, 2))}</pre>`;
  $('#drawer').classList.add('open');
}
$('#drawerClose').onclick = () => $('#drawer').classList.remove('open');
$('#drawer').addEventListener('click', e => { if (e.target.id === 'drawer') $('#drawer').classList.remove('open'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#drawer').classList.remove('open'); });

// ---------------- orders ----------------
async function renderOrders() {
  state.runs = await api.runs();
  const list = $('#ordersList');
  if (!state.runs.length) { list.innerHTML = '<div class="empty">No runs yet. Give the agent a mission.</div>'; return; }
  list.innerHTML = state.runs.map(r => {
    const o = r.order; const name = o?.name || r.recommendation?.name || '—';
    const hue = o?.hue ?? PRODUCTS.find(p => p.name === name)?.hue ?? 240;
    const pid = o?.productId || PRODUCTS.find(p => p.name === name)?.id;
    return `<div class="panel order">${pid ? pimg({ hue, productId: pid }, 'sm') : '<div class="pimg sm" style="background:#1a1e38"></div>'}
      <div><h4>${esc(name)}</h4><div class="sub">“${esc(r.mission)}”</div>
        <div class="sub mono" style="margin-top:4px">${new Date(r.createdAt).toLocaleString()} · ${o ? esc(o.id) + ' · ' + money(o.total) : ''} · root ${short(r.root)}</div></div>
      <div class="btn-row"><span class="status-chip ${r.status}">${esc(r.status.replace('_', ' '))}</span>
        <button class="btn ghost" data-open="${r.id}">Open</button><button class="btn ghost" data-trail="${r.id}">Audit</button>
        ${o && o.status === 'confirmed' ? `<button class="btn ghost danger" data-cancel="${r.id}">Cancel</button>` : ''}</div></div>`;
  }).join('');
  $$('[data-trail]').forEach(b => b.onclick = () => { state.ledgerRunId = b.dataset.trail; show('ledger'); });
  $$('[data-open]').forEach(b => b.onclick = async () => { state.run = await api.run(b.dataset.open); show('agent'); $('#hero').classList.add('hidden'); $('#workspace').classList.remove('hidden'); $('#wsMission').textContent = '“' + state.run.mission + '”'; await animateTrace(state.run.ledger); renderDecision(); });
  $$('[data-cancel]').forEach(b => b.onclick = async () => { try { await api.cancel(b.dataset.cancel); toast('Order cancelled & refunded'); renderOrders(); refreshStats(); } catch (e) { toast(e.message); } });
}
$('#clearRuns').onclick = async () => { if (!confirm('Delete all runs and their ledgers from this demo?')) return; await api.clear(); state.run = null; renderOrders(); refreshStats(); toast('History cleared'); };

// ---------------- ledger ----------------
async function renderLedgerView() {
  state.runs = await api.runs();
  const sel = $('#runSelect');
  if (!state.runs.length) { sel.innerHTML = ''; $('#chain').innerHTML = '<div class="empty">No ledgers yet. Run a mission first.</div>'; $('#integrity').innerHTML = ''; return; }
  if (!state.ledgerRunId || !state.runs.find(r => r.id === state.ledgerRunId)) state.ledgerRunId = state.runs[0].id;
  sel.innerHTML = state.runs.map(r => `<option value="${r.id}" ${r.id === state.ledgerRunId ? 'selected' : ''}>${esc(r.mission.slice(0, 48))} — ${r.status}</option>`).join('');
  state.tampered = null;
  await drawChain();
  verify(false);
}
$('#runSelect').onchange = e => { state.ledgerRunId = e.target.value; renderLedgerView(); };
async function currentLedger() { if (state.tampered) return state.tampered; const r = await api.run(state.ledgerRunId); return r.ledger; }
async function drawChain() {
  const ledger = await currentLedger();
  $('#chain').innerHTML = ledger.map((e, i) => `<div class="block" data-seq="${e.seq}"><div class="rail"><div class="num">${e.seq}</div>${i < ledger.length - 1 ? '<div class="link"></div>' : ''}</div>
    <div class="bcard"><div class="t">${esc(e.title)} <span class="ty mono muted">${esc(e.type)}</span> ${sponsorTags(e.type)}</div><div class="muted" style="font-size:12.5px;margin-top:2px">${esc(e.summary)}</div>
    <div class="hashes"><span><b>hash</b> ${short(e.hash)}</span><span><b>prev</b> ${short(e.prevHash)}</span><span><b>actor</b> ${esc(e.actor)}</span><span><b>at</b> ${esc(e.ts.slice(11, 23))}</span></div></div></div>`).join('');
  $$('#chain .bcard').forEach((c, i) => c.onclick = () => openEvent(ledger[i]));
}
async function verify(animate = true) {
  const ledger = await currentLedger();
  const v = await verifyLedger(ledger);
  const blocks = $$('#chain .block');
  blocks.forEach(b => b.classList.remove('ok', 'bad'));
  for (let i = 0; i < v.results.length; i++) {
    const bad = v.brokenAt !== null && i >= v.brokenAt;
    blocks[i]?.classList.add(bad ? 'bad' : 'ok');
    if (animate) await sleep(45);
  }
  $('#integrity').innerHTML = v.ok
    ? `<div class="int-banner ok"><span class="big">🔒</span><div><b>Chain intact — ${v.count} events verified in your browser</b><div class="muted mono">Recomputed every SHA-256 hash with WebCrypto · root ${v.root}</div></div></div>`
    : `<div class="int-banner bad"><span class="big">⚠️</span><div><b>Tampering detected at event #${v.brokenAt}</b><div class="muted">Event #${v.brokenAt} no longer matches its hash, so every later link is broken too. The original record can’t be quietly rewritten.</div></div><button class="btn" id="restore" style="margin-left:auto">Restore original</button></div>`;
  $('#restore') && ($('#restore').onclick = async () => { state.tampered = null; await drawChain(); verify(); toast('Original ledger restored'); });
  return v;
}
$('#verifyBtn').onclick = () => verify(true);
$('#tamperBtn').onclick = async () => {
  const ledger = JSON.parse(JSON.stringify(await currentLedger()));
  const i = Math.max(1, ledger.findIndex(e => e.type === 'recommendation.made'));
  const target = ledger[i];
  target.summary = target.summary.replace(/\$[\d,.]+/, '$9.99') + ' ';
  if (target.data && target.data.total) target.data.total = 9.99;
  state.tampered = ledger;
  await drawChain();
  toast(`An attacker edited event #${i} (“${target.title}”). Verifying…`);
  await sleep(500);
  verify(true);
};
$('#exportJson').onclick = async () => { const r = await api.run(state.ledgerRunId); if (!r) return; download(`glassbox-ledger-${r.id}.json`, JSON.stringify({ run: r.id, mission: r.mission, status: r.status, root: r.root, ledger: r.ledger }, null, 2)); };
$('#exportMd').onclick = async () => { const r = await api.run(state.ledgerRunId); if (!r) return; download(`glassbox-receipt-${r.id}.md`, toMarkdownReceipt(r), 'text/markdown'); };

// ---------------- memory ----------------
async function renderMemory() {
  const p = state.profile = await api.profile();
  const f = $('#memForm');
  f.name.value = p.name; f.address.value = p.address; f.payment.value = p.payment; f.shoeSize.value = p.shoeSize || '';
  f.wearsGlasses.checked = !!p.wearsGlasses;
  f.preferredBrands.value = (p.preferredBrands || []).join(', '); f.avoidBrands.value = (p.avoidBrands || []).join(', '); f.values.value = (p.values || []).join(', ');
  f.maxPerOrder.value = p.policy.maxPerOrder; f.minMerchantTrust.value = p.policy.minMerchantTrust; f.maxFakeReviewPct.value = Math.round(p.policy.maxFakeReviewPct * 100); f.mandateTtlMinutes.value = p.policy.mandateTtlMinutes;
  $('#merchantBoxes').innerHTML = Object.values(MERCHANTS).map(m => `<label class="mbox"><input type="checkbox" value="${m.id}" ${p.policy.blockedMerchants.includes(m.id) ? 'checked' : ''}/> ${esc(m.name)} <span class="tr" style="color:${m.trust >= 85 ? 'var(--green)' : m.trust >= 60 ? 'var(--amber)' : 'var(--red)'}">${m.trust}</span></label>`).join('');
  $('#history').innerHTML = (p.pastPurchases || []).map(h => `<li><b>${esc(h.item)}</b><span class="o ${esc(h.outcome)}">${esc(h.outcome)}</span><div class="muted">${esc(h.note || '')}</div></li>`).join('') || '<li class="muted">No purchases yet</li>';
}
const list = s => s.split(',').map(x => x.trim()).filter(Boolean);
$('#saveProfile').onclick = async () => {
  const f = $('#memForm');
  const p = { name: f.name.value.trim() || 'Alex', address: f.address.value.trim(), shoeSize: f.shoeSize.value.trim(), wearsGlasses: f.wearsGlasses.checked,
    preferredBrands: list(f.preferredBrands.value), avoidBrands: list(f.avoidBrands.value), values: list(f.values.value),
    policy: { maxPerOrder: Number(f.maxPerOrder.value) || 400, minMerchantTrust: Number(f.minMerchantTrust.value) || 0, maxFakeReviewPct: (Number(f.maxFakeReviewPct.value) || 0) / 100, mandateTtlMinutes: Number(f.mandateTtlMinutes.value) || 15, blockedMerchants: $$('#merchantBoxes input:checked').map(i => i.value) } };
  state.profile = await api.saveProfile(p);
  $('#heroName').textContent = state.profile.name.split(' ')[0];
  toast('Memory & rules saved — the agent will use them on the next run');
  renderMemory();
};
$('#resetProfile').onclick = async () => { state.profile = await api.resetProfile(); renderMemory(); $('#heroName').textContent = state.profile.name.split(' ')[0]; toast('Demo profile restored'); };

// ---------------- drills ----------------
import { DRILLS } from './drills.js';
function renderDrillsIdle() {
  $('#drillScore').innerHTML = '';
  $('#drillList').innerHTML = DRILLS.map(d => `<div class="panel drill" id="drill-${d.id}"><span class="di">·</span><div><h4>${esc(d.name)}</h4><p>${esc(d.desc)}</p><p class="mono" style="font-size:11px">mission: “${esc(d.mission)}”</p></div><span class="tag">not run</span></div>`).join('');
}
$('#runDrills').onclick = async () => {
  renderDrillsIdle();
  $('#runDrills').disabled = true;
  $$('.drill').forEach(d => d.classList.add('running'));
  try {
    const res = await api.drills();
    for (const r of res.results) {
      const el = $('#drill-' + r.id); await sleep(140);
      el.classList.remove('running'); el.classList.add(r.pass ? 'pass' : 'fail');
      el.querySelector('.di').textContent = r.pass ? '✓' : '✕';
      el.querySelector('.tag').outerHTML = `<span class="tag ${r.pass ? 'ok' : 'bad'}">${r.pass ? 'PASS' : 'FAIL'} · ${r.ms}ms</span>`;
      el.querySelector('div').insertAdjacentHTML('beforeend', `<p style="color:${r.pass ? '#a7f3d0' : '#fca5a5'};font-size:12px">${esc(r.detail)}</p>`);
    }
    const ext = res.external || [];
    $('#drillScore').innerHTML = `<div class="panel"><b style="color:${res.score === 100 ? 'var(--green)' : 'var(--amber)'}">${res.score}%</b><span>safety score</span></div><div class="panel"><b>${res.passed}/${res.total}</b><span>drills passed</span></div>
      ${ext.map(x => `<div class="panel"><b style="font-size:15px">${esc(x.name)}</b><span>${x.live ? 'reported live ✓' : 'local evaluator'}</span></div>`).join('')}`;
    toast(`Drills complete: ${res.passed}/${res.total} passed`);
  } catch (e) { toast('Error: ' + e.message); }
  finally { $('#runDrills').disabled = false; }
};

// ---------------- stack ----------------
async function loadStack() { try { state.stack = await api.integrations(); } catch { state.stack = []; } $('#liveCount').textContent = `${state.stack.filter(s => s.live).length}/${SPONSORS.length}`; }
async function renderStack(data) {
  if (data) state.stack = data; else await loadStack();
  $('#stackGrid').innerHTML = SPONSORS.map(s => {
    const st = state.stack.find(x => x.id === s.id) || {};
    return `<div class="panel sp"><div class="sp-h"><div class="sp-logo" style="background:${s.color}">${esc(s.name[0].toUpperCase())}</div><div><h4>${esc(s.name)}</h4><div class="role">${esc(s.role)}</div></div>
      <span class="st tag ${st.live ? 'ok' : st.configured ? 'warn' : ''}">${st.live ? '● live' : st.configured ? 'configured' : 'local adapter'}</span></div>
      <p>${esc(s.what)}</p>
      <div class="env">env: ${s.env.map(esc).join(', ')}</div>
      <div class="env">steps: ${s.stages.map(esc).join(', ')}</div>
      ${st.calls ? `<div class="last">${st.calls} call(s) · last: ${esc(st.last?.detail || '')}${st.last?.ms != null ? ' · ' + st.last.ms + 'ms' : ''}</div>` : ''}</div>`;
  }).join('');
  $('#liveCount').textContent = `${state.stack.filter(s => s.live).length}/${SPONSORS.length}`;
}
$('#pingStack').onclick = async () => { $('#pingStack').disabled = true; try { const d = await api.ping(); await renderStack(d); toast(api.mode === 'server' ? 'Pinged every configured integration' : 'Local mode: start the server to reach live integrations'); } catch (e) { toast(e.message); } finally { $('#pingStack').disabled = false; } };

// ---------------- stats ----------------
async function refreshStats() {
  const runs = await api.runs();
  const full = api.mode === 'server' ? runs : runs;
  $('#statRuns').textContent = runs.length;
  $('#statEvents').textContent = runs.reduce((a, r) => a + (r.events ?? r.ledger?.length ?? 0), 0);
  const spent = runs.filter(r => r.order && r.order.status === 'confirmed').reduce((a, r) => a + r.order.total, 0);
  $('#statSpent').textContent = '$' + Math.round(spent);
  $('#ordersCount').textContent = full.filter(r => r.order).length;
}

// ---------------- boot ----------------
(async function boot() {
  await api.init();
  const mb = $('#modeBadge');
  mb.classList.toggle('server', api.mode === 'server');
  $('#modeText').textContent = api.mode === 'server' ? 'Server API · ledger on disk' : 'Local mode · runs in your browser';
  state.profile = await api.profile();
  $('#heroName').textContent = state.profile.name.split(' ')[0];
  await loadStack();
  refreshStats();
  const q = new URLSearchParams(location.search);
  if (q.get('view')) show(q.get('view'));
  if (q.get('q')) { $('#mission').value = q.get('q'); $('#composer').requestSubmit(); } else $('#mission').focus();
})();
