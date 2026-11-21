// Glassbox agent engine — isomorphic (runs in Node 20+ and modern browsers).
// Pipeline: perceive → recall → source → verify → rank → govern → mandate → act → receipt.
// Every step is appended to a SHA-256 hash-chained ledger so the run is tamper-evident.

import { PRODUCTS, MERCHANTS, CATEGORIES, FEATURE_KEYWORDS, TAX_RATE } from './catalog.js';

// ---------- hashing ----------
const enc = new TextEncoder();
export function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
}
export async function sha256(str) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const GENESIS = '0'.repeat(64);

async function append(run, type, title, { summary = '', evidence = [], data = {}, actor = 'agent', status = 'ok' } = {}) {
  const prev = run.ledger.length ? run.ledger[run.ledger.length - 1].hash : GENESIS;
  // deep-clone so later mutations of live objects (mandate, order) can never rewrite history
  const ev = JSON.parse(JSON.stringify({ seq: run.ledger.length, ts: new Date(run.clock++).toISOString(), runId: run.id, actor, type, title, summary, status, evidence, data, prevHash: prev }));
  ev.hash = await sha256(canonical(ev));
  run.ledger.push(ev);
  return ev;
}

export const appendEvent = (...a) => append(...a);

export async function verifyLedger(ledger) {
  let prev = GENESIS;
  const results = [];
  for (const ev of ledger) {
    const { hash, ...body } = ev;
    const recomputed = await sha256(canonical(body));
    const linkOk = ev.prevHash === prev;
    const hashOk = recomputed === hash;
    results.push({ seq: ev.seq, ok: linkOk && hashOk, linkOk, hashOk, recomputed });
    prev = hash;
  }
  const firstBad = results.find(r => !r.ok);
  return { ok: !firstBad, brokenAt: firstBad ? firstBad.seq : null, count: ledger.length, root: ledger.length ? ledger[ledger.length - 1].hash : GENESIS, results };
}

// ---------- helpers ----------
const money = n => '$' + Number(n).toFixed(2);
const pct = n => Math.round(n * 100) + '%';
const rid = (p) => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text, k) => new RegExp('(^|[^a-z0-9])' + reEsc(k.trim()) + '($|[^a-z0-9])').test(text);
export function parseIntent(mission, now = new Date()) {
  const text = ' ' + mission.toLowerCase() + ' ';
  // category
  let category = null, catHit = null;
  for (const [id, c] of Object.entries(CATEGORIES)) {
    for (const k of c.keywords) if (hasWord(text, k) && (!catHit || k.length > catHit.length)) { category = id; catHit = k; }
  }
  // budget
  let budget = null, budgetSource = null;
  const m = text.match(/(?:under|below|less than|max(?:imum)?|budget(?: of)?|up to|<)\s*\$?\s*(\d[\d,]*)/) || text.match(/\$\s?(\d[\d,]*)/);
  if (m) { budget = Number(m[1].replace(/,/g, '')); budgetSource = 'stated'; }
  // deadline
  let deadlineDays = null, deadlineLabel = null;
  const dm = text.match(/in (\d+) days?/);
  if (dm) { deadlineDays = Number(dm[1]); deadlineLabel = `within ${dm[1]} days`; }
  else if (/tomorrow|asap|overnight/.test(text)) { deadlineDays = 1; deadlineLabel = 'by tomorrow'; }
  else if (/this week/.test(text)) { deadlineDays = 5; deadlineLabel = 'this week'; }
  else if (/weekend/.test(text)) { const d = (6 - now.getDay() + 7) % 7 || 7; deadlineDays = d; deadlineLabel = 'by the weekend'; }
  else {
    for (let i = 0; i < 7; i++) if (text.includes('by ' + DAYS[i]) || text.includes('before ' + DAYS[i])) {
      const d = (i - now.getDay() + 7) % 7 || 7; deadlineDays = d; deadlineLabel = 'by ' + DAYS[i][0].toUpperCase() + DAYS[i].slice(1);
    }
  }
  // features
  const requirements = [];
  for (const [kws, tag] of FEATURE_KEYWORDS) {
    const hit = kws.find(k => hasWord(text, k));
    if (hit && !requirements.find(r => r.tag === tag)) requirements.push({ tag, source: 'mission', cue: hit.trim() });
  }
  const gift = /\bgift\b|for my (mom|dad|mother|father|wife|husband|partner|friend|sister|brother|boss)/.test(text);
  return { category, catHit, budget, budgetSource, deadlineDays, deadlineLabel, requirements, gift };
}

