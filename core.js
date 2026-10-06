/* Typical Incremental Game: core logic (no DOM, so it can be simulated in Node). */
(function (root) {
'use strict';

/* ---------- Big numbers: {m: mantissa in [1,10), e: exponent (a normal JS number)} ---------- */
const Z = { m: 0, e: 0 };
const norm = (m, e) => { if (!(m > 0) || !isFinite(m) || !isFinite(e)) return Z; const k = Math.floor(Math.log10(m)); return { m: m / 10 ** k, e: e + k }; };
const num = x => norm(x, 0);
const fromLog = l => { if (!isFinite(l)) return Z; const e = Math.floor(l); return { m: 10 ** (l - e), e }; };
const lg = a => a.m > 0 ? Math.log10(a.m) + a.e : -Infinity;
const mul = (a, b) => a.m && b.m ? norm(a.m * b.m, a.e + b.e) : Z;
const add = (a, b) => { if (!a.m) return b; if (!b.m) return a; if (a.e < b.e) [a, b] = [b, a]; const d = a.e - b.e; return d > 16 ? a : norm(a.m + b.m * 10 ** -d, a.e); };
const sub = (a, b) => { if (!b.m) return a; const d = a.e - b.e; return d > 16 ? a : norm(a.m - b.m * 10 ** -d, a.e); };
const cmp = (a, b) => !a.m || !b.m ? Math.sign(a.m - b.m) : a.e !== b.e ? Math.sign(a.e - b.e) : Math.sign(a.m - b.m);
const floorD = a => a.e > 15 ? a : num(Math.floor(a.m * 10 ** a.e + 1e-9));
const okD = x => x && typeof x.m === 'number' && typeof x.e === 'number' && isFinite(x.m) && isFinite(x.e) && x.m >= 0 ? (x.m ? norm(x.m, x.e) : Z) : Z;
function fmt(a) {
  if (!a.m) return '0';
  if (a.e < 6) return (a.m * 10 ** a.e).toLocaleString('en-US', { maximumFractionDigits: a.e < 2 ? 2 : 0 });
  let m = a.m.toFixed(2), e = a.e; if (m === '10.00') { m = '1.00'; e++; }
  if (e < 1e6) return m + 'e' + e.toLocaleString('en-US');
  const x = Math.floor(Math.log10(e));
  return m + 'e' + (e / 10 ** x).toFixed(2) + 'e' + x;
}
const ONE = num(1);

/* ---------- Config: tune the game here ---------- */
const DIM_BASE = [10, 100, 1e4, 1e6, 1e9, 1e13, 1e18, 1e24];
const DIM_STEP = [1e3, 1e4, 1e5, 1e6, 1e8, 1e10, 1e12, 1e15];
const TICK_LOG = Math.log10(1.1245);
const INF_CAP = Math.log10(Number.MAX_VALUE), ETERNITY_CAP = 3008, ENDGAME = 1e9;   // log10 values
const BREAK_INF_COST = 3, BREAK_ETERNITY_COST = 3;
const OFFLINE_MAX = 12 * 3600;
/* req: log10 of the previous currency needed. g: gain exponent. k: boost exponent. */
const LAYERS = [
  { n: 'Prestige',    c: 'Prestige Points',      s: 'PP',    req: 5,      g: 0.6,   k: 0.5,   col: '#4fc3f7', from: 'points this run' },
  { n: 'Rebirth',     c: 'Rebirth Points',       s: 'RP',    req: 6,      g: 0.6,   k: 0.8, col: '#81c784', from: 'Prestige Points' },
  { n: 'Reincarnate', c: 'Reincarnation Points', s: 'RIP',   req: 50,     g: 0.55,   k: 1.1,   col: '#ffb74d', from: 'Rebirth Points' },
  { n: 'Sacrifice',   c: 'Sacrifice Points',     s: 'SP',    req: 100,    g: 0.6,   k: 2.2,   col: '#e57373', from: 'Reincarnation Points' },
  { n: 'Infinity',    c: 'Infinity Points',      s: 'IP',    req: INF_CAP, g: 0.4, k: 3.5,   col: '#ba68c8', from: 'Sacrifice Points' },
  { n: 'Eternity',    c: 'Eternity Points',      s: 'EP',    req: ETERNITY_CAP, g: 0.35, k: 6, col: '#fff176', from: 'Infinity Points' },
  { n: 'Supernova',   c: 'Stars',                s: 'Stars', req: 1e5,    g: 1e-05, k: 50,  col: '#ffffff', from: 'Eternity Points' },
];
/* Effects: ['all',_,x] global x | ['tick',_,x] | ['dim', i|'*', x] | ['gain', layer|'*', x] | ['cost',_,orders] | ['start',_,pts] | ['auto', layer,_] */
const N = (id, name, c, cost, parent, fx) => ({ id, name, c, cost, parent, fx });
const NODES = [
  N('p1', 'Spark',            0, 1,    null, [['all', 0, 2]]),
  N('p2', 'Quick fingers',    0, 3,    'p1', [['dim', 0, 5]]),
  N('p3', 'Head start',       0, 10,   'p2', [['start', 0, 1e3]]),
  N('r1', 'Double fold',      1, 1,    'p3', [['gain', 0, 2]]),
  N('r2', 'Wider roots',      1, 5,    'r1', [['dim', '*', 3]]),
  N('r3', 'Auto-Prestige',    1, 25,   'r2', [['auto', 0, 0]]),
  N('c1', 'Echoes',           2, 1,    'r3', [['all', 0, 5]]),
  N('c2', 'Bargain bin',      2, 10,   'c1', [['cost', 0, 6]]),
  N('c3', 'Auto-Rebirth',     2, 100,  'c2', [['auto', 1, 0]]),
  N('s1', 'Offering',         3, 1,    'c3', [['gain', 1, 3]]),
  N('s2', 'Overclock',        3, 20,   's1', [['tick', 0, 2]]),
  N('s3', 'Auto-Reincarnate', 3, 1e3,  's2', [['auto', 2, 0]]),
  N('i1', 'Beyond the edge',  4, 1,    's3', [['all', 0, 10]]),
  N('i2', 'Deeper offering',  4, 10,   'i1', [['gain', 3, 5]]),
  N('i3', 'Auto-Sacrifice',   4, 100,  'i2', [['auto', 3, 0]]),
  N('e1', 'Timeless',         5, 1,    'i3', [['all', 0, 100]]),
  N('e2', 'Infinite loop',    5, 10,   'e1', [['gain', 4, 10]]),
  N('e3', 'Auto-Infinity',    5, 100,  'e2', [['auto', 4, 0]]),
  N('n1', 'Afterglow',        6, 1,    'e3', [['all', 0, 1e6]]),
  N('n2', 'Stellar forge',    6, 5,    'n1', [['gain', 5, 10]]),
  N('n3', 'Auto-Eternity',    6, 20,   'n2', [['auto', 5, 0]]),
];
const RES = [
  { id: 'a', name: 'Better scheduling',    cost: 30,   fx: [['tick', 0, 1.25]] },
  { id: 'b', name: 'Deep memory',          cost: 120,  fx: [['all', 0, 3]] },
  { id: 'c', name: 'Cache',                cost: 400,  fx: [['start', 0, 1e6]] },
  { id: 'd', name: 'Layer theory',         cost: 1500, fx: [['gain', '*', 2]] },
  { id: 'e', name: 'Dimensional folding',  cost: 6e3,  fx: [['dim', '*', 10]] },
  { id: 'f', name: 'Synergy',              cost: 3e4,  fx: [['all', 0, 50]] },
  { id: 'g', name: 'Paradox engine',       cost: 2e5,  fx: [['gain', '*', 5]] },
  { id: 'h', name: 'The last equation',    cost: 2e6,  fx: [['all', 0, 1e4]] },
];
const ACH = [
  ['A humble start',   'Reach 1,000 points.',            S => lg(S.tot) >= 3],
  ['Ticking along',    'Buy 10 tickspeed upgrades.',     S => S.tick >= 10],
  ['Prestigious',      'Prestige.',                      S => S.times[0] > 0],
  ['Reborn',           'Rebirth.',                       S => S.times[1] > 0],
  ['Again and again',  'Reincarnate.',                   S => S.times[2] > 0],
  ['The offering',     'Sacrifice.',                     S => S.times[3] > 0],
  ['Infinite',         'Go Infinite.',                   S => S.times[4] > 0],
  ['Beyond infinity',  'Break Infinity.',                S => S.bi],
  ['Eternal',          'Reach Eternity.',                S => S.times[5] > 0],
  ['Beyond eternity',  'Break Eternity.',                S => S.be],
  ['Supernova',        'Trigger a Supernova.',           S => S.times[6] > 0],
  ['Absolute',         'Reach the absolute endgame.',    S => S.end],
  ['Researcher',       'Finish a research project.',     S => S.res.length > 0],
  ['Tree hugger',      'Own 10 tree upgrades.',          S => S.nodes.length >= 10],
  ['Scholar',          'Finish all research.',           S => S.res.length >= RES.length],
  ['Completionist',    'Own 12 achievements.',           S => S.ach.length >= 12],
];
/* Story: delivered as dialogue at milestones. */
const D = 'Dot', C = 'The Counter';
const LORE = [
  { id: 'l0',  when: S => S.time >= 3, t: [[D, '...Hello? Is anyone there?'], [C, 'A point. How small. How promising.'], [D, 'Who said that?'], [C, 'I count things. You are number ten. Be useful, and I will count higher.']] },
  { id: 'l1',  when: S => lg(S.tot) >= 3, t: [[D, 'It feels good, getting bigger.'], [C, 'Bigger is only a number going up. Do not mistake it for meaning.']] },
  { id: 'l2',  when: S => S.times[0] > 0, t: [[C, 'You folded yourself back to the start and kept a little of what you were. Clever. Most points simply stop.'], [D, 'Most points?'], [C, 'There were others. I will tell you about them when you have earned it.']] },
  { id: 'l12', when: S => S.res.length > 0, t: [[D, 'I think I understand how the counting works now.'], [C, 'Understanding is the first research. The rest is patience.']] },
  { id: 'l3',  when: S => S.times[1] > 0, t: [[D, 'I remember dying.'], [C, 'You remember nothing. That is the gift.'], [D, 'Then why does it feel like losing something?'], [C, 'Because you are still counting what you lost.']] },
  { id: 'l4',  when: S => S.times[2] > 0, t: [[C, 'Each time you return with more than you left with. It is the one rule I never wrote.']] },
  { id: 'l5',  when: S => S.times[3] > 0, t: [[D, 'The others... they gave themselves up so I could grow, did they not?'], [C, 'They agreed. Eventually.'], [D, 'I will remember them.'], [C, 'Good. Someone should.']] },
  { id: 'l6',  when: S => S.times[4] > 0, t: [[C, '1.79e308. The edge of what I can count. Nothing has ever passed it.'], [D, 'Then I will be the first.']] },
  { id: 'l7',  when: S => S.bi, t: [[C, 'You broke my ceiling. I did not know it could break.'], [D, 'Neither did I. I just kept pushing.']] },
  { id: 'l8',  when: S => S.times[5] > 0, t: [[C, 'Time stopped meaning anything to you a while ago, did it not?'], [D, 'I lost count of the days. Funny, coming from me.']] },
  { id: 'l9',  when: S => S.be, t: [[C, 'Another wall, another crack. I have stopped being surprised.'], [D, 'You sound almost proud.'], [C, '...Do not tell anyone.']] },
  { id: 'l10', when: S => S.times[6] > 0, t: [[D, 'I can see it now. You were never counting me.'], [C, 'No. I was counting the dark between the stars. You are the first thing that ever counted back.']] },
  { id: 'l11', when: S => S.end, t: [[C, 'There is nothing higher. Not yet. The numbers have run out, and so have I.'], [D, 'Then we wait. When someone builds a bigger number...'], [C, '...we will be here. Thank you for playing.']] },
];
const EGG = [[D, 'You found the back room! There is no prize. Only this: thank you for reading all of it.'], [C, 'And a hint. Tell Command_Execute "tig". It listens.']];

/* ---------- State ---------- */
const newDims = () => Array.from({ length: 8 }, () => ({ a: Z, b: 0 }));
const fresh = () => ({ pts: num(10), tot: num(10), dims: newDims(), tick: 0, cur: LAYERS.map(() => Z),
  times: LAYERS.map(() => 0), run: LAYERS.map(() => 0), bi: false, be: false, end: false, auto: true,
  autoOn: LAYERS.map(() => true), nodes: [], res: [], rs: 0, ach: [], lore: [], arch: false, time: 0, last: Date.now() });
let S = fresh(), FX, MUL, TICK, acc = 0;
const Q = [];                       // events for the UI: ['reset',i] ['ach',i] ['lore',id] ['end']
const NODE = {}; NODES.forEach(n => NODE[n.id] = n);
const RESID = {}; RES.forEach(r => RESID[r.id] = r);

function recalc() {
  const f = { all: 1, tick: 1, dim: Array(8).fill(1), gain: LAYERS.map(() => 1), cost: 0, start: 10, auto: LAYERS.map(() => false) };
  const ap = ([t, k, v]) => {
    if (t === 'all') f.all *= v; else if (t === 'tick') f.tick *= v;
    else if (t === 'dim') { if (k === '*') f.dim = f.dim.map(x => x * v); else f.dim[k] *= v; }
    else if (t === 'gain') { if (k === '*') f.gain = f.gain.map(x => x * v); else f.gain[k] *= v; }
    else if (t === 'cost') f.cost += v; else if (t === 'start') f.start = Math.max(f.start, v); else if (t === 'auto') f.auto[k] = true;
  };
  S.nodes.forEach(id => NODE[id].fx.forEach(ap)); S.res.forEach(id => RESID[id].fx.forEach(ap));
  FX = f;
  let l = Math.log10(f.all) + S.ach.length * Math.log10(1.05);
  LAYERS.forEach((L, i) => { if (S.cur[i].m) l += L.k * lg(add(S.cur[i], ONE)); });
  MUL = fromLog(l); TICK = fromLog(S.tick * TICK_LOG + Math.log10(f.tick));
}
const prevLog = i => i ? lg(S.cur[i - 1]) : lg(S.tot);
const gainOf = i => { const l = prevLog(i), L = LAYERS[i]; return l < L.req - 1e-9 ? Z : floorD(mul(fromLog((l - L.req) * L.g), num(FX.gain[i]))); };
const dimMult = i => mul(fromLog(Math.floor(S.dims[i].b / 10) * 0.30103 + Math.log10(FX.dim[i])), MUL);
const dimCost = i => fromLog(Math.log10(DIM_BASE[i]) + Math.floor(S.dims[i].b / 10) * Math.log10(DIM_STEP[i]) - FX.cost);
const tickCost = () => fromLog(3 + S.tick - FX.cost);
const rsRate = () => 0.05 * (1 + S.times.reduce((a, b) => a + Math.min(b, 500), 0));
const pps = () => mul(mul(S.dims[0].a, dimMult(0)), TICK);

function buyDim(i, max) {
  const d = S.dims[i]; let n = 0;
  do { const p = dimCost(i); if (cmp(S.pts, p) < 0) break; S.pts = sub(S.pts, p); d.b++; d.a = add(d.a, ONE); } while (max && ++n < 400);
}
function buyTick(max) {
  let n = 0, did = false;
  do { const p = tickCost(); if (cmp(S.pts, p) < 0) break; S.pts = sub(S.pts, p); S.tick++; did = true; } while (max && ++n < 400);
  if (did) recalc();
}
const canNode = n => !S.nodes.includes(n.id) && (!n.parent || S.nodes.includes(n.parent)) && cmp(S.cur[n.c], num(n.cost)) >= 0;
function buyNode(id) { const n = NODE[id]; if (!canNode(n)) return false; S.cur[n.c] = sub(S.cur[n.c], num(n.cost)); S.nodes.push(id); recalc(); return true; }
const canRes = r => !S.res.includes(r.id) && S.rs >= r.cost;
function buyRes(id) { const r = RESID[id]; if (!canRes(r)) return false; S.rs -= r.cost; S.res.push(id); recalc(); return true; }
function breakIt(which) {
  const i = which === 'inf' ? 4 : 5, cost = which === 'inf' ? BREAK_INF_COST : BREAK_ETERNITY_COST;
  if (S[which === 'inf' ? 'bi' : 'be'] || !S.times[i] || cmp(S.cur[i], num(cost)) < 0) return false;
  S.cur[i] = sub(S.cur[i], num(cost)); S[which === 'inf' ? 'bi' : 'be'] = true; recalc(); return true;
}
function capCur(j) {
  const cap = j === 3 && !S.bi ? INF_CAP : j === 4 && !S.be ? ETERNITY_CAP : j === 5 ? ENDGAME : Infinity;
  if (lg(S.cur[j]) > cap) S.cur[j] = fromLog(cap);
}
function reset(i) {
  const g = gainOf(i); if (!g.m) return false;
  S.pts = num(FX.start); S.tot = num(FX.start); S.tick = 0; S.dims = newDims();
  for (let j = 0; j < i; j++) S.cur[j] = Z;
  for (let j = 0; j <= i; j++) S.run[j] = 0;
  S.cur[i] = add(S.cur[i], g); capCur(i); S.times[i]++;
  recalc(); Q.push(['reset', i]); return true;
}
const AUTO_FACTOR = [100, 100, 100, 100, 100, 100];   // auto-reset when gain is this many times your stock (per layer)
function tryAuto(i) {
  const g = gainOf(i); if (!g.m) return false;
  const capped = (i === 4 && !S.bi) || (i === 5 && !S.be);   // gain is stuck at 1 until the matching Break
  if (capped ? S.run[i] >= 20 : cmp(g, mul(S.cur[i], num(AUTO_FACTOR[i] || 5))) >= 0 || !S.cur[i].m) return reset(i);
  return false;
}

function meta() {
  ACH.forEach((a, i) => { if (!S.ach.includes(i) && a[2](S)) { S.ach.push(i); recalc(); Q.push(['ach', i]); } });
  for (const l of LORE) if (!S.lore.includes(l.id) && l.when(S)) { S.lore.push(l.id); Q.push(['lore', l.id]); break; }
}
function step(dt) {
  S.time += dt; for (let i = 0; i < S.run.length; i++) S.run[i] += dt;
  const T = mul(num(dt), TICK);
  for (let i = 0; i < 8; i++) {
    const d = S.dims[i]; if (!d.a.m) continue;
    const p = mul(mul(d.a, dimMult(i)), T);
    if (i === 0) { S.pts = add(S.pts, p); S.tot = add(S.tot, p); } else S.dims[i - 1].a = add(S.dims[i - 1].a, p);
  }
  S.rs += dt * rsRate();
  if (S.auto && S.times[0] > 0) { for (let i = 7; i >= 0; i--) buyDim(i, true); buyTick(true); }
  for (let i = 5; i >= 0; i--) if (FX.auto[i] && S.autoOn[i] && tryAuto(i)) break;
  if (!S.end && lg(S.cur[5]) >= ENDGAME - 1e-6) { S.end = true; Q.push(['end']); }
  acc += dt; if (acc >= .5) { acc = 0; meta(); }
}
/* Used by the balance simulator: a sensible human-like player. */
function autoPlay() {
  for (let i = 5; i >= 0; i--) if (!FX.auto[i] && tryAuto(i)) break;
  if (!S.auto || !S.times[0]) { for (let i = 7; i >= 0; i--) buyDim(i, true); buyTick(true); }
  for (const n of NODES) if (buyNode(n.id)) break;
  for (const r of RES) if (buyRes(r.id)) break;
  breakIt('inf'); breakIt('eter');
  if (!S.times[6] && lg(S.cur[5]) >= 1e5) tryAuto(6); else if (S.times[6] && gainOf(6).m && cmp(gainOf(6), S.cur[6]) >= 0) reset(6);
}

/* ---------- Save / load ---------- */
function load(d) {
  const f = fresh(); S = Object.assign(f, d && typeof d === 'object' ? d : {});
  S.pts = okD(S.pts); S.tot = okD(S.tot); if (!S.tot.m) S.tot = num(10);
  S.dims = f.dims.map((x, i) => d && d.dims && d.dims[i] ? { a: okD(d.dims[i].a), b: Math.max(0, +d.dims[i].b || 0) } : x);
  S.cur = f.cur.map((x, i) => d && d.cur ? okD(d.cur[i]) : x);
  ['times', 'run', 'autoOn'].forEach(k => { S[k] = f[k].map((x, i) => d && Array.isArray(d[k]) && d[k][i] !== undefined ? d[k][i] : x); });
  S.times = S.times.map(x => Math.max(0, +x || 0)); S.run = S.run.map(x => +x || 0);
  S.tick = Math.max(0, +S.tick || 0); S.rs = Math.max(0, +S.rs || 0); S.time = +S.time || 0;
  S.nodes = (Array.isArray(S.nodes) ? S.nodes : []).filter(id => NODE[id]);
  S.res = (Array.isArray(S.res) ? S.res : []).filter(id => RESID[id]);
  S.ach = (Array.isArray(S.ach) ? S.ach : []).filter(i => ACH[i]);
  S.lore = Array.isArray(S.lore) ? S.lore : [];
  if (S.cur[5].m && lg(S.cur[5]) > ENDGAME) S.cur[5] = fromLog(ENDGAME);
  recalc();
}
function describe(fx) {
  return fx.map(([t, k, v]) => ({
    all: `All production ×${v.toLocaleString('en-US')}`, tick: `Tickspeed ×${v}`,
    dim: k === '*' ? `All dimensions ×${v}` : `${k + 1}${['st', 'nd', 'rd'][k] || 'th'} dimension ×${v}`,
    gain: k === '*' ? `All layer gains ×${v}` : `${LAYERS[k].n} gain ×${v}`, cost: `Dimensions cost ${v} orders of magnitude less`,
    start: `Start each run with ${fmt(num(v))} points`, auto: `Automates ${LAYERS[k] ? LAYERS[k].n : ''}`,
  })[t]).join('. ');
}

recalc();
const Core = { Z, ONE, num, fromLog, lg, mul, add, sub, cmp, fmt, LAYERS, NODES, RES, ACH, LORE, EGG, DIM_BASE, BREAK_INF_COST, BREAK_ETERNITY_COST,
  OFFLINE_MAX, ENDGAME, Q, get: () => S, fx: () => FX, mult: () => MUL, tick: () => TICK, fresh, load, step, recalc, gainOf, prevLog, dimMult, dimCost, tickCost,
  rsRate, pps, buyDim, buyTick, canNode, buyNode, canRes, buyRes, breakIt, reset, tryAuto, autoPlay, describe, setAchLore: meta, newState: () => load(fresh()) };
if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
