(() => {
'use strict';
const C = Core, { fmt, lg, cmp, num, fromLog, add, LAYERS, NODES, RES, ACH, LORE } = C;
const $ = id => document.getElementById(id);
const S = () => C.get();
const SAVE_KEY = 'points-save-v1';
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
const setT = (el, t) => { if (el._t !== t) { el.textContent = t; el._t = t; } };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

/* Hold a button to keep buying. Uses pointer events so mouse, touch and pen all work. */
function hold(btn, fn) {
  let t1, t2;
  const stop = () => { clearTimeout(t1); clearInterval(t2); };
  btn.addEventListener('pointerdown', e => { if (e.button > 0) return; fn(); ui(); t1 = setTimeout(() => { t2 = setInterval(() => { fn(); ui(); }, 70); }, 350); });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(ev => btn.addEventListener(ev, stop));
  btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); ui(); } });
  btn.addEventListener('contextmenu', e => e.preventDefault());
}
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('show'), 3200); }

/* ---------- Tabs ---------- */
const TABS = [['dims', 'Dimensions'], ['layers', 'Layers'], ['tree', 'Upgrades'], ['research', 'Research'], ['ach', 'Achievements'], ['brk', 'Break'], ['opts', 'Options'], ['arch', 'Archive']];
let tab = 'dims';
const secs = {}, tbtn = {};
TABS.forEach(([id, name]) => {
  const b = el('button', '', name); b.setAttribute('role', 'tab'); b.onclick = () => { tab = id; showTab(); ui(); }; $('nav').appendChild(b); tbtn[id] = b;
  const s = el('section'); s.hidden = id !== 'dims'; $('main').appendChild(s); secs[id] = s;
});
function showTab() { TABS.forEach(([id]) => { secs[id].hidden = id !== tab; tbtn[id].classList.toggle('on', id === tab); }); }

/* ---------- Dimensions ---------- */
secs.dims.innerHTML = `<div class="tools"><button id="tk"></button><button id="mall">Max all</button><label><input type="checkbox" id="auto"> Autobuyer <span id="autoNote" class="small"></span></label></div><div id="dims"></div>`;
const dimRows = [];
['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].forEach((n, i) => {
  const r = el('div', 'row', `<span class="nm">${n} Dimension</span><span class="amt"></span><span class="mu"></span><button></button>`);
  hold(r.querySelector('button'), () => C.buyDim(i, false));
  $('dims').appendChild(r); dimRows.push({ amt: r.children[1], mu: r.children[2], btn: r.children[3] });
});
hold($('tk'), () => C.buyTick(false));
$('mall').onclick = () => { for (let i = 7; i >= 0; i--) C.buyDim(i, true); C.buyTick(true); ui(); };
$('auto').onchange = e => { S().auto = e.target.checked; };

/* ---------- Layers ---------- */
const layerRows = LAYERS.map((L, i) => {
  const e = el('div', 'layer', `<b>${L.n}</b> <span class="dim small">(requires ${fmt(fromLog(L.req))} ${L.from})</span><div class="st"></div><label class="small dim"><input type="checkbox" class="au"> Auto-${L.n}</label><button class="go"></button>`);
  e.style.setProperty('--c', L.col); e.hidden = true;
  e.querySelector('.go').onclick = () => { if (C.reset(i)) { if (i < 6) anim(i); ui(); } };
  e.querySelector('.au').onchange = ev => { S().autoOn[i] = ev.target.checked; };
  secs.layers.appendChild(e);
  return { e, st: e.querySelector('.st'), go: e.querySelector('.go'), au: e.querySelector('.au'), lab: e.querySelector('label') };
});

