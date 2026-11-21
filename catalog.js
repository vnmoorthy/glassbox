// Glassbox sandbox catalog — fictional brands & merchants so every number is safe to demo.
// Each product carries the raw evidence the agent reasons over: offers per merchant,
// review authenticity, and price history. Nothing here is hidden from the audit trail.

export const MERCHANTS = {
  northwind: { id: 'northwind', name: 'Northwind Market', trust: 96, notes: 'Verified seller, 0.2% dispute rate, PCI-DSS attested' },
  parcelpoint: { id: 'parcelpoint', name: 'Parcelpoint', trust: 91, notes: 'Verified seller, 0.6% dispute rate' },
  shoprocket: { id: 'shoprocket', name: 'ShopRocket', trust: 86, notes: 'Verified seller, slower support SLA' },
  bargainbay: { id: 'bargainbay', name: 'BargainBay', trust: 64, notes: 'Marketplace reseller, mixed fulfilment history' },
  dealdrop: { id: 'dealdrop', name: 'DealDrop Outlet', trust: 41, notes: 'Flagged: chargeback spike in last 30 days' },
};

export const CATEGORIES = {
  headphones: { label: 'Headphones', keywords: ['headphone', 'headphones', 'earbud', 'earbuds', 'headset', 'noise-cancelling headphones'], defaultBudget: 300 },
  'running-shoes': { label: 'Running shoes', keywords: ['running shoe', 'running shoes', 'sneaker', 'sneakers', 'trainers', 'marathon', 'shoes', 'runner'], defaultBudget: 180 },
  'carry-on': { label: 'Carry-on luggage', keywords: ['carry-on', 'carry on', 'carryon', 'luggage', 'suitcase', 'roller bag'], defaultBudget: 250 },
  espresso: { label: 'Espresso machines', keywords: ['espresso', 'coffee machine', 'coffee maker', 'latte', 'cappuccino'], defaultBudget: 500 },
  backpack: { label: 'Backpacks', keywords: ['backpack', 'laptop bag', 'daypack', 'rucksack'], defaultBudget: 150 },
  keyboard: { label: 'Keyboards', keywords: ['keyboard', 'mechanical', 'keycaps'], defaultBudget: 160 },
};

// keyword -> requirement tag
export const FEATURE_KEYWORDS = [
  [['noise cancelling', 'noise-cancelling', 'noise canceling', 'noise-canceling', 'noise cancellation', 'anc', 'flight', 'flights', 'plane', 'travel', 'commute'], 'anc'],
  [['glasses', 'spectacles'], 'glasses-friendly'],
  [['lightweight', 'light weight', 'ultralight', 'light '], 'lightweight'],
  [['battery', 'long flight', 'long-haul', 'all day'], 'long-battery'],
  [['multipoint', 'two devices', 'laptop and phone'], 'multipoint'],
  [['wide', 'wide feet', 'wide fit'], 'wide-fit'],
  [['marathon', 'long run', 'cushion', 'cushioned', 'plush'], 'cushioned'],
  [['trail'], 'trail'],
  [['race', 'racing', 'carbon', 'fast'], 'carbon-plate'],
  [['under seat', 'underseat', 'personal item'], 'underseat'],
  [['international', 'intl', 'europe', 'budget airline', 'budget airlines', 'ryanair', 'easyjet'], 'intl-size'],
  [['hard shell', 'hardshell', 'hardside', 'hard-side'], 'hardshell'],
  [['laptop', '16 inch', '16"'], 'laptop-sleeve'],
  [['waterproof', 'rain', 'water resistant'], 'waterproof'],
  [['beginner', 'easy', 'simple'], 'beginner'],
  [['milk', 'latte', 'lattes', 'cappuccino', 'cappuccinos', 'steam', 'flat white'], 'steam-wand'],
  [['grinder', 'built-in grinder', 'beans'], 'built-in-grinder'],
  [['quiet', 'silent', 'office'], 'quiet'],
  [['wireless', 'bluetooth'], 'wireless'],
  [['mac', 'macbook'], 'mac-layout'],
  [['sustainable', 'eco', 'recycled', 'green'], 'eco'],
];