function adjRating(p) {
  const genuine = p.reviews * (1 - p.fakePct);
  return (p.rating * genuine + 4.0 * 200) / (genuine + 200);
}

// ---------- PLAN ----------
export async function planRun(mission, profile, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const run = { id: rid('run'), mission, createdAt: now.toISOString(), clock: now.getTime(), status: 'planning', ledger: [], candidates: [], recommendation: null, mandate: null, order: null };
  const pol = profile.policy;

  await append(run, 'mission.received', 'Mission received', { actor: 'user', summary: `“${mission}”`, data: { mission, user: profile.name } });

  // 1. Perceive
  const intent = parseIntent(mission, now);
  if (!intent.category) {
    await append(run, 'intent.unclear', 'Could not map mission to a known category', { status: 'fail', summary: 'Try mentioning what to buy, e.g. headphones, running shoes, carry-on, espresso machine, backpack or keyboard.', data: { intent } });
    run.status = 'needs_input';
    run.error = 'I couldn’t tell what product you want. Try “headphones under $300 for flights”.';
    return finalize(run);
  }
  const cat = CATEGORIES[intent.category];
  await append(run, 'intent.parsed', 'Understood the task', {
    summary: `Buy ${cat.label.toLowerCase()}${intent.budget ? ` under ${money(intent.budget)}` : ''}${intent.deadlineLabel ? `, delivered ${intent.deadlineLabel}` : ''}${intent.requirements.length ? ` · needs: ${intent.requirements.map(r => r.tag).join(', ')}` : ''}`,
    evidence: [{ source: 'Mission text', ref: 'nlp:keywords', fact: `category cue “${intent.catHit}”` }, ...intent.requirements.map(r => ({ source: 'Mission text', ref: 'nlp:feature', fact: `“${r.cue}” → ${r.tag}` }))],
    data: { intent },
  });

  // 2. Recall personal memory
  const memEvidence = [];
  const requirements = [...intent.requirements];
  if (intent.category === 'headphones' && profile.wearsGlasses && !requirements.find(r => r.tag === 'glasses-friendly')) {
    requirements.push({ tag: 'glasses-friendly', source: 'memory', cue: 'You wear glasses' });
    memEvidence.push({ source: 'Personal memory', ref: 'profile.wearsGlasses', fact: 'Wears glasses → prefer low clamp-force, glasses-friendly pads' });
  }
  if (intent.category === 'running-shoes' && /wide|2e|4e/i.test(profile.shoeSize || '') && !requirements.find(r => r.tag === 'wide-fit')) {
    requirements.push({ tag: 'wide-fit', source: 'memory', cue: `Shoe size ${profile.shoeSize}` });
    memEvidence.push({ source: 'Personal memory', ref: 'profile.shoeSize', fact: `Shoe size ${profile.shoeSize} → wide-fit required` });
  }
  for (const v of profile.values || []) memEvidence.push({ source: 'Personal memory', ref: 'profile.values', fact: `Values: ${v} → small bonus for ${v}-tagged products` });
  for (const b of profile.preferredBrands || []) memEvidence.push({ source: 'Personal memory', ref: 'profile.preferredBrands', fact: `Likes ${b}` });
  for (const b of profile.avoidBrands || []) memEvidence.push({ source: 'Personal memory', ref: 'profile.avoidBrands', fact: `Never buy ${b}` });
  const pastInCat = (profile.pastPurchases || []).filter(p => p.category === intent.category);
  for (const p of pastInCat) memEvidence.push({ source: 'Purchase history', ref: 'history:' + p.item, fact: `${p.item} — ${p.outcome}${p.note ? ` (${p.note})` : ''}` });
  let budget = intent.budget, budgetSource = intent.budgetSource;
  if (!budget) { budget = cat.defaultBudget; budgetSource = 'default'; memEvidence.push({ source: 'Personal memory', ref: 'budget.default', fact: `No budget stated → using your usual ${cat.label.toLowerCase()} budget ${money(budget)}` }); }
  await append(run, 'memory.recalled', 'Recalled what I know about you', { summary: `${memEvidence.length} relevant facts from memory & history`, evidence: memEvidence, data: { requirements, budget, budgetSource } });

  // 3. Policy load
  await append(run, 'policy.loaded', 'Loaded your spending guardrails', {
    summary: `Max ${money(pol.maxPerOrder)}/order · merchant trust ≥ ${pol.minMerchantTrust} · fake reviews ≤ ${pct(pol.maxFakeReviewPct)} · approval always required`,
    evidence: [
      { source: 'Policy', ref: 'policy.maxPerOrder', fact: money(pol.maxPerOrder) },
      { source: 'Policy', ref: 'policy.blockedMerchants', fact: (pol.blockedMerchants || []).map(id => MERCHANTS[id]?.name || id).join(', ') || 'none' },
      { source: 'Policy', ref: 'policy.minMerchantTrust', fact: String(pol.minMerchantTrust) },
    ],
    data: { policy: pol },
  });

  // 4. Source
  const pool = PRODUCTS.filter(p => p.category === intent.category);
  const merchantsTouched = new Set(pool.flatMap(p => p.offers.map(o => o.merchant)));
  await append(run, 'sources.queried', `Queried ${merchantsTouched.size} merchants, ${pool.length} products`, {
    summary: `Pulled live offers, price history and review audits for ${pool.length} ${cat.label.toLowerCase()}`,
    evidence: [...merchantsTouched].map(id => ({ source: MERCHANTS[id].name, ref: `merchant:${id}`, fact: `trust ${MERCHANTS[id].trust}/100 — ${MERCHANTS[id].notes}` })),
    data: { productIds: pool.map(p => p.id) },
  });

  // 5. Verify + score each product
  const reqTags = requirements.map(r => r.tag);
  for (const p of pool) {
    const reasons = [];
    const flags = [];
    if ((profile.avoidBrands || []).map(s => s.toLowerCase()).includes(p.brand.toLowerCase())) reasons.push(`Brand ${p.brand} is on your never-buy list`);
    if (p.fakePct > pol.maxFakeReviewPct) reasons.push(`Review manipulation suspected: ${pct(p.fakePct)} of reviews flagged inauthentic`);
    const offerNotes = [];
    const eligible = p.offers.filter(o => {
      const mm = MERCHANTS[o.merchant];
      if ((pol.blockedMerchants || []).includes(o.merchant)) { offerNotes.push(`${mm.name}: blocked by your policy`); return false; }
      if (mm.trust < pol.minMerchantTrust) { offerNotes.push(`${mm.name}: trust ${mm.trust} < ${pol.minMerchantTrust}`); return false; }
      if (intent.deadlineDays && o.shipDays > intent.deadlineDays) { offerNotes.push(`${mm.name}: ships in ${o.shipDays}d, misses ${intent.deadlineLabel}`); return false; }
      return true;
    });
    const best = eligible.sort((a, b) => a.price - b.price || a.shipDays - b.shipDays)[0] || null;
    if (!best) reasons.push(p.offers.length ? 'No offer passes merchant/delivery checks' : 'No offers');
    else if (best.price > budget) reasons.push(`Over budget: ${money(best.price)} vs ${money(budget)}`);
    // price integrity
    let priceNote = null;
    if (best) {
      const delta = (best.price - p.price.avg30) / p.price.avg30;
      if (delta > 0.08) { flags.push(`Price is ${pct(delta)} above its 30-day average (${money(p.price.avg30)})`); priceNote = 'spiked'; }
      else if (delta < -0.02) priceNote = `${pct(-delta)} below 30-day avg`;
      else priceNote = 'at 30-day avg';
    }
    // scoring
    const matched = reqTags.filter(t => p.tags.includes(t));
    const missing = reqTags.filter(t => !p.tags.includes(t));
    const fit = reqTags.length ? matched.length / reqTags.length : 1;
    const value = best ? Math.max(0, Math.min(1, 1 - (best.price / budget) * 0.75)) + 0.25 * (best.price <= budget ? 1 : 0) : 0;
    const quality = Math.max(0, Math.min(1, (adjRating(p) - 3.5) / 1.5));
    const trust = best ? MERCHANTS[best.merchant].trust / 100 : 0;
    const delivery = best ? (intent.deadlineDays ? 1 : Math.max(0, 1 - (best.shipDays - 1) / 7)) : 0;
    const returns = best ? Math.min(1, best.returnDays / 60) : 0;
    let personal = 0.5; const personalNotes = [];
    if ((profile.preferredBrands || []).includes(p.brand)) { personal += 0.4; personalNotes.push(`you like ${p.brand}`); }
    for (const v of profile.values || []) if (p.tags.includes(v)) { personal += 0.3; personalNotes.push(`matches your ${v} preference`); }
    const returned = (profile.pastPurchases || []).find(x => x.brand === p.brand && x.outcome === 'returned' && x.category === p.category);
    if (returned) { personal -= 0.6; personalNotes.push(`you returned a ${p.brand} before (${returned.note})`); }
    if (priceNote === 'spiked') personal -= 0.2;
    personal = Math.max(0, Math.min(1, personal));
    const W = { fit: 30, quality: 22, value: 16, trust: 10, delivery: 8, returns: 6, personal: 8 };
    const parts = { fit, quality, value, trust, delivery, returns, personal };
    const breakdown = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v * W[k] * 10) / 10]));
    const score = Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0));
    const cand = {
      productId: p.id, name: p.name, brand: p.brand, hue: p.hue, specs: p.specs, tags: p.tags,
      rating: p.rating, adjRating: Math.round(adjRating(p) * 100) / 100, reviews: p.reviews, fakePct: p.fakePct,
      priceHistory: p.price, offer: best ? { ...best, merchantName: MERCHANTS[best.merchant].name, trust: MERCHANTS[best.merchant].trust } : null,
      allOffers: p.offers.map(o => ({ ...o, merchantName: MERCHANTS[o.merchant].name, trust: MERCHANTS[o.merchant].trust })),
      matched, missing, score, breakdown, weights: W, eligible: reasons.length === 0, reasons, flags, offerNotes, priceNote, personalNotes,
    };
    run.candidates.push(cand);
    const ev = [
      { source: 'Review audit', ref: `reviews:${p.id}`, fact: `${p.rating}★ from ${p.reviews.toLocaleString('en-US')} reviews · ${pct(p.fakePct)} flagged · adjusted ${cand.adjRating}★` },
      { source: 'Price history', ref: `price:${p.id}`, fact: `30-day avg ${money(p.price.avg30)} · 90-day low ${money(p.price.low90)}` },
      ...p.offers.map(o => ({ source: MERCHANTS[o.merchant].name, ref: `offer:${o.merchant}:${p.id}`, fact: `${money(o.price)} · ships ${o.shipDays}d · ${o.returnDays ? o.returnDays + '-day returns' : 'no returns'}` })),
    ];
    await append(run, cand.eligible ? 'candidate.scored' : 'candidate.rejected', `${cand.eligible ? 'Scored' : 'Rejected'}: ${p.name}`, {
      status: cand.eligible ? (flags.length ? 'warn' : 'ok') : 'fail',
      summary: cand.eligible ? `Score ${score}/100 · ${matched.length}/${reqTags.length || 0} must-haves · best offer ${money(best.price)} at ${MERCHANTS[best.merchant].name}` : reasons.join(' · '),
      evidence: ev, data: { productId: p.id, score, breakdown, reasons, flags, matched, missing, offerNotes },
    });
  }

  // 6. Rank
  run.candidates.sort((a, b) => (b.eligible - a.eligible) || b.score - a.score);
  const eligible = run.candidates.filter(c => c.eligible);
  await append(run, 'ranking.completed', 'Ranked the options', {
    summary: eligible.length ? eligible.map((c, i) => `#${i + 1} ${c.name} (${c.score})`).join(' · ') : 'Nothing passed every check',
    data: { order: run.candidates.map(c => ({ id: c.productId, score: c.score, eligible: c.eligible })) },
  });
  if (!eligible.length) {
    run.status = 'no_match';
    run.error = 'No product passed your guardrails. Try a higher budget or a looser deadline.';
    await append(run, 'run.halted', 'Stopped — refusing to buy something that breaks your rules', { status: 'fail', summary: run.error });
    return finalize(run);
  }

  const top = eligible[0];
  await recommend(run, top, eligible[1], requirements, budget, profile, intent);
  return finalize(run);
}

