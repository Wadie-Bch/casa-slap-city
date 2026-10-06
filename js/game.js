'use strict';
/* CASA SLAP CITY — game loop: one rule. Press YALLAH, and all of Casablanca runs after you to slap you.
   Slap them first with the big red button. Roam the whole city on foot. */
(() => {
const $ = id => document.getElementById(id);
const cv = $('game'), g = cv.getContext('2d', { alpha: false });
const shc = document.createElement('canvas'), sg = shc.getContext('2d');
const C = Art.cam;
let W = 0, H = 0, DPR = 1, S = 20, zoomK = 1;
const ZOOMS = [1, 1.3, 0.78];                               // normal / near / far (button in the top bar)
let zoomI = +(localStorage.getItem('csc_zoom') || 0) % 3;
let state = 'load', time = 0, playT = 0, frame = 0;
const cam = { x: 0, z: 0, shake: 0 };
let vx0 = 0, vz0 = 0, vx1 = 0, vz1 = 0;
const tmp = [0, 0, 0, 0], tmp2 = [0, 0];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

/* ---------------------------------------------------------------- player / entities */
const P = { x: 0, z: 0, dir: 0, hp: 8, max: 8, slap: -1, cd: 0, inv: 0, walk: 0, kx: 0, kz: 0, look: null, moving: false, hurt: 0 };
let npcs = [], cars = [], pops = [], parts = [], rings = [], pickups = [], shoes = [];
let score = 0, combo = 0, comboT = 0, mega = 0, best = +(localStorage.getItem('csc_best') || 0), kos = 0, spawnCd = 0, carCd = 0, hitstop = 0;
let startD = null, curD = null, zoneT = 0, toastT = 0, quartiers = new Set();
const MEGA_N = 12;
const TYPES = {
  citizen: { hp: 2, sp: [3.7, 4.5], reach: 1.35, wind: 0.44, dmg: 1 },
  kid: { hp: 1, sp: [5.1, 5.7], reach: 1.1, wind: 0.32, dmg: 1 },
  big: { hp: 4, sp: [3.0, 3.5], reach: 1.6, wind: 0.62, dmg: 2 },
  auntie: { hp: 2, sp: [3.3, 3.9], reach: 1.3, wind: 0.5, dmg: 1 },
  police: { hp: 3, sp: [4.6, 5.0], reach: 1.45, wind: 0.4, dmg: 1 },
};
const WORDS = ['CHTAK!', 'PAF!', 'طراخ!', 'SLAP!', 'TRAAKH!', 'BAM!', 'ZDAM!', 'صفعة!', 'TCHAK!'];

/* ---------------------------------------------------------------- audio (all synthesised) */
const Snd = {
  ctx: null, on: localStorage.getItem('csc_snd') !== '0', master: null, noise: null, step: 0, next: 0, timer: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.on ? 0.9 : 0; this.master.connect(this.ctx.destination);
    const n = this.ctx.sampleRate, b = this.ctx.createBuffer(1, n, n), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.music(), 90);
  },
  toggle() { this.on = !this.on; localStorage.setItem('csc_snd', this.on ? '1' : '0'); if (this.master) this.master.gain.value = this.on ? 0.9 : 0; $('bsound').style.opacity = this.on ? 1 : 0.4; },
  env(node, t, a, peak, d) { const gn = this.ctx.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(peak, t + a); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d); node.connect(gn); gn.connect(this.master); return gn; },
  nz(t, dur, type, f, q, peak) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); this.env(fl, t, 0.002, peak, dur); s.start(t, Math.random() * 0.5, dur + 0.05); return fl; },
  tone(t, type, f0, f1, dur, peak) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); this.env(o, t, 0.004, peak, dur); o.start(t); o.stop(t + dur + 0.05); },
  slap(p) { if (!this.ctx) return; const t = this.ctx.currentTime, k = rnd(0.9, 1.15); this.nz(t, 0.09, 'bandpass', 2100 * k, 0.8, 0.9); this.nz(t, 0.05, 'highpass', 5000, 0.5, 0.5); this.tone(t, 'sine', 260 * k, 90, 0.09, 0.5); if (p > 1) { this.tone(t, 'sine', 120, 40, 0.5, 0.9); this.nz(t, 0.5, 'lowpass', 900, 0.4, 0.7); } },
  whoosh() { if (!this.ctx) return; const t = this.ctx.currentTime, f = this.nz(t, 0.14, 'bandpass', 900, 1.2, 0.22); f.frequency.exponentialRampToValueAtTime(2600, t + 0.14); },
  hurt() { if (!this.ctx) return; const t = this.ctx.currentTime; this.nz(t, 0.1, 'bandpass', 1500, 0.8, 0.8); this.tone(t, 'square', 330, 140, 0.22, 0.25); this.tone(t, 'sine', 150, 60, 0.2, 0.6); },
  ko() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(t, 'triangle', 700, 180, 0.28, 0.3); },
  pick() { if (!this.ctx) return; const t = this.ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.06, 'triangle', f, f, 0.12, 0.25)); },
  over() { if (!this.ctx) return; const t = this.ctx.currentTime; [392, 330, 262, 196].forEach((f, i) => this.tone(t + i * 0.2, 'square', f, f * 0.97, 0.3, 0.2)); },
  horn() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(t, 'square', 415, 410, 0.22, 0.1); this.tone(t, 'square', 520, 515, 0.22, 0.08); },
  /* 16-step chaabi-flavoured loop: darbuka (dum / tek) + bass + plucked lead in D hijaz */
  music() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const spb = 60 / 118 / 4;
    while (this.next < this.ctx.currentTime + 0.25) {
      const st = this.step % 32, t = this.next, play = state === 'play', v = play ? 1 : 0.5;
      const DUM = [0, 6, 10, 16, 22, 26], TEK = [3, 4, 8, 12, 14, 19, 20, 24, 28, 30, 31];
      if (DUM.includes(st)) { this.tone(t, 'sine', 150, 55, 0.16, 0.42 * v); this.nz(t, 0.03, 'lowpass', 500, 0.5, 0.2 * v); }
      if (TEK.includes(st)) this.nz(t, 0.035, 'highpass', 3200, 0.7, (st % 4 === 0 ? 0.2 : 0.11) * v);
      const scale = [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66];
      const bass = [0, -1, -1, 0, -1, -1, 4, -1, 0, -1, -1, 0, -1, 3, -1, -1, 1, -1, -1, 1, -1, -1, 4, -1, 0, -1, -1, 0, -1, 2, 1, -1][st];
      if (bass >= 0) this.tone(t, 'triangle', scale[bass] / 2, scale[bass] / 2, 0.2, 0.2 * v);
      if (play) {
        const bar = (this.step >> 5) % 4;
        const lead = [[7, -1, 6, 5, -1, 4, -1, 5, 6, -1, 5, 4, -1, 2, -1, -1, 4, -1, 5, 4, -1, 2, -1, 1, 0, -1, -1, 1, 2, -1, 1, -1],
          [4, -1, 4, 5, -1, 6, -1, 7, 6, -1, 5, -1, 4, -1, 2, -1, 1, -1, 2, 4, -1, 2, -1, 1, 0, -1, 0, -1, -1, -1, -1, -1]][bar & 1][st];
        if (lead >= 0) this.tone(t, 'sawtooth', scale[lead] * 2, scale[lead] * 2 * 0.995, 0.13, 0.045);
      }
      this.next += spb; this.step++;
    }
  },
};

/* ---------------------------------------------------------------- canvas / camera */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.round(innerWidth * DPR); H = Math.round(innerHeight * DPR);
  cv.width = W; cv.height = H; shc.width = W >> 1; shc.height = H >> 1;
  S = Math.min(W, H) / 21;                                  // ~21 m across a phone held upright
  if (W > H) S = Math.max(S, W / 50);
  S *= zoomK * ZOOMS[zoomI];
  g.imageSmoothingEnabled = true;
}
addEventListener('resize', resize);
function setW(c, f) { c.setTransform(C.S * f, 0, 0, C.S * f, C.ox * f, C.oy * f); }
function setR(c, r, f) { const su = C.S * U * f; c.setTransform(su, 0, 0, su, (C.ox + r.cx * C.S) * f, (C.oy + r.cz * C.S) * f); }