const h = (avg30, low90) => ({ avg30, low90 });

export const PRODUCTS = [
  // ---------------- Headphones ----------------
  { id: 'aur-q9', name: 'Auralis Q9 Wireless ANC', brand: 'Auralis', category: 'headphones', hue: 258,
    tags: ['anc', 'wireless', 'glasses-friendly', 'long-battery', 'multipoint', 'lightweight', 'over-ear'],
    rating: 4.7, reviews: 18420, fakePct: 0.04, price: h(289, 259),
    specs: { Battery: '40 h', Weight: '248 g', ANC: 'Adaptive, 8 mics', Clamp: 'Low-force, glasses-safe' },
    offers: [
      { merchant: 'northwind', price: 279, shipDays: 2, returnDays: 30 },
      { merchant: 'parcelpoint', price: 284, shipDays: 1, returnDays: 30 },
      { merchant: 'dealdrop', price: 199, shipDays: 6, returnDays: 0 },
    ] },
  { id: 'son-h7', name: 'Sonance H7 Studio', brand: 'Sonance', category: 'headphones', hue: 200,
    tags: ['anc', 'wireless', 'long-battery', 'over-ear'],
    rating: 4.6, reviews: 9310, fakePct: 0.07, price: h(249, 229),
    specs: { Battery: '30 h', Weight: '312 g', ANC: 'Hybrid', Clamp: 'Firm' },
    offers: [
      { merchant: 'shoprocket', price: 279, shipDays: 3, returnDays: 30 },
      { merchant: 'bargainbay', price: 262, shipDays: 5, returnDays: 14 },
    ] },
  { id: 'hush-air', name: 'Hushwave Air Lite', brand: 'Hushwave', category: 'headphones', hue: 160,
    tags: ['anc', 'wireless', 'lightweight', 'glasses-friendly', 'eco', 'over-ear'],
    rating: 4.4, reviews: 4120, fakePct: 0.05, price: h(189, 169),
    specs: { Battery: '28 h', Weight: '205 g', ANC: 'Standard', Materials: '62% recycled plastics' },
    offers: [
      { merchant: 'northwind', price: 179, shipDays: 2, returnDays: 60 },
      { merchant: 'parcelpoint', price: 185, shipDays: 2, returnDays: 30 },
    ] },
  { id: 'beat-x', name: 'Beatline X Pro', brand: 'Beatline', category: 'headphones', hue: 0,
    tags: ['anc', 'wireless', 'over-ear'],
    rating: 4.8, reviews: 22950, fakePct: 0.46, price: h(229, 219),
    specs: { Battery: '22 h', Weight: '290 g', ANC: 'Standard' },
    offers: [
      { merchant: 'bargainbay', price: 214, shipDays: 4, returnDays: 14 },
      { merchant: 'dealdrop', price: 149, shipDays: 8, returnDays: 0 },
    ] },
  { id: 'kes-elite', name: 'Kestrel Elite Reference', brand: 'Kestrel', category: 'headphones', hue: 30,
    tags: ['anc', 'wireless', 'long-battery', 'multipoint', 'over-ear'],
    rating: 4.8, reviews: 6020, fakePct: 0.03, price: h(399, 379),
    specs: { Battery: '50 h', Weight: '330 g', ANC: 'Adaptive, 12 mics' },
    offers: [ { merchant: 'northwind', price: 449, shipDays: 2, returnDays: 30 } ] },

  // ---------------- Running shoes ----------------
  { id: 'str-cloud', name: 'Stride Cloudrun 4', brand: 'Stride', category: 'running-shoes', hue: 190,
    tags: ['cushioned', 'wide-fit', 'lightweight'],
    rating: 4.7, reviews: 7340, fakePct: 0.04, price: h(150, 135),
    specs: { Drop: '8 mm', Weight: '262 g', Widths: 'D, 2E, 4E' },
    offers: [
      { merchant: 'northwind', price: 139, shipDays: 2, returnDays: 60 },
      { merchant: 'shoprocket', price: 144, shipDays: 3, returnDays: 30 },
    ] },
  { id: 'kes-strata', name: 'Kestrel Strata Carbon', brand: 'Kestrel', category: 'running-shoes', hue: 30,
    tags: ['carbon-plate', 'lightweight', 'cushioned'],
    rating: 4.6, reviews: 3810, fakePct: 0.05, price: h(220, 199),
    specs: { Drop: '6 mm', Weight: '205 g', Widths: 'D only' },
    offers: [ { merchant: 'parcelpoint', price: 210, shipDays: 2, returnDays: 30 } ] },
  { id: 'ter-ridge', name: 'Terrain Ridge GTX', brand: 'Terrain', category: 'running-shoes', hue: 120,
    tags: ['trail', 'waterproof', 'wide-fit', 'cushioned'],
    rating: 4.5, reviews: 2950, fakePct: 0.06, price: h(165, 149),
    specs: { Drop: '5 mm', Weight: '310 g', Widths: 'D, 2E' },
    offers: [ { merchant: 'shoprocket', price: 159, shipDays: 4, returnDays: 30 }, { merchant: 'bargainbay', price: 141, shipDays: 7, returnDays: 14 } ] },
  { id: 'eco-loop', name: 'Loop Eco Runner', brand: 'Loop', category: 'running-shoes', hue: 145,
    tags: ['eco', 'lightweight', 'wide-fit'],
    rating: 4.3, reviews: 1870, fakePct: 0.08, price: h(128, 115),
    specs: { Drop: '10 mm', Weight: '240 g', Upper: '100% recycled knit' },
    offers: [ { merchant: 'northwind', price: 119, shipDays: 3, returnDays: 60 } ] },

  // ---------------- Carry-on ----------------
  { id: 'vey-pro', name: 'Voyagr Pro Hardside 21"', brand: 'Voyagr', category: 'carry-on', hue: 220,
    tags: ['hardshell', 'intl-size', 'lightweight', 'laptop-sleeve'],
    rating: 4.7, reviews: 5410, fakePct: 0.03, price: h(235, 210),
    specs: { Size: '55×35×23 cm', Weight: '2.6 kg', Warranty: 'Lifetime' },
    offers: [ { merchant: 'northwind', price: 225, shipDays: 2, returnDays: 100 }, { merchant: 'parcelpoint', price: 231, shipDays: 1, returnDays: 30 } ] },
  { id: 'nom-soft', name: 'Nomad Softside Expandable', brand: 'Nomad', category: 'carry-on', hue: 15,
    tags: ['laptop-sleeve', 'waterproof'],
    rating: 4.5, reviews: 3200, fakePct: 0.05, price: h(169, 149),
    specs: { Size: '56×36×25 cm', Weight: '3.1 kg', Warranty: '10 years' },
    offers: [ { merchant: 'shoprocket', price: 159, shipDays: 3, returnDays: 30 } ] },
  { id: 'air-under', name: 'Airlite Underseat Spinner', brand: 'Airlite', category: 'carry-on', hue: 330,
    tags: ['underseat', 'intl-size', 'lightweight', 'hardshell'],
    rating: 4.4, reviews: 2210, fakePct: 0.09, price: h(119, 99),
    specs: { Size: '40×30×20 cm', Weight: '1.9 kg', Warranty: '5 years' },
    offers: [ { merchant: 'parcelpoint', price: 129, shipDays: 2, returnDays: 30 }, { merchant: 'dealdrop', price: 79, shipDays: 9, returnDays: 0 } ] },

  // ---------------- Espresso ----------------
  { id: 'cre-duo', name: 'Crema Duo Pro w/ Grinder', brand: 'Crema', category: 'espresso', hue: 25,
    tags: ['built-in-grinder', 'steam-wand', 'beginner'],
    rating: 4.6, reviews: 8800, fakePct: 0.05, price: h(549, 499),
    specs: { Pressure: '15 bar', Grinder: 'Conical burr, 30 settings', Tank: '2 L' },
    offers: [ { merchant: 'northwind', price: 489, shipDays: 3, returnDays: 30 }, { merchant: 'parcelpoint', price: 499, shipDays: 2, returnDays: 30 } ] },
  { id: 'bar-mini', name: 'Barista Mini', brand: 'Barista', category: 'espresso', hue: 350,
    tags: ['steam-wand', 'beginner', 'quiet'],
    rating: 4.4, reviews: 5100, fakePct: 0.06, price: h(299, 279),
    specs: { Pressure: '15 bar', Grinder: 'None', Tank: '1.2 L' },
    offers: [ { merchant: 'shoprocket', price: 289, shipDays: 3, returnDays: 30 } ] },
  { id: 'ita-lever', name: 'Italia Lever Classic', brand: 'Italia', category: 'espresso', hue: 45,
    tags: ['steam-wand'],
    rating: 4.8, reviews: 1200, fakePct: 0.02, price: h(899, 849),
    specs: { Pressure: 'Manual lever', Grinder: 'None', Tank: '1.8 L' },
    offers: [ { merchant: 'northwind', price: 879, shipDays: 4, returnDays: 30 } ] },

  // ---------------- Backpack ----------------
  { id: 'pak-commuter', name: 'Packform Commuter 22L', brand: 'Packform', category: 'backpack', hue: 205,
    tags: ['laptop-sleeve', 'waterproof', 'lightweight', 'eco'],
    rating: 4.7, reviews: 6200, fakePct: 0.03, price: h(139, 119),
    specs: { Volume: '22 L', Laptop: 'Up to 16"', Fabric: 'Recycled X-Pac' },
    offers: [ { merchant: 'northwind', price: 129, shipDays: 2, returnDays: 60 } ] },
  { id: 'trk-30', name: 'Trekline 30 Travel', brand: 'Trekline', category: 'backpack', hue: 95,
    tags: ['laptop-sleeve', 'underseat', 'intl-size'],
    rating: 4.5, reviews: 3900, fakePct: 0.07, price: h(149, 129),
    specs: { Volume: '30 L', Laptop: 'Up to 15"', Fabric: '840D nylon' },
    offers: [ { merchant: 'parcelpoint', price: 145, shipDays: 2, returnDays: 30 } ] },

  // ---------------- Keyboard ----------------
  { id: 'kb-low', name: 'Keyloft Low Profile 75', brand: 'Keyloft', category: 'keyboard', hue: 270,
    tags: ['wireless', 'mac-layout', 'quiet'],
    rating: 4.6, reviews: 4400, fakePct: 0.04, price: h(129, 109),
    specs: { Switches: 'Silent tactile', Battery: '200 h', Layout: '75% Mac/Win' },
    offers: [ { merchant: 'northwind', price: 119, shipDays: 2, returnDays: 30 } ] },
  { id: 'kb-click', name: 'Clacker Pro TKL', brand: 'Clacker', category: 'keyboard', hue: 5,
    tags: ['wireless'],
    rating: 4.7, reviews: 7100, fakePct: 0.38, price: h(99, 89),
    specs: { Switches: 'Clicky blue', Battery: '80 h', Layout: 'TKL Win' },
    offers: [ { merchant: 'bargainbay', price: 89, shipDays: 5, returnDays: 14 } ] },
];

export const DEFAULT_PROFILE = {
  name: 'Alex Rivera',
  address: '500 Howard St, San Francisco, CA 94105',
  payment: 'Sandbox Visa •••• 4242',
  wearsGlasses: true,
  shoeSize: '10.5 Wide (2E)',
  preferredBrands: ['Auralis', 'Northwind'],
  avoidBrands: ['Beatline'],
  values: ['eco'],
  pastPurchases: [
    { item: 'Kestrel Strata Carbon', outcome: 'returned', note: 'Too narrow — runs tight on wide feet', brand: 'Kestrel', category: 'running-shoes' },
    { item: 'Packform Commuter 22L', outcome: 'kept', note: 'Loved it, 5★', brand: 'Packform', category: 'backpack' },
  ],
  policy: {
    maxPerOrder: 400,
    autoApproveUnder: 0,
    minMerchantTrust: 70,
    blockedMerchants: ['dealdrop'],
    maxFakeReviewPct: 0.3,
    mandateTtlMinutes: 15,
  },
};

export const TAX_RATE = 0.08625; // San Francisco