async function recommend(run, top, runnerUp, requirements, budget, profile, intent) {
  const pol = profile.policy;
  const subtotal = top.offer.price;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const shipping = 0;
  const total = Math.round((subtotal + tax + shipping) * 100) / 100;
  const why = [];
  if (top.matched.length) why.push(`Meets ${top.matched.length}/${requirements.length} must-haves: ${top.matched.join(', ')}`);
  why.push(`${top.adjRating}★ after discounting ${pct(top.fakePct)} suspicious reviews`);
  why.push(`${money(top.offer.price)} at ${top.offer.merchantName} (trust ${top.offer.trust}) — ${top.priceNote}`);
  if (top.personalNotes.length) why.push('Personal fit: ' + top.personalNotes.join('; '));
  if (runnerUp) why.push(`Beat ${runnerUp.name} by ${top.score - runnerUp.score} pts`);
  const rejected = run.candidates.filter(c => !c.eligible);
  if (rejected.length) why.push(`Rejected ${rejected.length}: ${rejected.map(c => c.name.split(' ').slice(0, 2).join(' ')).join(', ')}`);
  run.recommendation = { productId: top.productId, name: top.name, score: top.score, why, subtotal, tax, shipping, total, offer: top.offer };
  await append(run, 'recommendation.made', `Recommend: ${top.name}`, {
    summary: `${money(total)} incl. tax from ${top.offer.merchantName}, arrives in ${top.offer.shipDays} day${top.offer.shipDays > 1 ? 's' : ''}`,
    evidence: why.map(w => ({ source: 'Reasoning', ref: 'why', fact: w })),
    data: { productId: top.productId, total, score: top.score },
  });
  // 7. Govern
  const checks = [
    { rule: 'Order total ≤ max per order', pass: total <= pol.maxPerOrder, detail: `${money(total)} vs ${money(pol.maxPerOrder)}` },
    { rule: 'Within mission budget', pass: subtotal <= budget, detail: `${money(subtotal)} vs ${money(budget)}` },
    { rule: 'Merchant trust ≥ minimum', pass: top.offer.trust >= pol.minMerchantTrust, detail: `${top.offer.trust} vs ${pol.minMerchantTrust}` },
    { rule: 'Merchant not blocked', pass: !(pol.blockedMerchants || []).includes(top.offer.merchant), detail: top.offer.merchantName },
    { rule: 'Review authenticity OK', pass: top.fakePct <= pol.maxFakeReviewPct, detail: `${pct(top.fakePct)} flagged` },
    { rule: 'Returnable', pass: top.offer.returnDays > 0, detail: `${top.offer.returnDays}-day window` },
  ];
  const allPass = checks.every(c => c.pass);
  await append(run, 'policy.checked', allPass ? 'All guardrails passed' : 'Guardrail exceeded — needs your explicit override', {
    status: allPass ? 'ok' : 'warn', summary: checks.map(c => `${c.pass ? '✓' : '✗'} ${c.rule}`).join(' · '),
    evidence: checks.map(c => ({ source: 'Policy engine', ref: 'rule', fact: `${c.pass ? 'PASS' : 'FAIL'} — ${c.rule}: ${c.detail}` })), data: { checks },
  });
  // 8. Mandate
  const expiresAt = new Date(run.clock + pol.mandateTtlMinutes * 60000).toISOString();
  const mandateBody = { runId: run.id, productId: top.productId, merchant: top.offer.merchant, maxAmount: total, currency: 'USD', payment: profile.payment, shipTo: profile.address, expiresAt };
  const mandateId = 'mdt_' + (await sha256(canonical(mandateBody))).slice(0, 16);
  run.mandate = { id: mandateId, ...mandateBody, checks, requiresOverride: !allPass, state: 'pending' };
  await append(run, 'mandate.requested', 'Asked you to approve a spending mandate', {
    status: 'warn', summary: `Up to ${money(total)} at ${top.offer.merchantName} · expires ${pol.mandateTtlMinutes} min · id ${mandateId}`,
    data: { mandate: run.mandate },
  });
  run.status = 'awaiting_approval';
}