/* ---------------------------------------------------------------- input */
const inp = { x: 0, z: 0, slap: false, keys: {}, stickId: -1, sx: 0, sy: 0 };
const stick = $('stick'), knob = $('knob'), slapBtn = $('slap');
cv.addEventListener('pointerdown', e => {
  Snd.init();
  if (state !== 'play' || inp.stickId !== -1) return;
  inp.stickId = e.pointerId; inp.sx = e.clientX; inp.sy = e.clientY;
  stick.style.display = 'block'; stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; knob.style.transform = '';
  $('stickhint').style.display = 'none';
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== inp.stickId) return;
  let dx = e.clientX - inp.sx, dy = e.clientY - inp.sy; const L = Math.hypot(dx, dy), M = 52;
  if (L > M) { dx *= M / L; dy *= M / L; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  const dead = 7;
  inp.x = L < dead ? 0 : dx / M; inp.z = L < dead ? 0 : dy / M;
});
const stickEnd = e => { if (e.pointerId !== inp.stickId) return; inp.stickId = -1; inp.x = inp.z = 0; stick.style.display = 'none'; };
cv.addEventListener('pointerup', stickEnd); cv.addEventListener('pointercancel', stickEnd);
slapBtn.addEventListener('pointerdown', e => { e.preventDefault(); Snd.init(); inp.slap = true; slapBtn.classList.add('down'); doSlap(); });
const slapUp = () => { inp.slap = false; slapBtn.classList.remove('down'); };
slapBtn.addEventListener('pointerup', slapUp); slapBtn.addEventListener('pointercancel', slapUp); slapBtn.addEventListener('pointerleave', slapUp);
addEventListener('keydown', e => {
  if (e.repeat) return;
  inp.keys[e.code] = true; Snd.init();
  if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyK') { e.preventDefault(); if (state === 'play') { inp.slap = true; doSlap(); } }
  if (e.code === 'Enter') { if (state === 'title') startGame(); else if (state === 'over') startGame(); else if (state === 'pause') setPause(false); }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (state === 'play') setPause(true); else if (state === 'pause') setPause(false); }
});
addEventListener('keyup', e => { inp.keys[e.code] = false; if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyK') inp.slap = false; });
document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('#picklist')) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'play') setPause(true); if (Snd.ctx) Snd.ctx.suspend(); } else if (Snd.ctx) Snd.ctx.resume(); });

/* ---------------------------------------------------------------- UI */
function show(id, on) { $(id).classList.toggle('show', on); }
function hearts() {
  let h = ''; for (let i = 0; i < P.max; i++) h += `<i class="${i < P.hp ? '' : 'off'}"></i>`;
  $('hearts').innerHTML = h;
}
function hud() {
  $('score').textContent = score;
  $('combo').textContent = combo >= 3 ? `COMBO x${comboMult()}  ·  ${combo}` : '';
  $('megafill').style.width = Math.min(100, mega / MEGA_N * 100) + '%';
  slapBtn.classList.toggle('mega', mega >= MEGA_N);
  slapBtn.textContent = mega >= MEGA_N ? 'MEGA!' : 'SLAP!';
}
const comboMult = () => Math.min(5, 1 + Math.floor(combo / 8));
function toast(t, sec) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; toastT = sec || 1.6; }
function zone(d) { const e = $('zone'); e.innerHTML = `<small>QUARTIER ${quartiers.size} / ${World.meta.districts.length}</small>${d.name.toUpperCase()}`; e.style.opacity = 1; zoneT = 3; }
function setPause(p) {
  if (p && state === 'play') { state = 'pause'; show('pause', true); }
  else if (!p && state === 'pause') { state = 'play'; show('pause', false); last = performance.now(); }
}
$('bstart').onclick = () => { Snd.init(); startGame(); };
$('bagain').onclick = () => { Snd.init(); startGame(); };
$('bmenu').onclick = () => toTitle();
$('bquit').onclick = () => toTitle();
$('bresume').onclick = () => setPause(false);
$('bpause').onclick = () => setPause(true);
$('bsound').onclick = () => { Snd.init(); Snd.toggle(); };
$('bzoom').onclick = () => { zoomI = (zoomI + 1) % 3; localStorage.setItem('csc_zoom', zoomI); resize(); toast(['ZOOM NORMAL', 'ZOOM +', 'ZOOM −'][zoomI], 0.8); };
$('bpick').onclick = () => { buildPick(); show('pick', true); };
$('bpickclose').onclick = () => show('pick', false);
function buildPick() {
  const L = $('picklist'); L.innerHTML = '';
  const ds = World.meta.districts.slice().sort((a, b) => a.name.localeCompare(b.name));
  const mk = (label, d) => { const b = document.createElement('button'); b.textContent = label; if (d === startD) b.className = 'on'; b.onclick = () => { setStart(d || pick(World.meta.districts)); show('pick', false); }; L.appendChild(b); };
  mk('🎲 Au hasard', null);
  for (const d of ds) mk(d.name, d);
}
function setStart(d) {
  startD = d; localStorage.setItem('csc_start', d.name); $('pickname').textContent = d.name;
  cam.x = P.x = d.x; cam.z = P.z = d.z; placed = false; Nav.ready = false;
}
function toTitle() {
  state = 'title'; show('over', false); show('pause', false); show('title', true); $('hud').style.display = 'none';
  npcs = []; shoes = []; pickups = []; pops = []; parts = []; rings = [];
  $('best').textContent = best ? `RECORD: ${best} SLAPS` : '';
}

/* ---------------------------------------------------------------- game flow */
let placed = false;
function placePlayer() {
  // nearest road piece to the chosen quartier centre -> stand in the middle of it
  let bd = 1e18, bx = P.x, bz = P.z;
  World.queryIdx('r', P.x - 260, P.z - 260, P.x + 260, P.z + 260, (r, i) => {
    if (r.s.r_info[i * 12 + 1] > 5) return;
    World.roadAt(r, i, r.rLen[i] / 2, tmp);
    const d = (tmp[0] - startD.x) ** 2 + (tmp[1] - startD.z) ** 2;
    if (d < bd) { bd = d; bx = tmp[0]; bz = tmp[1]; }
  });
  P.x = bx; P.z = bz; cam.x = bx; cam.z = bz;
  rebuildNav();
  if (Nav.nearestFree(P.x, P.z, tmp2)) { P.x = tmp2[0]; P.z = tmp2[1]; }
  placed = true;
}
function startGame() {
  if (!World.need(startD.x, startD.z, 500)) { toast('Loading the city…', 1.2); $('toast').style.opacity = 1; pendingStart = true; return; }
  pendingStart = false;
  P.x = startD.x; P.z = startD.z; placePlayer();
  P.hp = P.max; P.slap = -1; P.cd = 0; P.inv = 1.2; P.kx = P.kz = 0; P.hurt = 0; P.dir = -Math.PI / 2;
  P.look = Art.makeLook('player', Math.random);
  npcs = []; shoes = []; pickups = []; pops = []; parts = []; rings = [];
  score = 0; combo = 0; mega = 0; kos = 0; playT = 0; spawnCd = 0.4; quartiers = new Set(); curD = null;
  state = 'play'; show('title', false); show('over', false); show('pause', false); $('hud').style.display = 'block'; $('stickhint').style.display = '';
  hearts(); hud();
  toast('ILS ARRIVENT… SLAP!', 1.8);
  last = performance.now();
}
let pendingStart = false;
function gameOver() {
  state = 'over'; Snd.over();
  if (score > best) { best = score; localStorage.setItem('csc_best', best); }
  $('final').textContent = score;
  $('overinfo').innerHTML = `${kos} K.O. · ${quartiers.size} quartier${quartiers.size > 1 ? 's' : ''} · ${Math.floor(playT)} s<br>${score >= best && score > 0 ? '⭐ NOUVEAU RECORD ⭐' : 'Record: ' + best}`;
  setTimeout(() => { if (state === 'over') { show('over', true); $('hud').style.display = 'none'; } }, 900);
}

/* ---------------------------------------------------------------- nav raster upkeep */
let navT = 0, flowT = 0;
function rebuildNav() {
  Nav.rebuild(P.x, P.z, Art.propR, (c, k, x0, z0) => {
    c.setTransform(k, 0, 0, k, -x0 * k, -z0 * k);
    for (const lm of Art.landmarks) {
      if (lm.x0 > x0 + 128 || lm.x1 < x0 || lm.z0 > z0 + 128 || lm.z1 < z0) continue;
      c.beginPath(); c.moveTo(lm.P[0], lm.P[1]); for (let q = 1; q < lm.n; q++) c.lineTo(lm.P[q * 2], lm.P[q * 2 + 1]); c.closePath(); c.fill();
    }
    if (Art.bigFountain) { c.beginPath(); c.arc(Art.bigFountain.x, Art.bigFountain.z, 5.2, 0, TAU); c.fill(); }
  });
  Nav.flow(P.x, P.z); navT = 0; flowT = 0;
}