/* ---------- Upgrade tree (nested, hold to buy) ---------- */
const nodeEls = {};
(function build() {
  const ul = el('ul', 'tree'); secs.tree.append(el('p', 'dim small', 'Permanent upgrades. Each costs a layer currency, and needs the upgrade above it. Hold a button to buy quickly.'), el('p', '', '<span id="tcur" class="dim"></span>'), ul);
  const add1 = (n, parent) => {
    const li = el('li'), b = el('button', 'node', `<b>${n.name}</b><small>${C.describe(n.fx)}</small><span class="cost">${fmt(num(n.cost))} ${LAYERS[n.c].s}</span>`);
    hold(b, () => C.buyNode(n.id)); li.appendChild(b); parent.appendChild(li); nodeEls[n.id] = b;
    const kids = NODES.filter(k => k.parent === n.id);
    if (kids.length) { const u = el('ul'); li.appendChild(u); kids.forEach(k => add1(k, u)); }
  };
  NODES.filter(n => !n.parent).forEach(n => add1(n, ul));
})();

/* ---------- Research ---------- */
secs.research.innerHTML = `<p>Research points: <b id="rs">0</b> <span class="dim small">(+<span id="rsr"></span>/s, more with every reset)</span></p><div id="reslist" class="grid"></div>`;
const resEls = RES.map(r => {
  const b = el('button', 'node', `<b>${r.name}</b><small>${C.describe(r.fx)}</small><span class="cost">${r.cost.toLocaleString('en-US')} research</span>`);
  hold(b, () => C.buyRes(r.id)); $('reslist').appendChild(b); return b;
});

/* ---------- Achievements ---------- */
secs.ach.innerHTML = `<p class="dim small">Each achievement multiplies all production by ×1.05. <b id="achn"></b></p><div class="grid" id="achl"></div>`;
const achEls = ACH.map(a => { const e = el('div', 'ach', `<b>${a[0]}</b><br><small class="dim">${a[1]}</small>`); $('achl').appendChild(e); return e; });

/* ---------- Break ---------- */
secs.brk.innerHTML = `<div class="layer" style="--c:#ba68c8"><b>Break Infinity</b><div class="dim small">Sacrifice Points can pass 1.79e308, so Infinity gives far more IP. Unlocks after your first Infinity.</div><button class="go" id="bi"></button></div>
  <div class="layer" style="--c:#fff176"><b>Break Eternity</b><div class="dim small">Infinity Points can pass 1e3008, so Eternity gives far more EP. Unlocks after your first Eternity.</div><button class="go" id="be"></button></div>`;
$('bi').onclick = () => { if (C.breakIt('inf')) ui(); };
$('be').onclick = () => { if (C.breakIt('eter')) ui(); };

/* ---------- Options ---------- */
secs.opts.innerHTML = `<p><button id="music">Music: off</button></p><p><button id="save">Save</button> <button id="export">Export</button> <button id="import">Import</button> <button id="reset">Hard reset</button></p>
  <h3>Goals</h3><p>Supernova: reach 1e100,000 Eternity Points.<br>Absolute endgame: reach 1e1,000,000,000 Eternity Points.</p><p class="dim small">Autosaves every 10 seconds. Offline progress up to 12 hours.</p>`;
secs.arch.innerHTML = `<p class="dim small">Memories, in the order you found them. Tap one to hear it again.</p><div id="archl"></div>`;

/* ---------- Dialogue (story) ---------- */
const dq = []; let curLine = null, typer = null;
function say(lines) { dq.push(...lines); if (!curLine) nextLine(); }
function nextLine() {
  if (!dq.length) { curLine = null; $('dlg').hidden = true; return; }
  curLine = dq.shift(); $('dlg').hidden = false; $('dn').textContent = curLine[0]; $('dn').className = curLine[0] === 'Dot' ? 'dot' : 'ctr';
  const t = curLine[1]; clearInterval(typer); typer = null;
  if (reduce) { $('dt').textContent = t; return; }
  let i = 0; $('dt').textContent = '';
  typer = setInterval(() => { $('dt').textContent = t.slice(0, ++i); if (i >= t.length) { clearInterval(typer); typer = null; } }, 22);
}
const advance = () => { if (!curLine) return; if (typer) { clearInterval(typer); typer = null; $('dt').textContent = curLine[1]; } else nextLine(); };
$('dlg').onclick = advance;
document.addEventListener('keydown', e => { if (curLine && (e.key === ' ' || e.key === 'Enter') && !e.target.closest('button,input')) { e.preventDefault(); advance(); } });
let clicks = 0;
$('title').onclick = () => { if (++clicks >= 7 && !S().arch) { S().arch = true; say(C.EGG); toast('You found the Archive.'); ui(); } };