// switch to a different eligible candidate before approval
export async function chooseAlternative(run, productId, profile) {
  if (run.status !== 'awaiting_approval') throw new Error('Run is not awaiting approval');
  const cand = run.candidates.find(c => c.productId === productId && c.eligible);
  if (!cand) throw new Error('That option is not eligible');
  run.clock = Math.max(run.clock, Date.now());
  await append(run, 'mandate.revoked', 'You picked a different option', { actor: 'user', status: 'warn', summary: `Revoked ${run.mandate.id}; switching to ${cand.name}`, data: { from: run.recommendation.productId, to: productId } });
  const intent = run.ledger.find(e => e.type === 'memory.recalled').data;
  const runnerUp = run.candidates.filter(c => c.eligible && c.productId !== productId)[0];
  await recommend(run, cand, runnerUp, intent.requirements, intent.budget, profile, null);
  return finalize(run);
}

// ---------- ACT ----------
export async function approveRun(run, profile, hooks = {}) {
  if (run.status !== 'awaiting_approval') throw new Error('Run is not awaiting approval (status: ' + run.status + ')');
  run.clock = Math.max(run.clock, Date.now());
  const m = run.mandate;
  if (new Date(run.clock) > new Date(m.expiresAt)) {
    m.state = 'expired';
    await append(run, 'mandate.expired', 'Mandate expired — not buying', { status: 'fail', summary: `Expired at ${m.expiresAt}` });
    run.status = 'expired';
    return finalize(run);
  }
  m.state = 'approved';
  await append(run, 'mandate.approved', 'You approved the mandate', { actor: 'user', summary: `Approved ${m.id} for up to ${money(m.maxAmount)}${m.requiresOverride ? ' (with guardrail override)' : ''}`, data: { mandateId: m.id } });
  if (hooks.afterApprove) await hooks.afterApprove(run);
  // re-check price at checkout (anti bait-and-switch)
  const p = PRODUCTS.find(x => x.id === m.productId);
  const offer = p.offers.find(o => o.merchant === m.merchant);
  const rec = run.recommendation;
  const live = offer.price;
  await append(run, 'checkout.price_rechecked', live <= rec.subtotal ? 'Price re-verified at checkout' : 'Price changed at checkout', {
    status: live <= rec.subtotal ? 'ok' : 'fail', summary: `Quoted ${money(rec.subtotal)} → live ${money(live)} at ${MERCHANTS[m.merchant].name}`,
    evidence: [{ source: MERCHANTS[m.merchant].name, ref: `offer:${m.merchant}:${p.id}`, fact: `live price ${money(live)}` }],
  });
  if (live > rec.subtotal) { run.status = 'aborted'; await append(run, 'run.halted', 'Aborted: price exceeded mandate', { status: 'fail' }); return finalize(run); }
  const orderId = 'GBX-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
  const eta = new Date(run.clock + offer.shipDays * 86400000);
  run.order = {
    id: orderId, productId: p.id, name: p.name, brand: p.brand, hue: p.hue, merchant: m.merchant, merchantName: MERCHANTS[m.merchant].name,
    subtotal: rec.subtotal, tax: rec.tax, shipping: rec.shipping, total: rec.total, payment: profile.payment, shipTo: profile.address,
    placedAt: new Date(run.clock).toISOString(), eta: eta.toISOString(), returnBy: new Date(run.clock + offer.returnDays * 86400000).toISOString(),
    tracking: '1Z' + Math.random().toString(36).slice(2, 12).toUpperCase(), status: 'confirmed', mandateId: m.id,
  };
  await append(run, 'order.placed', `Order placed with ${MERCHANTS[m.merchant].name}`, {
    summary: `${orderId} · ${money(rec.total)} charged to ${profile.payment} · ETA ${eta.toDateString()}`,
    evidence: [{ source: MERCHANTS[m.merchant].name + ' Checkout API (sandbox)', ref: 'order:' + orderId, fact: 'HTTP 201 Created' }],
    data: { order: run.order },
  });
  await append(run, 'memory.updated', 'Saved this purchase to your memory', { summary: `Remembered: bought ${p.name}. I’ll ask how it went after delivery.`, data: { item: p.name, brand: p.brand, category: p.category } });
  run.status = 'completed';
  if (hooks.beforeSeal) await hooks.beforeSeal(run);
  const v = await verifyLedger(run.ledger);
  run.receipt = { root: v.root, events: v.count };
  await append(run, 'receipt.issued', 'Receipt sealed', { summary: `Ledger of ${v.count} events sealed under root ${v.root.slice(0, 16)}…`, data: { root: v.root } });
  return finalize(run);
}