/* ---------------------------------------------------------------- slapping */
function fxSlap(x, z, big) {
  pops.push({ x, z: z - 1.2, t: 0, life: 0.7, txt: pick(WORDS), col: big ? '#ffe14d' : '#fff', size: big ? 1.5 : 1.05, rot: rnd(-0.3, 0.3) });
  for (let i = 0; i < (big ? 9 : 5); i++) { const a = Math.random() * TAU, v = rnd(2, 7); parts.push({ x, z, vx: Math.cos(a) * v, vz: Math.sin(a) * v, t: 0, life: rnd(0.25, 0.5), r: rnd(0.08, 0.2), col: pick(['#fff', '#ffe14d', '#ffb347']), star: 1 }); }
  rings.push({ x, z, t: 0, life: 0.22, r0: 0.3, r1: big ? 2.2 : 1.3, col: '#fff', w: 0.18 });
}
function slapNpc(e, dx, dz, power) {
  const T = TYPES[e.type];
  e.hp -= power > 1 ? 2 : 1;
  const kb = (power > 1 ? 17 : 11.5) / (e.type === 'big' ? 1.6 : 1);
  e.kx = dx * kb + rnd(-1.5, 1.5); e.kz = dz * kb + rnd(-1.5, 1.5);
  e.state = 'fly'; e.t = 0.42; e.spin = rnd(8, 16) * (Math.random() < 0.5 ? -1 : 1); e.rot = e.dir; e.wind = 0; e.slap = -1; e.seat = false;
  combo++; comboT = 2.4;
  const pts = comboMult(); score += pts; mega = Math.min(MEGA_N, mega + 1);
  fxSlap(e.x, e.z, power > 1 || pts > 1);
  if (pts > 1) pops.push({ x: e.x, z: e.z - 2.1, t: 0, life: 0.6, txt: '+' + pts, col: '#f2b632', size: 0.8, rot: 0 });
  void T;
}
function doSlap() {
  if (state !== 'play' || P.cd > 0 || P.hp <= 0) return;
  const megaOn = mega >= MEGA_N;
  // auto-aim at the closest chaser
  let best = null, bd = 3.4 * 3.4;
  for (const e of npcs) { if (e.state === 'fly' || e.state === 'down' || e.state === 'flee') continue; const d = (e.x - P.x) ** 2 + (e.z - P.z) ** 2; if (d < bd) { bd = d; best = e; } }
  if (best) P.dir = Math.atan2(best.z - P.z, best.x - P.x);
  const fx = Math.cos(P.dir), fz = Math.sin(P.dir);
  P.slap = 0; P.cd = megaOn ? 0.5 : 0.3;
  let hits = 0;
  const R = megaOn ? 8.5 : 2.45;
  for (const e of npcs) {
    if (e.state === 'fly' || e.state === 'down' || e.state === 'flee') continue;
    const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
    if (d > R + (e.type === 'big' ? 0.3 : 0)) continue;
    if (!megaOn && d > 0.6 && (dx * fx + dz * fz) / d < 0.25) continue;
    const nx = d > 0.01 ? dx / d : fx, nz = d > 0.01 ? dz / d : fz;
    slapNpc(e, megaOn ? nx : nx * 0.5 + fx * 0.5, megaOn ? nz : nz * 0.5 + fz * 0.5, megaOn ? 2 : 1);
    hits++;
  }
  for (const s of shoes) {                                   // slap a flying slipper back to its owner
    if (s.back || Math.hypot(s.x - P.x, s.z - P.z) > 2.4) continue;
    s.back = true; s.vx = -s.vx * 1.4; s.vz = -s.vz * 1.4; s.t = 0; hits++;
    pops.push({ x: s.x, z: s.z - 1, t: 0, life: 0.7, txt: 'RETOUR!', col: '#7fe0ff', size: 0.9, rot: 0 }); score += 2;
  }
  if (megaOn) {
    mega = 0; cam.shake = 0.9; hitstop = 0.09; Snd.slap(2);
    rings.push({ x: P.x, z: P.z, t: 0, life: 0.45, r0: 0.5, r1: 8.5, col: '#ffe14d', w: 0.5 });
    rings.push({ x: P.x, z: P.z, t: 0, life: 0.6, r0: 0.2, r1: 7, col: '#fff', w: 0.25 });
    toast('MEGA SLAP!', 1.0); flash(0.5);
  } else if (hits) { Snd.slap(1); cam.shake = Math.max(cam.shake, 0.28); hitstop = 0.035; }
  else { Snd.whoosh(); P.cd = 0.55; }                       // a miss leaves you open for a moment
  hud();
}
function flash(a) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; }); }
function hitPlayer(dmg, fromX, fromZ) {
  if (P.inv > 0 || state !== 'play') return;
  P.hp -= dmg; P.inv = 0.85; P.hurt = 0.3; combo = 0;
  const dx = P.x - fromX, dz = P.z - fromZ, d = Math.hypot(dx, dz) || 1;
  P.kx = dx / d * 8; P.kz = dz / d * 8;
  cam.shake = 0.7; Snd.hurt(); flash(0.28);
  pops.push({ x: P.x, z: P.z - 1.4, t: 0, life: 0.8, txt: pick(['AÏE!', 'OUCH!', 'آي!', 'WILI!']), col: '#ff5a4d', size: 1.2, rot: rnd(-0.2, 0.2) });
  for (let i = 0; i < 6; i++) { const a = Math.random() * TAU; parts.push({ x: P.x, z: P.z, vx: Math.cos(a) * 5, vz: Math.sin(a) * 5, t: 0, life: 0.4, r: 0.14, col: '#ff5a4d', star: 1 }); }
  hearts(); hud();
  if (P.hp <= 0) { P.hp = 0; hearts(); gameOver(); }
}

/* ---------------------------------------------------------------- spawning the crowd */
function spawnNpc(x, z, sit) {
  let type = 'citizen'; const r = Math.random();
  if (score >= 40 && r < 0.1) type = 'police';
  else if (score >= 20 && r < 0.22) type = 'auntie';
  else if (score >= 10 && r < 0.36) type = 'big';
  else if (score >= 4 && r < 0.56) type = 'kid';
  const T = TYPES[type];
  npcs.push({ x, z, dir: Math.atan2(P.z - z, P.x - x), type, look: Art.makeLook(type, Math.random), state: sit ? 'sit' : 'chase', t: 0, hp: T.hp, speed: rnd(T.sp[0], T.sp[1]) * (1 + Math.min(0.18, playT / 600)),
    walk: Math.random() * 6, kx: 0, kz: 0, spin: 0, rot: 0, cd: rnd(0.2, 0.8), slap: -1, wind: 0, sx: 0, sz: 0, seat: !!sit, angry: 0, far: 0 });
}
function spawner(dt) {
  spawnCd -= dt;
  let active = 0;
  for (const e of npcs) if (e.state !== 'flee') active++;
  const target = clamp(5 + Math.floor(playT / 7) + Math.floor(score / 6), 5, 42);
  if (active >= target || spawnCd > 0 || !Nav.ready) return;
  spawnCd = active < 4 ? 0.12 : rnd(0.25, 0.6);
  // sometimes a café customer gets up from a terrace chair
  if (Math.random() < 0.3) {
    let found = false;
    World.queryPts('s', P.x - 34, P.z - 34, P.x + 34, P.z + 34, (r, i) => {
      if (found || Math.random() < 0.8) return;
      const D = r.s.s_dat, x = r.cx + D[i * 4] * U, z = r.cz + D[i * 4 + 1] * U;
      if (x > vx0 - 1 && x < vx1 + 1 && z > vz0 - 1 && z < vz1 + 1) return;
      for (const e of npcs) if (Math.abs(e.x - x) < 0.5 && Math.abs(e.z - z) < 0.5) return;
      spawnNpc(x, z, true); npcs[npcs.length - 1].dir = -Math.PI / 2 - D[i * 4 + 2] / 5000; found = true;
    });
    if (found) return;
  }
  const m = 1.5;
  if (Nav.spawnSpot(P.x, P.z, 17, 44, vx0 - m, vz0 - m, vx1 + m, vz1 + m, tmp2)) spawnNpc(tmp2[0], tmp2[1], false);
}