/* ---------- Animation ---------- */
let animId = 0;
function anim(i, text) {
  const c = $('fx'), x = c.getContext('2d'), big = i === 6, col = LAYERS[Math.min(i, 6)].col, id = ++animId;
  if (reduce && !big) return;
  c.width = innerWidth; c.height = innerHeight; c.style.display = 'block';
  const W = c.width, H = c.height, cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2, dur = big ? 7500 : 900, t0 = performance.now();
  const P = big ? Array.from({ length: 380 }, () => ({ a: Math.random() * 6.283, v: .25 + Math.random() * 1.1, r: 1 + Math.random() * 2.5, o: Math.random() * 300 })) : [];
  const end = () => { if (id === animId) { c.style.display = 'none'; c.onclick = null; } };
  if (big) c.onclick = end;
  (function frame(now) {
    if (id !== animId) return;
    const t = now - t0; if (t > dur) return end();
    x.clearRect(0, 0, W, H);
    if (!big) { x.lineWidth = 4; x.strokeStyle = col; for (let k = 0; k < 3; k++) { const u = Math.max(0, t / dur - k * .1); x.globalAlpha = (1 - u) * .8; x.beginPath(); x.arc(cx, cy, u * R * .8, 0, 6.283); x.stroke(); } }
    else {
      x.fillStyle = 'rgba(0,0,0,' + Math.min(.85, t / 1500) + ')'; x.fillRect(0, 0, W, H);
      if (t < 2600) {
        const u = t / 2600, r = 150 * (1 - u * u) + 6, j = u * 5;
        P.slice(0, 140).forEach(p => { const d = (1 - (u + p.o / 900) % 1) * R * .5 + r; x.globalAlpha = .6; x.fillStyle = '#9cf'; x.fillRect(cx + Math.cos(p.a) * d, cy + Math.sin(p.a) * d, 2, 2); });
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 2); g.addColorStop(0, '#fff'); g.addColorStop(.4, '#9cf'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.globalAlpha = 1; x.fillStyle = g; x.beginPath(); x.arc(cx + (Math.random() - .5) * j, cy + (Math.random() - .5) * j, r * 2, 0, 6.283); x.fill();
      } else {
        const b = (t - 2600) / (dur - 2600);
        x.globalAlpha = Math.max(0, 1 - (t - 2600) / 900); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
        x.globalAlpha = 1 - b; x.strokeStyle = '#fc8'; x.lineWidth = 14 * (1 - b) + 2; x.beginPath(); x.arc(cx, cy, b * R * 1.1, 0, 6.283); x.stroke();
        x.strokeStyle = '#8cf'; x.lineWidth = 6 * (1 - b); x.beginPath(); x.arc(cx, cy, b * R * .7, 0, 6.283); x.stroke();
        P.forEach(p => { const d = p.v * (t - 2600) * .35; x.globalAlpha = Math.max(0, 1 - b * 1.1); x.fillStyle = p.r > 2 ? '#fc8' : '#fff'; x.beginPath(); x.arc(cx + Math.cos(p.a) * d, cy + Math.sin(p.a) * d, p.r, 0, 6.283); x.fill(); });
        if (b > .15) { x.globalAlpha = Math.min(1, (b - .15) * 3) * (b > .85 ? (1 - b) / .15 : 1); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = 'bold ' + Math.min(64, W / 9) + 'px Verdana,sans-serif'; x.fillText(text || 'SUPERNOVA', cx, cy + 20); }
      }
    }
    x.globalAlpha = 1; requestAnimationFrame(frame);
  })(t0);
}