export async function rejectRun(run, reason = 'User declined') {
  if (run.status !== 'awaiting_approval') throw new Error('Run is not awaiting approval');
  run.clock = Math.max(run.clock, Date.now());
  run.mandate.state = 'rejected';
  await append(run, 'mandate.rejected', 'You declined — nothing was purchased', { actor: 'user', status: 'warn', summary: reason });
  run.status = 'declined';
  return finalize(run);
}

export async function cancelOrder(run) {
  if (!run.order || run.order.status !== 'confirmed') throw new Error('No cancellable order');
  run.clock = Math.max(run.clock, Date.now());
  run.order.status = 'cancelled';
  run.order.refund = run.order.total;
  await append(run, 'order.cancelled', 'Order cancelled & refund issued', { actor: 'user', status: 'warn', summary: `${run.order.id} cancelled · ${money(run.order.total)} refunded to ${run.order.payment}`, evidence: [{ source: run.order.merchantName + ' API (sandbox)', ref: 'refund:' + run.order.id, fact: 'HTTP 200 refund_pending' }] });
  run.status = 'cancelled';
  return finalize(run);
}

function finalize(run) {
  run.updatedAt = new Date().toISOString();
  run.root = run.ledger.length ? run.ledger[run.ledger.length - 1].hash : GENESIS;
  return run;
}