/* ---------------------------------------------------------------- movement helpers */
function moveBody(e, dx, dz, r) {
  if (dx && Nav.free(e.x + dx, e.z, r)) e.x += dx; else if (dx) e.kx = 0;
  if (dz && Nav.free(e.x, e.z + dz, r)) e.z += dz; else if (dz) e.kz = 0;
}
function pushFromCars(e, r) {
  for (const c of cars) {
    const dx = e.x - c.x, dz = e.z - c.z;
    if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
    const fx = Math.sin(c.ang), fz = -Math.cos(c.ang), hl = c.L / 2 - 0.6, t = clamp(dx * fx + dz * fz, -hl, hl);
    const qx = dx - fx * t, qz = dz - fz * t, d = Math.hypot(qx, qz), min = 0.95 + r;
    if (d < min && d > 0.001) { const p = (min - d); if (Nav.free(e.x + qx / d * p, e.z + qz / d * p, r)) { e.x += qx / d * p; e.z += qz / d * p; } }
  }
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  time += dt;
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  if (zoneT > 0 && (zoneT -= dt) <= 0) $('zone').style.opacity = 0;
  World.need(cam.x, cam.z, 950); if ((frame & 127) === 0) World.gc(cam.x, cam.z);
  if (World.endsDirty) World.rebuildEnds();
  if (state === 'title' || state === 'over' || state === 'pause') {
    if (state === 'title') {
      if (!placed && World.need(startD.x, startD.z, 300)) { P.x = startD.x; P.z = startD.z; placePlayer(); }
      const a = time * 0.12; cam.x = P.x + Math.cos(a) * 9; cam.z = P.z + Math.sin(a) * 9;
      if (pendingStart && World.need(startD.x, startD.z, 500)) startGame();
    }
    if (state !== 'pause') updateCars(dt);
    updateFx(dt);
    return;
  }
  playT += dt;
  // ---- player
  let ix = inp.x, iz = inp.z;
  const K = inp.keys;
  if (K.KeyA || K.ArrowLeft || K.KeyQ) ix -= 1; if (K.KeyD || K.ArrowRight) ix += 1;
  if (K.KeyW || K.ArrowUp || K.KeyZ) iz -= 1; if (K.KeyS || K.ArrowDown) iz += 1;
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  P.moving = il > 0.12;
  const sp = 5.25 * (P.slap >= 0 ? 0.75 : 1);
  if (!Nav.ready || Nav.ver !== World.version || Math.hypot(P.x - Nav.cx, P.z - Nav.cz) > 12 || (navT += dt) > 5) rebuildNav();
  else if ((flowT += dt) > 0.18) { Nav.flow(P.x, P.z); flowT = 0; }
  if (Nav.solid(P.x, P.z) && Nav.nearestFree(P.x, P.z, tmp2)) { P.x = tmp2[0]; P.z = tmp2[1]; }
  moveBody(P, (ix * sp + P.kx) * dt, (iz * sp + P.kz) * dt, 0.32);
  P.kx *= Math.exp(-7 * dt); P.kz *= Math.exp(-7 * dt);
  pushFromCars(P, 0.32);
  const pl = World.meta.play; P.x = clamp(P.x, pl[0] + 30, pl[2] - 30); P.z = clamp(P.z, pl[1] + 30, pl[3] - 30);
  if (P.moving) { if (P.slap < 0) { let da = Math.atan2(iz, ix) - P.dir; da = Math.atan2(Math.sin(da), Math.cos(da)); P.dir += da * Math.min(1, dt * 14); } P.walk += dt * 11 * il; }
  if (P.slap >= 0) { P.slap += dt / 0.2; if (P.slap >= 1) P.slap = -1; }
  P.cd -= dt; P.inv -= dt; P.hurt -= dt;
  if (comboT > 0 && (comboT -= dt) <= 0) { combo = 0; hud(); }
  // quartier
  const d = World.districtAt(P.x, P.z);
  if (d !== curD) { curD = d; if (!quartiers.has(d.name)) { quartiers.add(d.name); if (quartiers.size > 1) { score += 5; hud(); pops.push({ x: P.x, z: P.z - 2.4, t: 0, life: 1.2, txt: '+5 NOUVEAU QUARTIER', col: '#f2b632', size: 0.75, rot: 0 }); } } zone(d); }
  // camera
  const lead = P.moving ? 1.6 : 0;
  cam.x += (P.x + ix * lead - cam.x) * Math.min(1, dt * 6); cam.z += (P.z + iz * lead - cam.z) * Math.min(1, dt * 6);
  spawner(dt);
  updateNpcs(dt);
  updateCars(dt);
  // slippers
  for (let i = shoes.length - 1; i >= 0; i--) {
    const s = shoes[i]; s.x += s.vx * dt; s.z += s.vz * dt; s.t += dt; s.rot += dt * 14;
    if (!s.back && Math.hypot(s.x - P.x, s.z - P.z) < 0.6) { hitPlayer(1, s.x - s.vx, s.z - s.vz); shoes.splice(i, 1); continue; }
    if (s.back) { let hit = null; for (const e of npcs) if (e.state !== 'fly' && e.state !== 'down' && Math.hypot(e.x - s.x, e.z - s.z) < 0.8) { hit = e; break; } if (hit) { const L = Math.hypot(s.vx, s.vz) || 1; slapNpc(hit, s.vx / L, s.vz / L, 1); Snd.slap(1); hud(); shoes.splice(i, 1); continue; } }
    if (s.t > 1.6 || Nav.solid(s.x, s.z)) shoes.splice(i, 1);
  }
  // pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.t += dt;
    if (Math.hypot(p.x - P.x, p.z - P.z) < 1.2) {
      if (P.hp < P.max) { P.hp++; hearts(); pops.push({ x: p.x, z: p.z - 1, t: 0, life: 0.9, txt: '+1 ♥ ATAY', col: '#7dff9a', size: 0.9, rot: 0 }); }
      else { score += 5; pops.push({ x: p.x, z: p.z - 1, t: 0, life: 0.9, txt: '+5', col: '#f2b632', size: 0.9, rot: 0 }); }
      Snd.pick(); hud(); pickups.splice(i, 1); continue;
    }
    if (p.t > 16) pickups.splice(i, 1);
  }
  updateFx(dt);
}

function updateFx(dt) {
  for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; p.z -= dt * 1.3; if (p.t > p.life) pops.splice(i, 1); }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= 0.92; p.vz *= 0.92; if (p.t > p.life) parts.splice(i, 1); }
  for (let i = rings.length - 1; i >= 0; i--) { const p = rings[i]; p.t += dt; if (p.t > p.life) rings.splice(i, 1); }
  cam.shake *= Math.exp(-9 * dt);
}

function updateNpcs(dt) {
  for (let i = npcs.length - 1; i >= 0; i--) {
    const e = npcs[i], T = TYPES[e.type];
    let dx = P.x - e.x, dz = P.z - e.z; const d = Math.hypot(dx, dz) || 0.001;
    if (d > 80) { npcs.splice(i, 1); continue; }
    e.cd -= dt; if (e.angry > 0) e.angry -= dt;
    const rad = 0.3 * e.look.k;
    switch (e.state) {
      case 'sit':
        if (d < 12 || (e.t += dt) > 8) { e.state = 'chase'; e.seat = false; pops.push({ x: e.x, z: e.z - 1.3, t: 0, life: 0.7, txt: '!', col: '#ff5a4d', size: 1.1, rot: 0 }); }
        break;
      case 'chase': {
        let tx = dx / d, tz = dz / d, keep = false;
        if (e.type === 'auntie') {                         // she keeps her distance and throws slippers
          if (d < 9.5 && d > 3.5 && e.cd <= 0) { e.state = 'throw'; e.t = 0.5; e.wind = 0.01; break; }
          if (d < 5) { tx = -tx; tz = -tz; keep = true; } else if (d < 8) { tx = tz * 0.6; tz = -dx / d * 0.6; keep = true; }
        }
        if (!keep && d > 2.4 && Nav.steer(e.x, e.z, tmp2)) { tx = tmp2[0]; tz = tmp2[1]; }
        e.sx += (tx - e.sx) * Math.min(1, dt * 9); e.sz += (tz - e.sz) * Math.min(1, dt * 9);
        const sl = Math.hypot(e.sx, e.sz) || 1, v = e.speed * (e.angry > 0 ? 1.12 : 1) * (d < 1.0 ? 0.3 : 1);
        const ox = e.x, oz = e.z;
        moveBody(e, e.sx / sl * v * dt, e.sz / sl * v * dt, rad);
        e.far = Math.hypot(e.x - ox, e.z - oz) < v * dt * 0.25 ? e.far + dt : 0;
        if (e.far > 2.5 && d > 30) { npcs.splice(i, 1); continue; }             // hopelessly stuck far away: recycle
        if (e.far > 0.6) { e.sx += rnd(-1, 1); e.sz += rnd(-1, 1); }
        let da = Math.atan2(e.sz, e.sx) - e.dir; da = Math.atan2(Math.sin(da), Math.cos(da)); e.dir += da * Math.min(1, dt * 12);
        e.walk += dt * v * 2.3;
        if (e.type !== 'auntie' && d < T.reach * e.look.k + 0.25 && e.cd <= 0) { e.state = 'wind'; e.t = T.wind; e.wind = 0.01; }
        break;
      }
      case 'wind':
        e.dir = Math.atan2(dz, dx); e.t -= dt; e.wind = 1 - e.t / T.wind;
        if (e.t <= 0) {
          e.wind = 0; e.slap = 0; e.state = 'recover'; e.t = 0.5; e.cd = rnd(0.5, 1.1);
          if (d < T.reach * e.look.k + 0.85) hitPlayer(T.dmg, e.x, e.z); else Snd.whoosh();
        }
        break;
      case 'throw':
        e.dir = Math.atan2(dz, dx); e.t -= dt; e.wind = 1 - e.t / 0.5;
        if (e.t <= 0) {
          e.wind = 0; e.slap = 0; e.state = 'recover'; e.t = 0.6; e.cd = rnd(2.0, 3.2);
          const lead = d / 10.5, ax = P.x + (P.moving ? Math.cos(P.dir) * 5 * lead * 0.6 : 0) - e.x, az = P.z + (P.moving ? Math.sin(P.dir) * 5 * lead * 0.6 : 0) - e.z, al = Math.hypot(ax, az) || 1;
          shoes.push({ x: e.x, z: e.z, vx: ax / al * 10.5, vz: az / al * 10.5, t: 0, rot: 0, back: false }); Snd.whoosh();
        }
        break;
      case 'recover':
        if (e.slap >= 0) { e.slap += dt / 0.22; if (e.slap >= 1) e.slap = -1; }
        if ((e.t -= dt) <= 0) e.state = 'chase';
        break;
      case 'fly':
        moveBody(e, e.kx * dt, e.kz * dt, rad); e.kx *= Math.exp(-4.5 * dt); e.kz *= Math.exp(-4.5 * dt); e.rot += e.spin * dt;
        if ((e.t -= dt) <= 0) { e.state = 'down'; e.t = e.hp <= 0 ? 1.1 : rnd(1.5, 2.3); }
        break;
      case 'down':
        if ((e.t -= dt) <= 0) {
          if (e.hp <= 0) {
            e.state = 'flee'; e.t = 5; kos++; Snd.ko();
            if (Math.random() < 0.13) pickups.push({ x: e.x, z: e.z, t: 0 });
          } else { e.state = 'chase'; e.angry = 6; e.speed *= 1.06; e.cd = 0.4; e.sx = e.sz = 0; }
        }
        break;
      case 'flee':
        moveBody(e, -dx / d * 5.5 * dt, -dz / d * 5.5 * dt, rad); e.dir = Math.atan2(-dz, -dx); e.walk += dt * 13;
        if ((e.t -= dt) <= 0 || d > 45) { npcs.splice(i, 1); continue; }
        break;
    }
    if (e.state !== 'sit' && e.state !== 'fly') pushFromCars(e, rad);
  }
  // keep the crowd from stacking into one blob
  for (let i = 0; i < npcs.length; i++) {
    const a = npcs[i]; if (a.state === 'sit' || a.state === 'fly' || a.state === 'down') continue;
    for (let j = i + 1; j < npcs.length; j++) {
      const b = npcs[j]; if (b.state === 'sit' || b.state === 'fly' || b.state === 'down') continue;
      const dx = b.x - a.x, dz = b.z - a.z; if (Math.abs(dx) > 0.8 || Math.abs(dz) > 0.8) continue;
      const d = Math.hypot(dx, dz), min = 0.34 * (a.look.k + b.look.k);
      if (d < min && d > 0.001) { const p = (min - d) * 0.5, ux = dx / d * p, uz = dz / d * p; if (Nav.free(a.x - ux, a.z - uz, 0.2)) { a.x -= ux; a.z -= uz; } if (Nav.free(b.x + ux, b.z + uz, 0.2)) { b.x += ux; b.z += uz; } }
    }
  }
}