/* ---------- Music (generated, no audio files) ---------- */
let ac, bus, timer, musicOn = false;
function tone(f, t, d, v, type) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + d * .3); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + .1);
}
function music(on) {
  clearInterval(timer);
  if (!on) { if (ac) ac.suspend(); return; }
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)(); bus = ac.createGain(); bus.gain.value = .6;
      const dl = ac.createDelay(); dl.delayTime.value = .42; const fb = ac.createGain(); fb.gain.value = .45;
      bus.connect(ac.destination); bus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(ac.destination);
    }
    ac.resume();
  } catch (e) { toast('Audio is not available here.'); musicOn = false; return; }
  const prog = [0, -4, -2, -5], pent = [0, 3, 7, 10, 12, 15]; let bar = 0;
  const play = () => {
    const t = ac.currentTime + .05, root = 110 * 2 ** (prog[bar++ % 4] / 12);
    [0, 7, 12, 16].forEach((s, i) => tone(root * 2 ** (s / 12), t, 7, .05 / (1 + i * .3), 'triangle'));
    const n = 3 + S().times.filter(x => x > 0).length;
    for (let k = 0; k < n; k++) tone(root * 4 * 2 ** (pent[Math.random() * 6 | 0] / 12), t + k * 5.5 / n, 2, .035, 'sine');
  };
  play(); timer = setInterval(play, 6000);
}
$('music').onclick = () => { musicOn = !musicOn; music(musicOn); $('music').textContent = 'Music: ' + (musicOn ? 'on' : 'off'); };
document.addEventListener('visibilitychange', () => { if (ac && musicOn) document.hidden ? ac.suspend() : ac.resume(); });

/* ---------- Save / load ---------- */
const save = () => { S().last = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S())); return true; } catch (e) { return false; } };
$('save').onclick = () => toast(save() ? 'Game saved.' : 'Could not save. Is storage blocked?');
$('export').onclick = () => { save(); const code = btoa(JSON.stringify(S())); navigator.clipboard ? navigator.clipboard.writeText(code).then(() => toast('Save code copied.'), () => prompt('Save code:', code)) : prompt('Save code:', code); };
$('import').onclick = () => { const c = prompt('Paste save code:'); if (!c) return; try { C.load(JSON.parse(atob(c.trim()))); save(); ui(); toast('Imported.'); } catch (e) { toast('That save code is not valid.'); } };
$('reset').onclick = () => { if (confirm('Hard reset everything? This cannot be undone.')) { C.load(C.fresh()); save(); ui(); } };