export function applyPurchaseToProfile(profile, run) {
  if (!run.order) return profile;
  const p = PRODUCTS.find(x => x.id === run.order.productId);
  const exists = (profile.pastPurchases || []).find(x => x.runId === run.id);
  if (!exists) profile.pastPurchases = [{ item: p.name, outcome: 'ordered', note: `via Glassbox · ${run.order.id}`, brand: p.brand, category: p.category, runId: run.id }, ...(profile.pastPurchases || [])];
  return profile;
}

export function toMarkdownReceipt(run) {
  const lines = [`# Glassbox receipt — ${run.order ? run.order.id : run.id}`, '', `Mission: “${run.mission}”`, `Status: **${run.status}**`, `Ledger root: \`${run.root}\``, ''];
  if (run.order) lines.push(`## Order`, `- ${run.order.name} from ${run.order.merchantName}`, `- Total ${money(run.order.total)} (subtotal ${money(run.order.subtotal)}, tax ${money(run.order.tax)})`, `- Mandate ${run.order.mandateId}`, `- ETA ${run.order.eta.slice(0, 10)}`, '');
  lines.push('## Audit trail', '');
  for (const e of run.ledger) {
    lines.push(`### ${e.seq}. ${e.title}  \`${e.type}\``, `${e.ts} · actor: ${e.actor} · status: ${e.status}`, '', e.summary || '', '');
    for (const ev of e.evidence || []) lines.push(`- **${ev.source}** (${ev.ref}): ${ev.fact}`);
    lines.push('', `hash \`${e.hash}\` ← prev \`${e.prevHash.slice(0, 16)}…\``, '');
  }
  return lines.join('\n');
}