/* ---------------------------------------------------------------- traffic */
const CSPEED = [12, 10.5, 9, 7.5, 6.5, 4];
const roadList = [];
function spawnCar() {
  roadList.length = 0;
  World.queryIdx('r', cam.x - 75, cam.z - 75, cam.x + 75, cam.z + 75, (r, i) => { const I = r.s.r_info, c = I[i * 12 + 1]; if (c <= 4 && r.rLen[i] > 12 && I[i * 12 + 2] >= 20) roadList.push(r, i); });
  if (!roadList.length) return;
  for (let t = 0; t < 6; t++) {
    const q = ((Math.random() * roadList.length / 2) | 0) * 2, r = roadList[q], i = roadList[q + 1], I = r.s.r_info, b = i * 12;
    const s = Math.random() * r.rLen[i]; World.roadAt(r, i, s, tmp);
    if (tmp[0] > vx0 - 6 && tmp[0] < vx1 + 6 && tmp[1] > vz0 - 6 && tmp[1] < vz1 + 6) continue;
    let ok = true; for (const c of cars) if (Math.hypot(c.x - tmp[0], c.z - tmp[1]) < 14) { ok = false; break; }
    if (!ok) continue;
    const one = I[b + 4] & 1, cls = I[b + 1], rr = Math.random();
    let kind = rr < 0.22 ? 0 : rr < 0.42 ? 1 : rr < 0.64 ? 2 : rr < 0.7 ? 3 : rr < 0.76 ? 4 : rr < 0.86 ? 5 : rr < 0.9 ? 6 : rr < 0.94 && cls <= 3 ? 7 : 8;
    const dim = Art.CARDIM[kind];
    cars.push({ r, i, s, d: one || Math.random() < 0.5 ? 1 : -1, sp: 0, kind, col: (Math.random() * 12) | 0, x: tmp[0], z: tmp[1], ang: 0, L: dim[1], lane: Math.random(), honk: 0, init: true });
    return;
  }
}
function updateCars(dt) {
  if ((carCd -= dt) <= 0) { carCd = 0.5; if (cars.length < 10) spawnCar(); }
  for (let q = cars.length - 1; q >= 0; q--) {
    const c = cars[q], r = c.r;
    if (!World.regions.has(r.key) || Math.hypot(c.x - cam.x, c.z - cam.z) > 105) { cars.splice(q, 1); continue; }
    const I = r.s.r_info, b = c.i * 12, cls = I[b + 1], w = I[b + 2] * 0.2, one = I[b + 4] & 1, lf = I[b + 5], lb = I[b + 6];
    World.roadAt(r, c.i, c.s, tmp);
    const fx = tmp[2] * c.d, fz = tmp[3] * c.d;
    // lane offset to the right of travel
    const lanes = one ? Math.max(1, lf) : Math.max(1, c.d > 0 ? lf : lb), lw = one ? w / lanes : w / 2 / lanes;
    const li = Math.min(lanes - 1, (c.lane * lanes) | 0), off = one ? (li + 0.5) * lw - w / 2 : (li + 0.5) * lw;
    const tx = tmp[0] - fz * off * (one ? -1 : 1), tz = tmp[1] + fx * off * (one ? -1 : 1);
    if (c.init) { c.x = tx; c.z = tz; c.ang = Math.atan2(fx, -fz); c.init = false; }
    // brake for anyone in front
    let want = CSPEED[cls] * (c.kind === 7 ? 0.8 : 1), block = false;
    const ahead = (x, z, rad) => { const dx = x - c.x, dz = z - c.z, f = dx * fx + dz * fz; return f > 0 && f < c.L / 2 + 5.5 + c.sp * 0.5 && Math.abs(dx * -fz + dz * fx) < rad; };
    if (state === 'play' && ahead(P.x, P.z, 1.5)) block = true;
    if (!block) for (const e of npcs) if (ahead(e.x, e.z, 1.4)) { block = true; break; }
    if (!block) for (const o of cars) if (o !== c && ahead(o.x, o.z, 1.6)) { block = true; break; }
    if (block) { want = 0; if (c.sp > 2 && c.honk <= 0 && Math.hypot(c.x - P.x, c.z - P.z) < 20) { Snd.horn(); c.honk = 3; } }
    c.honk -= dt;
    c.sp += clamp(want - c.sp, -16 * dt, 5 * dt);
    c.s += c.sp * dt * c.d;
    const L = r.rLen[c.i];
    if (c.s > L || c.s < 0) {                               // hop onto a connected piece
      const end = c.s > L ? 1 : 0, P_ = r.s.r_pts, o = r.rOff[c.i] + (end ? (I[b] - 1) * 2 : 0);
      const arr = World.ends.get(World.endKey(r, P_[o], P_[o + 1]));
      let n = 0, pr = null, pi = 0, pe = 0;
      if (arr) for (let k = 0; k < arr.length; k += 3) {
        const r2 = arr[k], i2 = arr[k + 1], e2 = arr[k + 2];
        if (r2 === r && i2 === c.i) continue;
        const I2 = r2.s.r_info, b2 = i2 * 12;
        if ((I2[b2 + 4] & 1) && e2 !== 0) continue;         // would enter a one-way street the wrong way
        if (I2[b2 + 1] > 4 && Math.random() < 0.8) continue;
        n++; if (Math.random() < 1 / n) { pr = r2; pi = i2; pe = e2; }
      }
      if (!pr) { cars.splice(q, 1); continue; }
      c.r = pr; c.i = pi; c.d = pe === 0 ? 1 : -1; c.s = pe === 0 ? 0.01 : pr.rLen[pi] - 0.01;
      continue;
    }
    c.x += (tx - c.x) * Math.min(1, dt * 6); c.z += (tz - c.z) * Math.min(1, dt * 6);
    let da = Math.atan2(fx, -fz) - c.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); c.ang += da * Math.min(1, dt * 5);
  }
}

/* ---------------------------------------------------------------- render */
const VR = [], VI = [], DL = [], dlPool = [];
let dlN = 0;
function item(y, t, a, b) { let o = dlPool[dlN]; if (!o) o = dlPool[dlN] = { y: 0, t: 0, a: null, b: 0 }; o.y = y; o.t = t; o.a = a; o.b = b; DL[dlN++] = o; }
const DASH_KERB = [22, 22], DASH_MID = [60, 90], DASH_ZEB = [10, 10], DASH_SLEEP = [6, 14], NODASH = [];
const waterM = typeof DOMMatrix !== 'undefined' ? new DOMMatrix() : null;

function roadPath(r, i) {
  const Pp = r.s.r_pts, o = r.rOff[i], n = r.s.r_info[i * 12];
  g.beginPath(); g.moveTo(Pp[o], Pp[o + 1]);
  for (let k = 1; k < n; k++) g.lineTo(Pp[o + k * 2], Pp[o + k * 2 + 1]);
}