/* ---------- Render (only the visible tab is updated) ---------- */
function ui() {
  const s = S(), fx = C.fx();
  setT($('pts'), fmt(s.pts)); setT($('pps'), fmt(C.pps()));
  tbtn.arch.hidden = !s.arch; tbtn.brk.hidden = !(s.times[4] > 0 || s.bi);
  if (tab === 'dims') {
    s.dims.forEach((d, i) => { const r = dimRows[i], c = C.dimCost(i);
      setT(r.amt, fmt(d.a)); setT(r.mu, `×${fmt(C.dimMult(i))} (${d.b} bought)`); setT(r.btn, 'Cost: ' + fmt(c)); r.btn.disabled = cmp(s.pts, c) < 0; });
    setT($('tk'), `Tickspeed ×${fmt(C.tick())} (cost ${fmt(C.tickCost())})`); $('tk').disabled = cmp(s.pts, C.tickCost()) < 0;
    setT($('autoNote'), s.times[0] > 0 ? '' : '(unlocks after first Prestige)'); $('auto').disabled = !s.times[0]; $('auto').checked = s.auto;
  } else if (tab === 'layers') {
    LAYERS.forEach((L, i) => { const r = layerRows[i], g = C.gainOf(i);
      r.e.hidden = !(s.times[i] > 0 || C.prevLog(i) >= L.req * 0.7);
      setT(r.st, `${fmt(s.cur[i])} ${L.c}: production ×${fmt(fromLog(L.k * lg(add(s.cur[i], C.ONE))))}  (reset ${s.times[i].toLocaleString('en-US')}×)`);
      r.go.disabled = !g.m; setT(r.go, g.m ? `${L.n} for +${fmt(g)} ${L.s}` : `Reach ${fmt(fromLog(L.req))} ${L.from}`);
      r.lab.hidden = !(fx.auto[i]); r.au.checked = s.autoOn[i]; });
  } else if (tab === 'tree') {
    NODES.forEach(n => { const b = nodeEls[n.id], got = s.nodes.includes(n.id), open = !n.parent || s.nodes.includes(n.parent);
      const cls = 'node' + (got ? ' owned' : !open ? ' locked' : C.canNode(n) ? ' ready' : ''); if (b.className !== cls) b.className = cls; b.disabled = got || !open || !C.canNode(n); });
    setT($('tcur'), LAYERS.map((L, i) => s.cur[i].m ? `${fmt(s.cur[i])} ${L.s}` : '').filter(Boolean).join('   ') || 'No currencies yet. Prestige to earn some.');
  } else if (tab === 'research') {
    setT($('rs'), Math.floor(s.rs).toLocaleString('en-US')); setT($('rsr'), C.rsRate().toFixed(2));
    RES.forEach((r, i) => { const got = s.res.includes(r.id), cls = 'node' + (got ? ' owned' : C.canRes(r) ? ' ready' : ''); if (resEls[i].className !== cls) resEls[i].className = cls; resEls[i].disabled = got || !C.canRes(r); });
  } else if (tab === 'ach') {
    setT($('achn'), `${s.ach.length}/${ACH.length}`); ACH.forEach((a, i) => achEls[i].classList.toggle('on', s.ach.includes(i)));
  } else if (tab === 'brk') {
    setT($('bi'), s.bi ? 'Infinity is broken' : `Break Infinity (${C.BREAK_INF_COST} IP)`); $('bi').disabled = s.bi || !s.times[4] || cmp(s.cur[4], num(C.BREAK_INF_COST)) < 0;
    setT($('be'), s.be ? 'Eternity is broken' : `Break Eternity (${C.BREAK_ETERNITY_COST} EP)`); $('be').disabled = s.be || !s.times[5] || cmp(s.cur[5], num(C.BREAK_ETERNITY_COST)) < 0;
  } else if (tab === 'arch') {
    const key = s.lore.join(); if ($('archl')._k !== key) { $('archl')._k = key; $('archl').innerHTML = '';
      s.lore.forEach(id => { const l = LORE.find(x => x.id === id); if (!l) return; const b = el('button', 'node', `<b>${l.t[0][1].slice(0, 46)}...</b>`); b.onclick = () => say(l.t); $('archl').appendChild(b); }); }
  }
  while (C.Q.length) {
    const e = C.Q.shift();
    if (e[0] === 'reset' && e[1] === 6) anim(6);
    else if (e[0] === 'ach') toast('Achievement: ' + ACH[e[1]][0]);
    else if (e[0] === 'lore') { const l = LORE.find(x => x.id === e[1]); if (l) say(l.t); }
    else if (e[0] === 'end') anim(6, 'ABSOLUTE ENDGAME');
  }
}

/* ---------- Start ---------- */
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) C.load(JSON.parse(raw)); } catch (e) { C.load(C.fresh()); }
let prev = Date.now();
{
  const away = Math.min((Date.now() - S().last) / 1000, C.OFFLINE_MAX);
  if (away > 30) { const n = Math.min(240, Math.ceil(away / 30)); for (let i = 0; i < n; i++) C.step(away / n); toast('Welcome back! Simulated ' + Math.round(away / 60) + ' minutes offline.'); }
}
setInterval(() => {
  const now = Date.now(); let dt = Math.min((now - prev) / 1000, C.OFFLINE_MAX); prev = now;
  if (dt > 2) { const n = Math.min(240, Math.ceil(dt / 10)); for (let i = 0; i < n; i++) C.step(dt / n); }   // tab was asleep
  else C.step(dt);
}, 50);
setInterval(() => { if (!document.hidden) ui(); }, 100);
setInterval(save, 10000);
addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else ui(); });
showTab(); ui();
})();