function render() {
  frame++;
  const shx = (Math.random() - 0.5) * cam.shake * S * 0.9, shy = (Math.random() - 0.5) * cam.shake * S * 0.9;
  C.S = S; C.ox = W / 2 - cam.x * S + shx; C.oy = H / 2 - cam.z * S + shy;
  vx0 = cam.x - W / 2 / S; vx1 = cam.x + W / 2 / S; vz0 = cam.z - H / 2 / S; vz1 = cam.z + H / 2 / S;
  const su = S * U;
  // ---- ground
  g.setTransform(su, 0, 0, su, C.ox, C.oy);
  g.fillStyle = Art.pat.land; g.fillRect(vx0 / U - 2, vz0 / U - 2, (vx1 - vx0) / U + 4, (vz1 - vz0) / U + 4);
  if (waterM && Art.pat.water.setTransform) { waterM.a = waterM.d = 1 / (24 * U); waterM.e = Math.sin(time * 0.5) * 14 + time * 6 % 3840; waterM.f = Math.cos(time * 0.4) * 10; Art.pat.water.setTransform(waterM); }
  for (const r of World.regions.values()) {
    if (vx1 < r.x0 || vx0 > r.x1 || vz1 < r.z0 || vz0 > r.z1) continue;
    setR(g, r, 1);
    const Pp = r.s.g_pts;
    for (const p of r.ground) {
      if (p.x0 > vx1 || p.x1 < vx0 || p.z0 > vz1 || p.z1 < vz0) continue;
      g.beginPath();
      for (let q = 0; q < p.rings.length; q += 2) {
        const o = p.rings[q], n = p.rings[q + 1];
        g.moveTo(Pp[o], Pp[o + 1]);
        for (let i = 1; i < n; i++) g.lineTo(Pp[o + i * 2], Pp[o + i * 2 + 1]);
        g.closePath();
      }
      g.fillStyle = Art.GPAT[p.type]; g.fill('evenodd');
    }
  }
  // ---- roads
  let vn = 0;
  World.queryIdx('r', vx0 - 1, vz0 - 1, vx1 + 1, vz1 + 1, (r, i) => { VR[vn] = r; VI[vn++] = i; });
  g.lineCap = 'round'; g.lineJoin = 'round';
  let lastR = null;
  const use = r => { if (r !== lastR) { setR(g, r, 1); lastR = r; } };
  for (let q = 0; q < vn; q++) {                              // sidewalks
    const r = VR[q], i = VI[q], I = r.s.r_info, b = i * 12;
    if (I[b + 1] > 5 || !I[b + 3]) continue;
    use(r); roadPath(r, i); g.lineWidth = (I[b + 2] * 0.2 + I[b + 3] * 0.4) / U; g.strokeStyle = Art.pat.walk; g.stroke();
  }
  for (let q = 0; q < vn; q++) {                              // kerbs (red / white like the Casablanca ones)
    const r = VR[q], i = VI[q], I = r.s.r_info, b = i * 12, cls = I[b + 1];
    if (cls > 4 || !I[b + 3]) continue;
    use(r); roadPath(r, i); g.lineWidth = (I[b + 2] * 0.2 + 0.56) / U; g.strokeStyle = '#f3ecdb'; g.stroke();
    if (cls >= 2) { g.setLineDash(DASH_KERB); g.lineCap = 'butt'; g.strokeStyle = '#c8402c'; g.stroke(); g.setLineDash(NODASH); g.lineCap = 'round'; }
  }
  for (let q = 0; q < vn; q++) {                              // carriageway / lanes / paths
    const r = VR[q], i = VI[q], I = r.s.r_info, b = i * 12, cls = I[b + 1], w = I[b + 2] * 0.2;
    use(r); roadPath(r, i); g.lineWidth = w / U;
    if (cls <= 5 && (I[b + 3] || cls <= 2 || w > 5.2)) g.strokeStyle = Art.pat.asphalt;
    else if (cls <= 5) { g.lineWidth = (w + 0.3) / U; g.strokeStyle = '#a98b66'; g.stroke(); g.lineWidth = w / U; g.strokeStyle = '#c4a57c'; }
    else if (cls === 6) g.strokeStyle = Art.pat.plaza;
    else { g.lineWidth = (w + 0.25) / U; g.strokeStyle = 'rgba(120,90,60,.5)'; g.stroke(); g.lineWidth = w / U; g.strokeStyle = '#dcc7a2'; }
    g.stroke();
  }
  g.lineCap = 'butt';
  for (let q = 0; q < vn; q++) {                              // markings
    const r = VR[q], i = VI[q], I = r.s.r_info, b = i * 12, cls = I[b + 1], w = I[b + 2] * 0.2, fl = I[b + 4];
    if (cls > 4 || !I[b + 3]) continue;
    use(r);
    if (((fl & 1) ? I[b + 5] === 2 : w >= 5.6) && !(fl & 2)) { roadPath(r, i); g.setLineDash(DASH_MID); g.lineWidth = 0.15 / U; g.strokeStyle = 'rgba(245,245,238,.85)'; g.stroke(); g.setLineDash(NODASH); }
    for (let e = 0; e < 2; e++) {                             // zebra crossings at junction ends
      const tr = I[b + 7 + e] * 0.2; if (!tr || r.rLen[i] < tr * 2 + 9) continue;
      World.roadAt(r, i, e ? r.rLen[i] - tr - 1.9 : tr + 1.9, tmp);
      const cx = (tmp[0] - r.cx) / U, cz = (tmp[1] - r.cz) / U, hx = -tmp[3] * (w / 2 - 0.25) / U, hz = tmp[2] * (w / 2 - 0.25) / U;
      g.beginPath(); g.moveTo(cx - hx, cz - hz); g.lineTo(cx + hx, cz + hz);
      g.setLineDash(DASH_ZEB); g.lineWidth = 2.7 / U; g.strokeStyle = 'rgba(245,245,238,.9)'; g.stroke(); g.setLineDash(NODASH);
    }
  }
  // ---- rails + garden walls
  World.queryIdx('t', vx0, vz0, vx1, vz1, (r, i) => {
    setR(g, r, 1);
    const Pp = r.s.t_pts, o = r.tOff[i], n = r.s.t_info[i * 2], kind = r.s.t_info[i * 2 + 1];
    g.beginPath(); g.moveTo(Pp[o], Pp[o + 1]); for (let k = 1; k < n; k++) g.lineTo(Pp[o + k * 2], Pp[o + k * 2 + 1]);
    if (kind) { g.lineWidth = 3.0 / U; g.strokeStyle = '#8f897d'; g.stroke(); g.setLineDash(DASH_SLEEP); g.lineWidth = 2.2 / U; g.strokeStyle = '#5b4a3a'; g.stroke(); g.setLineDash(NODASH); }
    g.lineWidth = 1.5 / U; g.strokeStyle = '#b9bdc2'; g.stroke(); g.lineWidth = 1.2 / U; g.strokeStyle = kind ? '#8f897d' : '#44474d'; g.stroke();
  });
  g.lineCap = 'round';
  World.queryIdx('w', vx0 - 1, vz0 - 1, vx1 + 1, vz1 + 1, (r, i) => {
    setR(g, r, 1);
    const Pp = r.s.w_pts, o = r.wOff[i], n = r.s.w_info[i * 2];
    g.beginPath(); g.moveTo(Pp[o], Pp[o + 1]); for (let k = 1; k < n; k++) g.lineTo(Pp[o + k * 2], Pp[o + k * 2 + 1]);
    g.lineWidth = 0.75 / U; g.strokeStyle = 'rgba(70,45,25,.55)'; g.stroke(); g.lineWidth = 0.5 / U; g.strokeStyle = '#eadbbb'; g.stroke();
  });

  // ---- collect everything that stands up, cast shadows, then paint back to front
  dlN = 0;
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, shc.width, shc.height); sg.fillStyle = '#000'; sg.strokeStyle = '#000'; sg.lineCap = 'round';
  World.queryIdx('b', vx0 - 36, vz0 - 36, vx1 + 4, vz1 + 22, (r, i) => { Art.building(null, sg, r, i); item(r.bBox[i * 4 + 3], 0, r, i); });
  for (const lm of Art.landmarks) { if (lm.x0 > vx1 + 4 || lm.x1 < vx0 - 60 || lm.z0 > vz1 + 45 || lm.z1 < vz0 - 60) continue; Art.landmark(null, sg, lm); item(lm.z1, 6, lm, 0); }
  World.queryPts('p', vx0 - 9, vz0 - 9, vx1 + 9, vz1 + 14, (r, i) => {
    const D = r.s.p_dat, kind = D[i * 4 + 2] & 255, d = Art.propDef[kind]; if (!d) return;
    const x = r.cx + D[i * 4] * U, z = r.cz + D[i * 4 + 1] * U, v = (D[i * 4 + 2] >> 8) & 127, sp = Art.propSprite(kind, v), k = r.s.p_sc[i] / 50, rot = d.rot ? -D[i * 4 + 3] / 5000 : 0;
    if (d.flat) { Art.blit(g, sp, x, z, rot + v, 1); return; }
    if (d.pole) { sg.setTransform(S * 0.5, 0, 0, S * 0.5, C.ox * 0.5, C.oy * 0.5); sg.lineWidth = 0.22; sg.beginPath(); sg.moveTo(x, z); sg.lineTo(x + SH[0] * d.pole, z + SH[1] * d.pole); sg.stroke(); }
    else Art.blitShadow(sg, sp, x, z, rot, k, (d.lift || 0.15) * k);
    item(z + (d.bias || 0), 1, r, i);
  });
  if (Art.bigFountain) { const f = Art.bigFountain; if (f.x > vx0 - 8 && f.x < vx1 + 8 && f.z > vz0 - 8 && f.z < vz1 + 8) item(f.z - 5, 10, f, 0); }
  World.queryPts('c', vx0 - 4, vz0 - 4, vx1 + 4, vz1 + 4, (r, i) => {
    const D = r.s.c_dat, x = r.cx + D[i * 4] * U, z = r.cz + D[i * 4 + 1] * U;
    Art.blitShadow(sg, Art.car(D[i * 4 + 3] & 255, (D[i * 4 + 3] >> 8) & 127), x, z, -D[i * 4 + 2] / 5000, 1, 0.12);
    item(z + 0.8, 2, r, i);
  });
  for (const c of cars) { if (c.x < vx0 - 8 || c.x > vx1 + 8 || c.z < vz0 - 8 || c.z > vz1 + 8) continue; Art.blitShadow(sg, Art.car(c.kind, c.col), c.x, c.z, c.ang, 1, 0.12); item(c.z + 0.8, 3, c, 0); }
  // trams ride the real lines on a timetable
  for (const t of World.meta.tram) {
    const n = Math.max(1, Math.round(t.len / 1500));
    for (let k = 0; k < n; k++) {
      const s0 = (time * 9 + k * t.len / n) % t.len;
      for (let sec = 0; sec < 3; sec++) {
        const s = s0 - sec * 10.3; if (s < 5 || s > t.len - 5) continue;
        let lo = 0, hi = t.cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t.cum[m] <= s) lo = m; else hi = m; }
        const ax = t.pts[lo * 2], az = t.pts[lo * 2 + 1], bx = t.pts[hi * 2], bz = t.pts[hi * 2 + 1], f = (s - t.cum[lo]) / ((t.cum[hi] - t.cum[lo]) || 1);
        const x = ax + (bx - ax) * f, z = az + (bz - az) * f;
        if (x < vx0 - 8 || x > vx1 + 8 || z < vz0 - 8 || z > vz1 + 8) continue;
        const o = dlPool[dlN] || (dlPool[dlN] = { y: 0, t: 0, a: null, b: 0 }); o.y = z + 1; o.t = 8; o.a = null; o.b = Math.atan2(bx - ax, -(bz - az)); o.x = x; o.z = z; DL[dlN++] = o;
        Art.blitShadow(sg, Art.tram(), x, z, o.b, 1, 0.2);
      }
    }
  }
  sg.setTransform(S * 0.5, 0, 0, S * 0.5, C.ox * 0.5, C.oy * 0.5);
  const blobSh = (x, z, rx, rz) => { sg.beginPath(); sg.ellipse(x + 0.12, z + 0.1, rx, rz, 0.4, 0, TAU); sg.fill(); };
  for (const e of npcs) { if (e.x < vx0 - 2 || e.x > vx1 + 2 || e.z < vz0 - 2 || e.z > vz1 + 3) continue; const k = e.look.k; blobSh(e.x + (e.state === 'fly' ? 0.5 : 0), e.z + (e.state === 'fly' ? 0.4 : 0), 0.56 * k, 0.4 * k); item(e.z, 4, e, 0); }
  if (state === 'play' || state === 'over' || state === 'pause') { blobSh(P.x, P.z, 0.6, 0.42); item(P.z + 0.01, 5, P, 0); }
  for (const p of pickups) { blobSh(p.x, p.z, 0.3, 0.2); item(p.z - 0.2, 7, p, 0); }
  for (const s of shoes) { blobSh(s.x + 0.3, s.z + 0.3, 0.2, 0.14); item(s.z + 0.5, 9, s, 0); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.3; g.drawImage(shc, 0, 0, W, H); g.globalAlpha = 1;

  DL.length = dlN; DL.sort((a, b) => a.y - b.y);
  for (let q = 0; q < dlN; q++) {
    const it = DL[q];
    switch (it.t) {
      case 0: Art.building(g, null, it.a, it.b); break;
      case 6: Art.landmark(g, null, it.a); break;
      case 1: drawProp(it.a, it.b); break;
      case 2: { const D = it.a.s.c_dat, i = it.b; Art.blit(g, Art.car(D[i * 4 + 3] & 255, (D[i * 4 + 3] >> 8) & 127), it.a.cx + D[i * 4] * U, it.a.cz + D[i * 4 + 1] * U, -D[i * 4 + 2] / 5000, 1); break; }
      case 3: Art.blit(g, Art.car(it.a.kind, it.a.col), it.a.x, it.a.z, it.a.ang, 1); break;
      case 8: Art.blit(g, Art.tram(), it.x, it.z, it.b, 1); break;
      case 10: Art.blit(g, Art.get('bigf', () => Art.mk(5.2, 5.2, c => Art.fountainDef.d(c))), it.a.x, it.a.z, 0, 2.1); break;
      case 4: drawNpc(it.a); break;
      case 5: drawPlayer(); break;
      case 7: drawPickup(it.a); break;
      case 9: { const s = it.a; setW(g, 1); g.translate(s.x, s.z - 0.6); g.rotate(s.rot); g.fillStyle = s.back ? '#7fe0ff' : '#b3261e'; Art.rr(g, -0.3, -0.13, 0.6, 0.26, 0.12); g.fill(); g.strokeStyle = '#2b1d14'; g.lineWidth = 0.05; g.stroke(); g.fillStyle = '#f2c230'; g.fillRect(-0.05, -0.13, 0.14, 0.26); break; }
    }
  }
  // ---- anyone hidden behind a lifted roof still shows through as a ghost
  g.globalAlpha = 0.36;
  for (const e of npcs) if (e.x > vx0 - 1 && e.x < vx1 + 1 && e.z > vz0 - 1 && e.z < vz1 + 2) drawNpc(e);
  if (state === 'play' || state === 'pause') drawPlayer(0.55);
  g.globalAlpha = 1;
  // ---- overlays
  setW(g, 1);
  for (const p of rings) { const f = p.t / p.life; g.globalAlpha = 1 - f; g.strokeStyle = p.col; g.lineWidth = p.w * (1 - f * 0.6); g.beginPath(); g.arc(p.x, p.z, p.r0 + (p.r1 - p.r0) * f, 0, TAU); g.stroke(); }
  for (const p of parts) { const f = p.t / p.life; g.globalAlpha = 1 - f; g.fillStyle = p.col; star(p.x, p.z, p.r * (1 - f * 0.4), p.t * 9); }
  g.globalAlpha = 1;
  if (state === 'play' || state === 'pause') {                // you are always visible, even behind a roof
    g.strokeStyle = 'rgba(255,225,77,.85)'; g.lineWidth = 0.09; g.beginPath(); g.arc(P.x, P.z, 0.86 + Math.sin(time * 6) * 0.05, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,225,77,.9)'; g.beginPath(); g.moveTo(P.x, P.z - 1.95); g.lineTo(P.x - 0.26, P.z - 2.4); g.lineTo(P.x + 0.26, P.z - 2.4); g.closePath(); g.fill();
  }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (const l of Art.labels) {
    if (l.x < vx0 - 30 || l.x > vx1 + 30 || l.z < vz0 - 30 || l.z > vz1 + 40) continue;
    g.font = '900 0.95px -apple-system,"Avenir Next","Segoe UI",Arial,sans-serif'; g.lineWidth = 0.22; g.strokeStyle = 'rgba(43,29,20,.85)'; g.fillStyle = '#f4e6c8';
    g.globalAlpha = 0.9; g.strokeText(l.name.toUpperCase(), l.x, l.z - 7); g.fillText(l.name.toUpperCase(), l.x, l.z - 7); g.globalAlpha = 1;
  }
  for (const p of pops) {
    const f = p.t / p.life, k = p.size * (f < 0.15 ? 0.5 + f / 0.15 * 0.7 : 1.2 - (f - 0.15) * 0.25);
    g.save(); g.translate(p.x, p.z); g.rotate(p.rot); g.globalAlpha = f > 0.7 ? (1 - f) / 0.3 : 1;
    g.font = `900 ${k}px -apple-system,"Avenir Next","Arial Black","Segoe UI",Arial,sans-serif`; g.lineWidth = k * 0.22; g.strokeStyle = '#2b1d14'; g.fillStyle = p.col;
    g.strokeText(p.txt, 0, 0); g.fillText(p.txt, 0, 0); g.restore();
  }
  g.globalAlpha = 1;
  if (state === 'play') {                                     // arrows on the screen edge toward off-screen chasers
    g.setTransform(1, 0, 0, 1, 0, 0);
    const mx = 26 * DPR, my = 26 * DPR;
    for (const e of npcs) {
      if (e.state !== 'chase' || (e.x > vx0 && e.x < vx1 && e.z > vz0 && e.z < vz1)) continue;
      const dx = e.x - cam.x, dz = e.z - cam.z, sc = Math.min((W / 2 - mx) / Math.abs(dx * S || 1), (H / 2 - my) / Math.abs(dz * S || 1));
      const x = W / 2 + dx * S * sc, y = H / 2 + dz * S * sc, a = Math.atan2(dz, dx), r = 9 * DPR;
      g.fillStyle = 'rgba(229,56,59,.85)'; g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a + 2.5) * r, y + Math.sin(a + 2.5) * r); g.lineTo(x + Math.cos(a - 2.5) * r, y + Math.sin(a - 2.5) * r); g.closePath(); g.fill();
    }
  }
}
function star(x, z, r, rot) {
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + i * 0.7854, rr = i & 1 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, z + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
function drawProp(r, i) {
  const D = r.s.p_dat, kind = D[i * 4 + 2] & 255, d = Art.propDef[kind];
  const x = r.cx + D[i * 4] * U, z = r.cz + D[i * 4 + 1] * U, v = (D[i * 4 + 2] >> 8) & 127, k = r.s.p_sc[i] / 50, rot = d.rot ? -D[i * 4 + 3] / 5000 : 0;
  const lift = (d.lift || 0) * k;
  if (d.trunk) { setW(g, 1); g.strokeStyle = '#6b4a2b'; g.lineWidth = 0.34 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, z); g.lineTo(x + 0.15, z - lift); g.stroke(); g.strokeStyle = 'rgba(40,22,10,.35)'; g.lineWidth = 0.1; g.beginPath(); g.moveTo(x + 0.12 * k, z); g.lineTo(x + 0.27, z - lift); g.stroke(); }
  if (d.tower) { setW(g, 1); const w = 2.1 * k; g.fillStyle = '#e3cfa4'; g.fillRect(x - w, z - lift, w * 2, lift + w); g.fillStyle = '#c9b287'; g.fillRect(x - w, z + w * 0.4, w * 2, w * 0.6); g.fillStyle = '#3c4d5e'; for (let y = z - lift + w + 1.2; y < z; y += 2.6) g.fillRect(x - 0.3 * k, y, 0.6 * k, 1.1); }
  const sway = d.trunk ? Math.sin(time * 1.3 + x * 0.3) * 0.035 : 0;
  Art.blit(g, Art.propSprite(kind, v), x + (d.trunk ? 0.15 : 0), z - lift, rot + sway + (d.trunk ? v * 1.3 : 0), k);
}
function drawNpc(e) {
  setW(g, 1);
  const fly = e.state === 'fly', down = e.state === 'down';
  g.translate(e.x, e.z - (fly ? 0.5 : 0));
  if (e.angry > 0 && !fly && !down) { g.fillStyle = 'rgba(229,56,59,.28)'; g.beginPath(); g.arc(0, 0, 0.62 * e.look.k, 0, TAU); g.fill(); }
  if (e.wind > 0) { g.fillStyle = `rgba(255,70,50,${0.25 + e.wind * 0.35})`; g.beginPath(); g.arc(0, 0, (0.55 + e.wind * 0.3) * e.look.k, 0, TAU); g.fill(); }
  g.save(); g.rotate(fly || down ? e.rot : e.dir);
  Art.person(g, e.look, e.state === 'sit' ? 0 : e.walk, e.slap, e.wind, fly || down, e.state === 'sit');
  g.restore();
  if (down && e.hp > 0) { g.fillStyle = '#ffe14d'; for (let k = 0; k < 3; k++) { const a = time * 5 + k * 2.094; star(Math.cos(a) * 0.55, -0.75 + Math.sin(a) * 0.2, 0.16, a); } }
  if (e.wind > 0) { g.font = '900 0.9px Arial'; g.textAlign = 'center'; g.fillStyle = '#ff3b2f'; g.strokeStyle = '#fff'; g.lineWidth = 0.14; g.strokeText('!', 0, -1.25); g.fillText('!', 0, -1.25); }
  if (e.state === 'flee') { g.font = '900 0.55px Arial'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#2b1d14'; g.lineWidth = 0.1; g.strokeText('💨', 0, -1.1); g.fillText('💨', 0, -1.1); }
}
function drawPlayer(ghost) {
  setW(g, 1);
  g.translate(P.x, P.z);
  if (ghost) g.globalAlpha = ghost;
  else if (P.inv > 0 && state === 'play' && Math.floor(time * 20) % 2) g.globalAlpha = 0.45;
  g.rotate(P.dir);
  Art.person(g, P.look || (P.look = Art.makeLook('player', Math.random)), P.moving ? P.walk : 0, P.slap, 0, state === 'over', false);
  g.globalAlpha = 1;
}
function drawPickup(p) {
  setW(g, 1);
  const b = Math.sin(time * 5 + p.x) * 0.08;
  g.translate(p.x, p.z - 0.35 + b);
  if (p.t > 12 && Math.floor(time * 8) % 2) g.globalAlpha = 0.4;
  g.fillStyle = 'rgba(125,255,154,.3)'; g.beginPath(); g.arc(0, 0, 0.55, 0, TAU); g.fill();
  g.fillStyle = '#e9f3f5'; g.beginPath(); g.moveTo(-0.2, -0.3); g.lineTo(0.2, -0.3); g.lineTo(0.15, 0.3); g.lineTo(-0.15, 0.3); g.closePath(); g.fill();
  g.fillStyle = '#c98a2b'; g.beginPath(); g.moveTo(-0.18, -0.12); g.lineTo(0.18, -0.12); g.lineTo(0.15, 0.3); g.lineTo(-0.15, 0.3); g.closePath(); g.fill();
  g.fillStyle = '#3d8040'; g.beginPath(); g.ellipse(0.04, -0.2, 0.12, 0.05, -0.5, 0, TAU); g.fill();
  g.strokeStyle = '#2b1d14'; g.lineWidth = 0.04; g.beginPath(); g.moveTo(-0.2, -0.3); g.lineTo(0.2, -0.3); g.lineTo(0.15, 0.3); g.lineTo(-0.15, 0.3); g.closePath(); g.stroke();
  g.globalAlpha = 1;
}

/* ---------------------------------------------------------------- main loop */
let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  if (hitstop > 0) { hitstop -= dt; dt *= 0.08; }
  try { update(dt); render(); } catch (e) { console.error(e); if (!loop.err) { loop.err = true; $('loadmsg').textContent = String(e); } }
}

/* ---------------------------------------------------------------- offline pack: cache every region of the city */
async function offlinePack() {
  const lbl = $('offline');
  if (!('caches' in window) || location.protocol === 'file:') { lbl.textContent = ''; return; }
  const keys = Object.keys(World.meta.regions), cache = await caches.open('csc-data-v1');
  let done = 0, fail = 0;
  for (const k of keys) {
    const url = 'data/r_' + k + '.bin';
    try {
      if (!(await cache.match(url))) { const res = await fetch(url); if (res.ok) await cache.put(url, res.clone()); else fail++; await new Promise(r => setTimeout(r, state === 'play' ? 400 : 40)); }
    } catch (e) { fail++; }
    done++;
    lbl.textContent = fail ? `Offline pack: ${done - fail}/${keys.length} (connect to finish)` : done < keys.length ? `Downloading Casablanca for offline play… ${Math.round(done / keys.length * 100)}%` : '✅ Ready offline — whole city on this phone';
  }
}

async function boot() {
  resize();
  try {
    await World.init();
  } catch (e) { $('loadmsg').textContent = 'Could not load the city data. Check your connection and reload.'; return; }
  Nav.init(); Art.initPatterns(g); Art.initProps(World.meta.props); Art.initLandmarks(World.meta);
  const saved = localStorage.getItem('csc_start');
  setStart(World.meta.districts.find(d => d.name === saved) || World.meta.districts.find(d => d.name === 'Habous') || World.meta.districts[0]);
  $('bsound').style.opacity = Snd.on ? 1 : 0.4;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (ios && !standalone) $('a2hs').style.display = 'block';
  $('loading').style.display = 'none';
  toTitle();
  last = performance.now(); requestAnimationFrame(loop);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') { try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn(e); } }
  setTimeout(offlinePack, 1500);
}
// tiny debug surface for automated checks
window.CSC = { get state() { return state; }, get score() { return score; }, P, get npcs() { return npcs; }, get cars() { return cars; }, start: () => startGame(), slap: () => doSlap(), inp, World, Nav, cam, tp: (x, z) => { P.x = x; P.z = z; cam.x = x; cam.z = z; Nav.ready = false; },
  zoom: k => { zoomK = k; resize(); },
  step: (n, dt) => { for (let i = 0; i < n; i++) update(dt || 1 / 60); render(); }, get pickups() { return pickups; }, get shoes() { return shoes; }, get mega() { return mega; }, set mega(v) { mega = v; } };
boot();
})();
