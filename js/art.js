'use strict';
/* CASA SLAP CITY — all the art is drawn in code: tileable ground patterns, prop / vehicle sprites,
   oblique top-down buildings (roof lifted north, south walls visible), people. Warm Moroccan palette. */

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const TAU = Math.PI * 2;
const SH = [0.78, 0.62];                 // shadow direction (to the lower right, like the reference picture)

const Art = {
  SPR: 22, cache: new Map(), pat: {}, cam: { S: 20, ox: 0, oy: 0 }, propDef: [], propR: [],

  mk(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(w * this.SPR)); c.height = Math.max(2, Math.ceil(h * this.SPR));
    const g = c.getContext('2d');
    g.scale(this.SPR, this.SPR); g.translate(w / 2, h / 2); g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g);
    return { c, w, h, sh: null };
  },
  /* black silhouette of a sprite (for the shared shadow layer) */
  shadowOf(sp) {
    if (sp.sh) return sp.sh;
    const c = document.createElement('canvas'); c.width = sp.c.width; c.height = sp.c.height;
    const g = c.getContext('2d');
    g.drawImage(sp.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    return sp.sh = c;
  },
  get(key, make) { let s = this.cache.get(key); if (!s) { s = make(); this.cache.set(key, s); } return s; },

  /* draw sprite centred at world (x, z), canvas rotation `rot`, uniform scale k */
  blit(g, sp, x, z, rot, k) {
    const C = this.cam, s = C.S * (k || 1), c = Math.cos(rot || 0) * s, n = Math.sin(rot || 0) * s;
    g.setTransform(c, n, -n, c, C.ox + x * C.S, C.oy + z * C.S);
    g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  },
  blitShadow(sg, sp, x, z, rot, k, lift) {
    const C = this.cam, s = C.S * 0.5 * (k || 1), c = Math.cos(rot || 0) * s, n = Math.sin(rot || 0) * s;
    const d = 0.35 + lift * 1.05;
    sg.setTransform(c, n, -n, c, (C.ox + (x + SH[0] * d) * C.S) * 0.5, (C.oy + (z + SH[1] * d) * C.S) * 0.5);
    sg.drawImage(this.shadowOf(sp), -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  },

  /* ------------------------------------------------------------------ patterns */
  initPatterns(g) {
    const P = 24;                                           // pattern pixels per metre
    const tile = (m, base, fn) => {
      const c = document.createElement('canvas'); c.width = c.height = m * P;
      const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, m * P, m * P); x.scale(P, P);
      fn(x, mulberry(m * 977 + base.length * 31 + base.charCodeAt(2)));
      const p = g.createPattern(c, 'repeat');
      if (p.setTransform) p.setTransform(new DOMMatrix().scale(1 / (P * U)));   // pattern px -> data units
      return p;
    };
    const speck = (x, R, n, cols, r0, r1, m) => {
      for (let i = 0; i < n; i++) { x.fillStyle = cols[(R() * cols.length) | 0]; x.beginPath(); x.arc(R() * m, R() * m, r0 + R() * (r1 - r0), 0, TAU); x.fill(); }
    };
    this.pat.land = tile(6, '#d9bd92', (x, R) => { speck(x, R, 240, ['rgba(255,240,205,.3)', 'rgba(150,110,70,.14)', 'rgba(190,150,100,.2)'], 0.03, 0.1, 6); });
    this.pat.asphalt = tile(6, '#3f4248', (x, R) => { speck(x, R, 420, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.14)', 'rgba(120,125,135,.12)'], 0.02, 0.08, 6); });
    this.pat.walk = tile(4, '#d3b48a', (x, R) => {
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.fillStyle = (i + j) & 1 ? '#cfae84' : '#d6b88f'; x.fillRect(i / 2, j / 2, 0.5, 0.5); if (R() < 0.1) { x.fillStyle = 'rgba(170,100,62,.22)'; x.fillRect(i / 2, j / 2, 0.5, 0.5); } }
      x.strokeStyle = 'rgba(120,85,55,.2)'; x.lineWidth = 0.035; x.beginPath();
      for (let i = 0; i <= 8; i++) { x.moveTo(i / 2, 0); x.lineTo(i / 2, 4); x.moveTo(0, i / 2); x.lineTo(4, i / 2); } x.stroke();
    });
    this.pat.plaza = tile(4, '#d8b78f', (x) => {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = (i + j) & 1 ? '#c58a62' : '#e3cba6'; x.fillRect(i, j, 1, 1); }
      x.strokeStyle = 'rgba(110,70,45,.3)'; x.lineWidth = 0.04; x.beginPath();
      for (let i = 0; i <= 4; i++) { x.moveTo(i, 0); x.lineTo(i, 4); x.moveTo(0, i); x.lineTo(4, i); } x.stroke();
    });
    this.pat.grass = tile(6, '#86a857', (x, R) => { speck(x, R, 380, ['rgba(60,110,50,.35)', 'rgba(170,200,110,.4)', 'rgba(110,150,70,.4)'], 0.04, 0.14, 6); });
    this.pat.forest = tile(6, '#5d8a48', (x, R) => { speck(x, R, 60, ['rgba(40,90,45,.5)', 'rgba(90,140,70,.5)'], 0.25, 0.6, 6); });
    this.pat.pitch = tile(6, '#6fa550', (x) => { x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, 0, 3, 6); });
    this.pat.sand = tile(6, '#ecd9a6', (x, R) => { speck(x, R, 300, ['rgba(255,250,225,.5)', 'rgba(200,170,110,.3)'], 0.02, 0.09, 6); });
    this.pat.dirt = tile(6, '#c6a876', (x, R) => { speck(x, R, 200, ['rgba(140,105,65,.3)', 'rgba(230,205,160,.35)'], 0.04, 0.2, 6); });
    this.pat.indus = tile(6, '#b3aea2', (x, R) => { speck(x, R, 160, ['rgba(90,88,82,.2)', 'rgba(230,228,220,.25)'], 0.04, 0.25, 6); x.strokeStyle = 'rgba(80,78,72,.25)'; x.lineWidth = 0.04; x.strokeRect(0, 0, 6, 6); x.strokeRect(0, 0, 3, 3); });
    this.pat.asph = tile(6, '#5a5d63', (x, R) => { speck(x, R, 260, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.12)'], 0.02, 0.1, 6); });
    this.pat.cemet = tile(6, '#b2b592', (x, R) => { for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(240,240,232,.8)'; x.fillRect(0.4 + (i % 4) * 1.5, 0.5 + ((i / 4) | 0) * 2, 0.5, 1.1); } speck(x, R, 60, ['rgba(80,120,60,.3)'], 0.05, 0.2, 6); });
    this.pat.water = tile(8, '#2c86b6', (x, R) => {
      x.strokeStyle = 'rgba(190,235,250,.34)'; x.lineWidth = 0.09; x.lineCap = 'round';
      for (let i = 0; i < 26; i++) { const a = R() * 8, b = R() * 8, w = 0.6 + R() * 1.4; x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + w / 2, b - 0.25, a + w, b); x.stroke(); }
      speck(x, R, 30, ['rgba(20,90,140,.25)'], 0.4, 1.1, 8);
    });
    this.pat.corr = tile(2, '#9aa6ad', (x) => { x.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 0; i < 2; i += 0.5) x.fillRect(i, 0, 0.2, 2); x.fillStyle = 'rgba(40,50,60,.18)'; for (let i = 0.3; i < 2; i += 0.5) x.fillRect(i, 0, 0.08, 2); });
    this.pat.glass = tile(4, '#7c9bb0', (x) => { x.strokeStyle = 'rgba(230,245,255,.45)'; x.lineWidth = 0.08; x.beginPath(); for (let i = 0; i <= 4; i += 2) { x.moveTo(i, 0); x.lineTo(i, 4); x.moveTo(0, i); x.lineTo(4, i); } x.stroke(); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, 0, 2, 2); });
    this.pat.tiles = tile(2, '#c66f47', (x) => { x.strokeStyle = 'rgba(120,50,25,.4)'; x.lineWidth = 0.06; x.beginPath(); for (let i = 0; i <= 2; i += 0.4) { x.moveTo(0, i); x.lineTo(2, i); } x.stroke(); x.strokeStyle = 'rgba(255,200,160,.22)'; x.beginPath(); for (let i = 0.2; i <= 2; i += 0.4) { x.moveTo(0, i); x.lineTo(2, i); } x.stroke(); });
    this.pat.green = tile(2, '#2f8f63', (x) => { x.strokeStyle = 'rgba(10,60,40,.4)'; x.lineWidth = 0.06; x.beginPath(); for (let i = 0; i <= 2; i += 0.4) { x.moveTo(0, i); x.lineTo(2, i); } x.stroke(); x.strokeStyle = 'rgba(180,240,200,.2)'; x.beginPath(); for (let i = 0.2; i <= 2; i += 0.4) { x.moveTo(0, i); x.lineTo(2, i); } x.stroke(); });
    this.GPAT = [this.pat.water, this.pat.grass, this.pat.sand, this.pat.dirt, this.pat.indus, this.pat.plaza, this.pat.forest, this.pat.asph, this.pat.cemet, this.pat.pitch];
  },

  /* ------------------------------------------------------------------ props */
  initProps(names) {
    const A = this, rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    A.rr = rr;
    const circ = (g, x, y, r, f) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = f; g.fill(); };
    const stripes = (g, x, y, w, h, n, c1, c2, vert) => { for (let i = 0; i < n; i++) { g.fillStyle = i & 1 ? c2 : c1; if (vert) g.fillRect(x + i * w / n, y, w / n + 0.01, h); else g.fillRect(x, y + i * h / n, w, h / n + 0.01); } };
    const blob = (g, R, n, rad, cols, r0, r1) => { for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.sqrt(R()) * rad; circ(g, Math.cos(a) * d, Math.sin(a) * d, r0 + R() * (r1 - r0), cols[(R() * cols.length) | 0]); } };
    const frond = (g, a, L, w, fill, rib) => {
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(0.1, 0); g.quadraticCurveTo(L * 0.45, -w, L, 0); g.quadraticCurveTo(L * 0.45, w, 0.1, 0); g.fillStyle = fill; g.fill();
      g.strokeStyle = 'rgba(15,55,25,.4)'; g.lineWidth = 0.035;
      for (let t = 0.22; t < 0.95; t += 0.13) { const ww = w * Math.sin(t * Math.PI) * 0.62; g.beginPath(); g.moveTo(L * t - 0.05, -ww); g.lineTo(L * t + 0.1, 0); g.lineTo(L * t - 0.05, ww); g.stroke(); }
      g.strokeStyle = rib; g.lineWidth = 0.05; g.beginPath(); g.moveTo(0.15, 0); g.lineTo(L * 0.96, 0); g.stroke();
      g.restore();
    };
    const palm = (rad, n) => (g, R) => {
      for (let i = 0; i < n; i++) frond(g, i / n * TAU + R() * 0.4, rad * (0.82 + R() * 0.2), 0.5 + R() * 0.14, ['#2a6b2e', '#32772f', '#245f2a'][i % 3], 'rgba(15,50,20,.5)');
      for (let i = 0; i < n - 2; i++) frond(g, i / (n - 2) * TAU + 0.3 + R() * 0.4, rad * (0.55 + R() * 0.2), 0.42 + R() * 0.1, ['#4f9d3d', '#62ad49', '#458f38'][i % 3], 'rgba(215,240,150,.6)');
      circ(g, 0, 0, 0.3, '#5f4226'); circ(g, -0.05, -0.05, 0.17, '#8d6539');
    };
    const AW = [['#c8402c', '#f3ead8'], ['#1e8a82', '#f3ead8'], ['#2a6cc4', '#f3ead8'], ['#e0a52c', '#f3ead8'], ['#b8452c', '#e8c27a'], ['#2f7a4f', '#f3ead8']];
    const PAR = [['#2a6cc4', '#4a8fe0'], ['#c8402c', '#e56a4d'], ['#1e8a82', '#3db3a8'], ['#e8dcc0', '#fff6e2']];
    const parasol = (rad) => (g, R, v) => {
      const c = PAR[v % PAR.length];
      for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, rad, i / 8 * TAU, (i + 1) / 8 * TAU); g.closePath(); g.fillStyle = c[i & 1]; g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 0.05; g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 0.03; g.beginPath(); for (let i = 0; i < 8; i++) { g.moveTo(0, 0); g.lineTo(Math.cos(i / 8 * TAU) * rad, Math.sin(i / 8 * TAU) * rad); } g.stroke();
      circ(g, 0, 0, 0.1, '#fff');
    };
    const D = {
      lamp_single: { s: [0.9, 2.4], pole: 3.2, d: g => { g.strokeStyle = '#2f3237'; g.lineWidth = 0.12; g.beginPath(); g.moveTo(0, 0.6); g.lineTo(0, -0.7); g.stroke(); rr(g, -0.2, -1.0, 0.4, 0.5, 0.1); g.fillStyle = '#44484f'; g.fill(); g.fillStyle = '#ffe9a8'; g.fillRect(-0.12, -0.92, 0.24, 0.3); circ(g, 0, 0.6, 0.15, '#22252a'); }, rot: 1 },
      lamp_double: { s: [0.9, 3.4], pole: 3.4, d: g => { g.strokeStyle = '#2f3237'; g.lineWidth = 0.12; g.beginPath(); g.moveTo(0, 1.3); g.lineTo(0, -1.3); g.stroke(); for (const s of [-1, 1]) { rr(g, -0.2, s > 0 ? 1.1 : -1.6, 0.4, 0.5, 0.1); g.fillStyle = '#44484f'; g.fill(); g.fillStyle = '#ffe9a8'; g.fillRect(-0.12, s > 0 ? 1.2 : -1.5, 0.24, 0.3); } circ(g, 0, 0, 0.16, '#22252a'); }, rot: 1 },
      lamp_corniche: { s: [0.9, 0.9], pole: 2.6, d: g => { circ(g, 0, 0, 0.16, '#e8e4da'); circ(g, 0, 0, 0.3, 'rgba(255,240,190,.55)'); circ(g, 0, 0, 0.1, '#fff'); } },
      palm_tall: { s: [7.4, 7.4], lift: 3.0, trunk: 1, nav: 0.3, vn: 4, d: palm(3.3, 11), bias: 0.6 },
      palm_date: { s: [6, 6], lift: 2.2, trunk: 1, nav: 0.3, vn: 4, d: palm(2.6, 9), bias: 0.6 },
      tree_round: { s: [5, 5], lift: 1.5, trunk: 1, nav: 0.35, vn: 3, bias: 0.6, d: (g, R) => { circ(g, 0.15, 0.2, 2.05, '#2f6a35'); blob(g, R, 26, 1.6, ['#3d8040', '#4c9449', '#5ea653', '#35753a'], 0.4, 0.8); blob(g, R, 9, 1.2, ['rgba(190,225,130,.5)'], 0.15, 0.35); } },
      cypress: { s: [2, 2], lift: 2.2, trunk: 1, nav: 0.35, bias: 0.4, d: (g, R) => { circ(g, 0, 0, 0.85, '#1f5a30'); blob(g, R, 10, 0.5, ['#2b6e3a', '#357d42'], 0.2, 0.35); } },
      bench: { s: [1.9, 0.75], rot: 1, nav: 0.5, d: g => { g.fillStyle = '#5b3d24'; g.fillRect(-0.85, -0.3, 1.7, 0.6); g.fillStyle = '#8a5f37'; for (let i = 0; i < 4; i++) g.fillRect(-0.85, -0.28 + i * 0.15, 1.7, 0.1); g.fillStyle = '#2f3237'; g.fillRect(-0.9, -0.34, 0.1, 0.68); g.fillRect(0.8, -0.34, 0.1, 0.68); } },
      trash_bin: { s: [0.8, 0.8], nav: 0.3, d: g => { circ(g, 0, 0, 0.34, '#1f5d3d'); circ(g, 0, 0, 0.24, '#2c7a52'); circ(g, 0, 0, 0.1, '#16402a'); } },
      bus_shelter: { s: [3.8, 1.8], rot: 1, nav: 1.1, lift: 0.5, d: g => { rr(g, -1.8, -0.8, 3.6, 1.6, 0.15); g.fillStyle = 'rgba(120,170,190,.85)'; g.fill(); g.strokeStyle = '#2f4a55'; g.lineWidth = 0.1; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(-1.5, -0.5); g.lineTo(1.5, -0.5); g.stroke(); g.fillStyle = '#c8402c'; g.fillRect(-1.8, 0.55, 3.6, 0.22); } },
      kiosk: { s: [2.9, 2.5], rot: 1, nav: 1.25, lift: 0.7, d: (g, R, v) => { rr(g, -1.35, -1.15, 2.7, 2.3, 0.15); g.fillStyle = ['#1e8a82', '#c8402c', '#2a6cc4', '#e0a52c'][v % 4]; g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-1.35, -1.15, 2.7, 0.9); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.07; rr(g, -1.35, -1.15, 2.7, 2.3, 0.15); g.stroke(); g.fillStyle = '#f3ead8'; g.fillRect(-0.9, 0.5, 1.8, 0.35); } },
      cafe_set: { s: [2.1, 1.0], rot: 1, nav: 0.42, d: g => { for (const s of [-1, 1]) { rr(g, s * 0.62 - 0.22, -0.22, 0.44, 0.44, 0.08); g.fillStyle = '#8a5a30'; g.fill(); g.fillStyle = '#5b3a1e'; g.fillRect(s > 0 ? 0.78 : -0.86, -0.22, 0.08, 0.44); } circ(g, 0, 0, 0.4, '#8f949b'); circ(g, 0, 0, 0.33, '#c9cdd3'); circ(g, 0.1, 0.05, 0.07, '#d98a2b'); circ(g, -0.12, -0.08, 0.06, '#e9f3f5'); } },
      parasol: { s: [3.2, 3.2], lift: 1.25, nav: 0.1, vn: 4, d: parasol(1.5), bias: 1.4, selfsh: 1 },
      billboard: { s: [4.4, 0.6], rot: 1, lift: 2.6, pole: 2.0, d: (g, R, v) => { g.fillStyle = '#2b2d31'; g.fillRect(-2.1, -0.2, 4.2, 0.4); g.fillStyle = ['#e0a52c', '#1e8a82', '#c8402c', '#2a6cc4', '#f3ead8', '#7a3fa0', '#2f7a4f', '#e56a4d'][v % 8]; g.fillRect(-2.0, -0.12, 4.0, 0.24); } },
      cone: { s: [0.6, 0.6], d: g => { circ(g, 0, 0, 0.24, '#e8641f'); circ(g, 0, 0, 0.15, '#fff'); circ(g, 0, 0, 0.08, '#e8641f'); } },
      barrier: { s: [2.3, 0.55], rot: 1, nav: 0.45, d: g => { stripes(g, -1.1, -0.2, 2.2, 0.4, 7, '#d9342b', '#f6f1e6', 1); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.05; g.strokeRect(-1.1, -0.2, 2.2, 0.4); } },
      planter: { s: [1.2, 1.2], nav: 0.5, vn: 3, d: (g, R) => { rr(g, -0.5, -0.5, 1, 1, 0.12); g.fillStyle = '#b5623c'; g.fill(); g.strokeStyle = '#7d3f22'; g.lineWidth = 0.06; g.stroke(); blob(g, R, 9, 0.3, ['#3d8040', '#5ea653', '#2f6a35'], 0.14, 0.26); blob(g, R, 3, 0.25, ['#e04f7a', '#f2c230', '#fff'], 0.05, 0.09); } },
      rock: { s: [2, 1.8], nav: 0.75, vn: 3, d: (g, R) => { blob(g, R, 6, 0.45, ['#7d7f84', '#93959a', '#686a70'], 0.3, 0.55); blob(g, R, 3, 0.3, ['rgba(255,255,255,.18)'], 0.12, 0.2); } },
      tetrapod: { s: [2.2, 2.2], nav: 0.9, d: g => { g.strokeStyle = '#8b8d92'; g.lineWidth = 0.55; g.beginPath(); for (let i = 0; i < 3; i++) { g.moveTo(0, 0); g.lineTo(Math.cos(i * 2.094 + 0.4) * 0.85, Math.sin(i * 2.094 + 0.4) * 0.85); } g.stroke(); circ(g, 0, 0, 0.4, '#a3a5aa'); } },
      beach_umbrella: { s: [2.8, 2.8], lift: 1.0, nav: 0.1, vn: 4, bias: 1.2, selfsh: 1, d: (g, R, v) => { const c = [['#f2c230', '#fff'], ['#e04f4f', '#fff'], ['#2a9fd6', '#fff'], ['#3dbb7a', '#fff']][v % 4]; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1.3, i / 10 * TAU, (i + 1) / 10 * TAU); g.closePath(); g.fillStyle = c[i & 1]; g.fill(); } g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.05; g.beginPath(); g.arc(0, 0, 1.3, 0, TAU); g.stroke(); } },
      lounger: { s: [0.9, 2.1], rot: 1, d: g => { rr(g, -0.36, -0.95, 0.72, 1.9, 0.12); g.fillStyle = '#f4f1ea'; g.fill(); g.fillStyle = '#4a9fd0'; g.fillRect(-0.3, -0.9, 0.6, 0.5); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.04; rr(g, -0.36, -0.95, 0.72, 1.9, 0.12); g.stroke(); } },
      lifeguard_tower: { s: [2.8, 2.8], lift: 1.3, nav: 1.2, d: g => { g.fillStyle = '#8a5f37'; g.fillRect(-1.3, -1.3, 2.6, 2.6); g.fillStyle = '#d9342b'; g.fillRect(-1.0, -1.0, 2.0, 2.0); g.fillStyle = '#fff'; g.fillRect(-1.0, -0.15, 2.0, 0.3); g.fillRect(-0.15, -1.0, 0.3, 2.0); } },
      container: { s: [2.7, 6.3], rot: 1, lift: 0.9, navbox: [1.25, 3.05], vn: 6, d: (g, R, v) => { const c = ['#b8452c', '#1f5f8f', '#2f7a4f', '#c9a227', '#7a7d82', '#d0641e'][v % 6]; g.fillStyle = c; g.fillRect(-1.22, -3.05, 2.44, 6.1); g.fillStyle = 'rgba(0,0,0,.14)'; for (let i = -2.9; i < 3; i += 0.4) g.fillRect(-1.22, i, 2.44, 0.14); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.07; g.strokeRect(-1.22, -3.05, 2.44, 6.1); } },
      crane: { s: [16, 28], rot: 1, lift: 4, d: g => { g.strokeStyle = '#d9a21f'; g.lineWidth = 0.9; g.strokeRect(-6.5, -12, 13, 24); g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, -13.5); g.lineTo(0, 13.5); g.stroke(); g.fillStyle = '#8a6a10'; g.fillRect(-1.6, -2, 3.2, 4); } },
      market_stall: { s: [3.2, 2.9], rot: 1, lift: 0.55, nav: 1.2, vn: 6, d: (g, R, v) => {
        const c = AW[v % AW.length];
        g.fillStyle = '#6b4a2b'; g.fillRect(-1.3, 0.3, 2.6, 1.0);
        for (let i = 0; i < 5; i++) { rr(g, -1.25 + i * 0.5, 0.4, 0.44, 0.8, 0.05); g.fillStyle = '#8a6238'; g.fill(); blob(g, R, 6, 0.01, [['#e8872b', '#f2c230', '#c8402c', '#6fa83a', '#8e3b8a'][(i + v) % 5]], 0.07, 0.1); g.save(); g.translate(-1.03 + i * 0.5, 0.8); blob(g, R, 7, 0.16, [['#e8872b', '#f2c230', '#c8402c', '#6fa83a', '#8e3b8a'][(i + v) % 5]], 0.06, 0.1); g.restore(); }
        stripes(g, -1.5, -1.35, 3.0, 1.75, 8, c[0], c[1], 1);
        g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(-1.5, 0.2, 3.0, 0.2);
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.06; g.strokeRect(-1.5, -1.35, 3.0, 1.75);
      } },
      crate_stack: { s: [1.4, 1.4], nav: 0.6, vn: 3, d: (g, R) => { for (let i = 0; i < 3; i++) { const x = -0.6 + R() * 0.5, y = -0.6 + R() * 0.5; g.fillStyle = ['#a9783f', '#8f6230', '#b98a4d'][i]; g.fillRect(x, y, 0.75, 0.75); g.strokeStyle = 'rgba(60,35,15,.6)'; g.lineWidth = 0.05; g.strokeRect(x, y, 0.75, 0.75); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.75, y + 0.75); g.stroke(); } } },
      phone_booth: { s: [1.0, 1.0], nav: 0.45, d: g => { rr(g, -0.42, -0.42, 0.84, 0.84, 0.1); g.fillStyle = '#1f5f8f'; g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-0.3, -0.3, 0.6, 0.25); } },
      tram_stop: { s: [3.2, 12.4], rot: 1, lift: 0.4, d: g => { g.fillStyle = '#b9b4a8'; g.fillRect(-1.3, -6, 2.6, 12); g.fillStyle = '#f2c230'; g.fillRect(-1.3, -6, 0.14, 12); rr(g, -0.9, -3.5, 1.8, 7, 0.2); g.fillStyle = 'rgba(110,165,185,.88)'; g.fill(); g.strokeStyle = '#2f4a55'; g.lineWidth = 0.1; g.stroke(); } },
      fountain: { s: [5.2, 5.2], nav: 2.3, d: g => { circ(g, 0, 0, 2.5, '#b9a888'); circ(g, 0, 0, 2.2, '#e3d3b0'); circ(g, 0, 0, 1.95, '#3b9bc9'); circ(g, 0.2, 0.2, 1.4, '#4fb0dc'); circ(g, 0, 0, 0.55, '#e3d3b0'); circ(g, 0, 0, 0.3, '#fff'); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 0.06; for (let r = 0.8; r < 1.9; r += 0.45) { g.beginPath(); g.arc(0, 0, r, 0.3, 2.2); g.stroke(); } } },
      hedge: { s: [2.3, 1.1], rot: 1, nav: 0.55, d: (g, R) => { rr(g, -1.05, -0.45, 2.1, 0.9, 0.3); g.fillStyle = '#2f6a35'; g.fill(); g.save(); g.scale(1, 0.4); blob(g, R, 14, 0.9, ['#3d8040', '#4c9449'], 0.2, 0.35); g.restore(); } },
      scooter_parked: { s: [0.9, 2.0], rot: 1, nav: 0.35, vn: 4, d: (g, R, v) => { const c = ['#c8402c', '#2b2d31', '#1f5f8f', '#e8e2d0'][v % 4]; g.fillStyle = '#17181b'; rr(g, -0.12, -0.95, 0.24, 0.4, 0.1); g.fill(); rr(g, -0.12, 0.55, 0.24, 0.4, 0.1); g.fill(); rr(g, -0.24, -0.55, 0.48, 1.2, 0.2); g.fillStyle = c; g.fill(); g.fillStyle = '#2b2d31'; rr(g, -0.17, -0.05, 0.34, 0.6, 0.12); g.fill(); g.strokeStyle = '#2b2d31'; g.lineWidth = 0.08; g.beginPath(); g.moveTo(-0.36, -0.6); g.lineTo(0.36, -0.6); g.stroke(); } },
      bicycle: { s: [0.6, 1.9], rot: 1, d: g => { g.strokeStyle = '#2b2d31'; g.lineWidth = 0.07; g.beginPath(); g.moveTo(0, -0.85); g.lineTo(0, 0.85); g.moveTo(-0.24, -0.5); g.lineTo(0.24, -0.5); g.stroke(); g.fillStyle = '#5b3d24'; g.fillRect(-0.08, 0.1, 0.16, 0.3); } },
      fruit_cart: { s: [1.4, 2.1], rot: 1, nav: 0.7, vn: 4, d: (g, R, v) => { g.fillStyle = '#2b2d31'; g.fillRect(-0.62, -0.5, 0.12, 0.5); g.fillRect(0.5, -0.5, 0.12, 0.5); rr(g, -0.52, -0.9, 1.04, 1.6, 0.08); g.fillStyle = '#8a6238'; g.fill(); g.save(); g.scale(0.5, 0.8); g.translate(0, -0.1); blob(g, R, 30, 0.8, [['#e8872b', '#f2a030'], ['#c8402c', '#e04f4f'], ['#6fa83a', '#f2c230'], ['#f2c230', '#e8872b']][v % 4], 0.1, 0.17); g.restore(); g.strokeStyle = '#5b3d24'; g.lineWidth = 0.07; g.beginPath(); g.moveTo(-0.3, 0.7); g.lineTo(-0.3, 1.0); g.moveTo(0.3, 0.7); g.lineTo(0.3, 1.0); g.stroke(); } },
      bush: { s: [1.6, 1.6], nav: 0.45, vn: 3, d: (g, R) => { circ(g, 0.05, 0.08, 0.68, '#2f6a35'); blob(g, R, 9, 0.4, ['#3d8040', '#4c9449', '#5ea653'], 0.18, 0.3); } },
      minaret: { s: [4.6, 4.6], lift: 8, nav: 2.6, tower: 1, d: g => { g.fillStyle = '#e9d7b0'; g.fillRect(-2.1, -2.1, 4.2, 4.2); g.strokeStyle = '#b9925a'; g.lineWidth = 0.22; g.strokeRect(-2.1, -2.1, 4.2, 4.2); g.fillStyle = '#2f8f63'; g.fillRect(-1.2, -1.2, 2.4, 2.4); circ(g, 0, 0, 0.6, '#e9d7b0'); circ(g, 0, 0, 0.28, '#d9a21f'); } },
      construction_fence: { s: [3.2, 0.4], rot: 1, nav: 0.3, d: g => { stripes(g, -1.55, -0.12, 3.1, 0.24, 8, '#e8641f', '#f6f1e6', 1); } },
      flag_pole: { s: [1.8, 1.3], lift: 3.2, pole: 3.0, d: g => { g.fillStyle = '#c1272d'; g.fillRect(-0.1, -0.5, 1.5, 1.0); g.strokeStyle = '#006233'; g.lineWidth = 0.07; g.beginPath(); for (let i = 0; i < 5; i++) { const a = -1.571 + i * 2.513; g.lineTo(0.65 + Math.cos(a) * 0.3, Math.sin(a) * 0.3); } g.closePath(); g.stroke(); circ(g, -0.2, -0.5, 0.09, '#d9a21f'); } },
      shop_awning: { s: [4.2, 1.6], rot: 1, lift: 0.75, vn: 4, bias: 0.4, sx: 1, d: (g, R, v) => { const c = AW[(v + 1) % AW.length]; stripes(g, -2.0, -0.7, 4.0, 1.25, 10, c[0], c[1], 1); g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(-2.0, -0.7, 4.0, 0.2); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.05; g.strokeRect(-2.0, -0.7, 4.0, 1.25); } },
      ship: { s: [26, 126], rot: 1, lift: 3, d: g => { g.beginPath(); g.moveTo(-11, 58); g.lineTo(11, 58); g.lineTo(11, -44); g.quadraticCurveTo(8, -58, 0, -62); g.quadraticCurveTo(-8, -58, -11, -44); g.closePath(); g.fillStyle = '#2b3a4a'; g.fill(); g.fillStyle = '#8c3a2a'; g.fillRect(-9.5, -40, 19, 80); const cs = ['#b8452c', '#1f5f8f', '#2f7a4f', '#c9a227', '#7a7d82', '#d0641e']; for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { g.fillStyle = cs[(r * 3 + c * 5) % 6]; g.fillRect(-9 + c * 4.6, -38 + r * 13, 4.2, 12.2); } g.fillStyle = '#f1efe9'; g.fillRect(-9, 42, 18, 12); g.fillStyle = '#c8402c'; g.fillRect(-2, 45, 4, 4); } },
      fishing_boat: { s: [3.4, 9.8], rot: 1, lift: 0.3, d: g => { g.beginPath(); g.moveTo(-1.3, 4.3); g.lineTo(1.3, 4.3); g.lineTo(1.4, -2); g.quadraticCurveTo(1.0, -4.2, 0, -4.7); g.quadraticCurveTo(-1.0, -4.2, -1.4, -2); g.closePath(); g.fillStyle = '#1f5fa8'; g.fill(); g.strokeStyle = '#f1efe9'; g.lineWidth = 0.22; g.stroke(); g.fillStyle = '#8a6238'; g.fillRect(-0.95, -2.2, 1.9, 5.6); g.fillStyle = '#f1efe9'; g.fillRect(-0.7, 1.4, 1.4, 1.6); g.fillStyle = '#c8402c'; g.fillRect(-0.75, 1.3, 1.5, 0.3); } },
      litter: { s: [1.1, 1.1], flat: 1, vn: 4, d: (g, R) => { for (let i = 0; i < 4; i++) { g.save(); g.translate(R() * 0.8 - 0.4, R() * 0.8 - 0.4); g.rotate(R() * 3); g.fillStyle = ['#f4f1ea', '#e8e2d0', '#9ed0e8', '#f2c230', '#c8402c'][(R() * 5) | 0]; g.fillRect(-0.07, -0.05, 0.14 + R() * 0.08, 0.1); g.restore(); } circ(g, 0.1, -0.05, 0.1, '#1b1c1f'); } },
      garbage_pile: { s: [1.8, 1.8], nav: 0.55, vn: 3, d: (g, R) => { blob(g, R, 6, 0.4, ['#1b1c1f', '#25272b', '#2f3237', '#1f4f8f'], 0.24, 0.36); blob(g, R, 4, 0.4, ['rgba(255,255,255,.14)'], 0.06, 0.1); g.fillStyle = '#b98a4d'; g.fillRect(0.2, 0.25, 0.5, 0.4); } },
    };
    names.forEach((n, i) => { const d = D[n] || null; this.propDef[i] = d; this.propR[i] = d && d.nav ? d.nav : 0; if (d) d.name = n; });
    this.fountainDef = D.fountain;
  },
  propSprite(kind, v) {
    const d = this.propDef[kind]; if (!d) return null;
    const vv = d.vn ? v % d.vn : 0;
    return this.get('p' + kind + '_' + vv, () => this.mk(d.s[0], d.s[1], g => d.d(g, mulberry(kind * 131 + vv * 17 + 5), vv)));
  },

  /* ------------------------------------------------------------------ vehicles (front = up) */
  CARCOL: ['#f1efe9', '#d6d7da', '#2b2d31', '#8c8f94', '#b3261e', '#1f4f8f', '#2f7a4f', '#c9a227', '#6b3f2a', '#e8e2d0', '#7fb3d5', '#a8452e'],
  CARDIM: [[1.7, 3.9], [1.78, 4.5], [1.7, 3.9], [1.95, 4.9], [1.9, 4.5], [1.82, 4.9], [1.8, 4.5], [2.55, 11.6], [0.8, 1.9]],
  car(kind, col) {
    return this.get('c' + kind + '_' + col, () => {
      const [w, L] = this.CARDIM[kind], rr = this.rr;
      return this.mk(w + 0.5, L + 0.4, g => {
        let body = this.CARCOL[col % 12];
        if (kind === 2) body = '#c9241b';                       // Casablanca petit taxi: red
        if (kind === 5) body = '#f3efe2';                       // grand taxi: cream white
        if (kind === 6) body = '#f4f4f1';
        if (kind === 7) body = '#c9241b';
        const hw = w / 2, hl = L / 2;
        if (kind === 8) {                                       // scooter with rider
          g.fillStyle = '#17181b'; rr(g, -0.12, -hl, 0.24, 0.42, 0.1); g.fill(); rr(g, -0.12, hl - 0.42, 0.24, 0.42, 0.1); g.fill();
          rr(g, -0.24, -0.55, 0.48, 1.25, 0.2); g.fillStyle = this.CARCOL[col % 12]; g.fill();
          g.beginPath(); g.ellipse(0, 0.15, 0.3, 0.24, 0, 0, TAU); g.fillStyle = '#34506b'; g.fill();
          g.beginPath(); g.arc(0, 0.05, 0.17, 0, TAU); g.fillStyle = '#e8e2d0'; g.fill();
          g.strokeStyle = '#2b2d31'; g.lineWidth = 0.08; g.beginPath(); g.moveTo(-0.36, -0.55); g.lineTo(0.36, -0.55); g.stroke();
          return;
        }
        // wheels
        g.fillStyle = '#141518';
        for (const sx of [-1, 1]) for (const fy of [-0.3, 0.3]) g.fillRect(sx * hw - 0.09, fy * L - 0.38, 0.18, 0.76);
        rr(g, -hw, -hl, w, L, kind === 7 ? 0.35 : 0.42); g.fillStyle = body; g.fill();
        const grd = g.createLinearGradient(-hw, 0, hw, 0);
        grd.addColorStop(0, 'rgba(0,0,0,.22)'); grd.addColorStop(0.18, 'rgba(255,255,255,.12)'); grd.addColorStop(0.5, 'rgba(255,255,255,.05)'); grd.addColorStop(0.82, 'rgba(0,0,0,.05)'); grd.addColorStop(1, 'rgba(0,0,0,.28)');
        g.fillStyle = grd; g.fill();
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 0.06; g.stroke();
        const glass = '#22303c';
        if (kind === 7) {                                       // city bus
          g.fillStyle = '#f1e6cf'; g.fillRect(-hw + 0.12, -hl + 0.5, w - 0.24, L - 1.0);
          g.fillStyle = body; g.fillRect(-hw + 0.3, -hl + 1.0, w - 0.6, L - 2.0);
          g.fillStyle = 'rgba(255,255,255,.25)'; for (let y = -hl + 1.6; y < hl - 1.5; y += 2.2) g.fillRect(-0.5, y, 1.0, 1.2);
          g.fillStyle = glass; rr(g, -hw + 0.18, -hl + 0.12, w - 0.36, 0.7, 0.2); g.fill();
        } else if (kind === 3) {                                // van
          g.fillStyle = glass; rr(g, -hw + 0.18, -hl + 0.75, w - 0.36, 0.8, 0.15); g.fill();
          g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(-hw + 0.15, -hl + 1.8, w - 0.3, L - 2.1);
          g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 0.04; g.strokeRect(-hw + 0.15, -hl + 1.8, w - 0.3, L - 2.1);
        } else {
          const cab0 = -hl + L * 0.3, cab1 = hl - L * (kind === 0 || kind === 2 ? 0.14 : 0.2);
          g.fillStyle = glass; rr(g, -hw + 0.16, cab0, w - 0.32, cab1 - cab0, 0.3); g.fill();
          g.fillStyle = body; rr(g, -hw + 0.3, cab0 + 0.62, w - 0.6, cab1 - cab0 - 1.18, 0.18); g.fill();
          g.fillStyle = 'rgba(255,255,255,.2)'; rr(g, -hw + 0.34, cab0 + 0.66, (w - 0.6) * 0.45, cab1 - cab0 - 1.26, 0.14); g.fill();
          g.fillStyle = 'rgba(190,225,245,.35)'; g.fillRect(-hw + 0.3, cab0 + 0.12, w * 0.3, 0.14);
          if (kind === 6) {                                     // police: navy bonnet + boot, light bar
            g.fillStyle = '#1f2d4d'; rr(g, -hw + 0.1, -hl + 0.12, w - 0.2, L * 0.24, 0.3); g.fill(); rr(g, -hw + 0.1, hl - L * 0.16, w - 0.2, L * 0.14, 0.25); g.fill();
            g.fillStyle = '#d9342b'; g.fillRect(-0.55, cab0 + 0.95, 0.52, 0.26); g.fillStyle = '#2a6cf0'; g.fillRect(0.03, cab0 + 0.95, 0.52, 0.26);
          }
          if (kind === 2 || kind === 5) { g.fillStyle = '#f2c230'; rr(g, -0.32, cab0 + 0.95, 0.64, 0.3, 0.06); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 0.04; g.stroke(); }
        }
        g.fillStyle = '#fff3c4'; g.fillRect(-hw + 0.15, -hl + 0.04, 0.36, 0.13); g.fillRect(hw - 0.51, -hl + 0.04, 0.36, 0.13);
        g.fillStyle = '#d9342b'; g.fillRect(-hw + 0.15, hl - 0.16, 0.36, 0.12); g.fillRect(hw - 0.51, hl - 0.16, 0.36, 0.12);
        g.fillStyle = '#f4f4f1'; g.fillRect(-0.24, hl - 0.1, 0.48, 0.08);
      });
    });
  },
  tram() {
    return this.get('tram', () => this.mk(3.0, 10.2, g => {
      this.rr(g, -1.25, -4.9, 2.5, 9.8, 0.7); g.fillStyle = '#e9e4d8'; g.fill();
      g.fillStyle = '#d0481e'; g.fillRect(-1.25, -3.6, 2.5, 7.2);
      g.fillStyle = '#f1ece0'; g.fillRect(-0.85, -3.9, 1.7, 7.8);
      g.fillStyle = '#9aa3aa'; for (let y = -3.2; y < 3.2; y += 1.6) g.fillRect(-0.5, y, 1.0, 1.0);
      g.fillStyle = '#22303c'; this.rr(g, -1.0, -4.75, 2.0, 0.7, 0.3); g.fill(); this.rr(g, -1.0, 4.05, 2.0, 0.7, 0.3); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.07; this.rr(g, -1.25, -4.9, 2.5, 9.8, 0.7); g.stroke();
    }));
  },

  /* ------------------------------------------------------------------ roof furniture */
  ROOF: {
    ac: [1.1, 0.8, (g) => { g.fillStyle = '#b9bcc0'; g.fillRect(-0.5, -0.33, 1.0, 0.66); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.05; g.strokeRect(-0.5, -0.33, 1.0, 0.66); g.fillStyle = '#6f7378'; g.beginPath(); g.arc(-0.12, 0, 0.22, 0, TAU); g.fill(); g.fillStyle = '#d7d9dc'; g.beginPath(); g.arc(-0.12, 0, 0.07, 0, TAU); g.fill(); }],
    dish: [1.0, 1.0, (g) => { g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(0.08, 0.1, 0.42, 0, TAU); g.fill(); g.fillStyle = '#eceae4'; g.beginPath(); g.arc(0, 0, 0.42, 0, TAU); g.fill(); g.fillStyle = '#cfcdc6'; g.beginPath(); g.arc(0.06, 0.06, 0.3, 0, TAU); g.fill(); g.strokeStyle = '#55585e'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(0, 0); g.lineTo(0.3, -0.3); g.stroke(); }],
    tank: [1.4, 1.4, (g) => { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(0.1, 0.12, 0.6, 0, TAU); g.fill(); g.fillStyle = '#23262b'; g.beginPath(); g.arc(0, 0, 0.6, 0, TAU); g.fill(); g.fillStyle = '#3a3e45'; g.beginPath(); g.arc(-0.08, -0.08, 0.4, 0, TAU); g.fill(); g.fillStyle = '#16181b'; g.beginPath(); g.arc(0, 0, 0.14, 0, TAU); g.fill(); }],
    rug: [2.4, 1.6, (g, R, v) => { const c = [['#b3261e', '#f2c230', '#1f4f8f'], ['#1f4f8f', '#f3ead8', '#c8402c'], ['#7a2a5e', '#f2c230', '#1e8a82'], ['#c8402c', '#f3ead8', '#2b2d31']][v % 4]; g.fillStyle = c[0]; g.fillRect(-1.1, -0.7, 2.2, 1.4); g.strokeStyle = c[1]; g.lineWidth = 0.1; g.strokeRect(-0.92, -0.52, 1.84, 1.04); g.fillStyle = c[2]; g.beginPath(); g.moveTo(0, -0.34); g.lineTo(0.5, 0); g.lineTo(0, 0.34); g.lineTo(-0.5, 0); g.closePath(); g.fill(); g.fillStyle = c[1]; g.beginPath(); g.arc(0, 0, 0.1, 0, TAU); g.fill(); g.fillStyle = '#f3ead8'; for (let i = -1.0; i < 1.05; i += 0.2) { g.fillRect(i, -0.78, 0.05, 0.08); g.fillRect(i, 0.7, 0.05, 0.08); } }],
    plant: [0.9, 0.9, (g, R) => { g.fillStyle = '#b5623c'; g.beginPath(); g.arc(0, 0, 0.3, 0, TAU); g.fill(); for (let i = 0; i < 7; i++) { g.fillStyle = ['#3d8040', '#5ea653', '#2f6a35'][i % 3]; g.beginPath(); g.arc(R() * 0.4 - 0.2, R() * 0.4 - 0.2, 0.16 + R() * 0.1, 0, TAU); g.fill(); } }],
    hut: [2.6, 2.4, (g) => { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-1.0, -0.85, 2.3, 2.1); g.fillStyle = '#cdb994'; g.fillRect(-1.2, -0.4, 2.2, 1.4); g.fillStyle = '#efe2c4'; g.fillRect(-1.2, -1.1, 2.2, 1.9); g.strokeStyle = 'rgba(90,60,35,.5)'; g.lineWidth = 0.07; g.strokeRect(-1.2, -1.1, 2.2, 1.9); g.fillStyle = '#2f6fb5'; g.fillRect(-0.3, 0.82, 0.6, 0.2); }],
    sky: [1.6, 1.2, (g) => { g.fillStyle = '#5e7f96'; g.fillRect(-0.7, -0.5, 1.4, 1.0); g.strokeStyle = '#e9e4d8'; g.lineWidth = 0.08; g.strokeRect(-0.7, -0.5, 1.4, 1.0); g.beginPath(); g.moveTo(0, -0.5); g.lineTo(0, 0.5); g.stroke(); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-0.6, -0.4, 0.3, 0.8); }],
    dome: [3.2, 3.2, (g) => { g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(0.15, 0.2, 1.4, 0, TAU); g.fill(); const gr = g.createRadialGradient(-0.4, -0.4, 0.1, 0, 0, 1.45); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d9cdb2'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1.4, 0, TAU); g.fill(); g.fillStyle = '#d9a21f'; g.beginPath(); g.arc(0, 0, 0.14, 0, TAU); g.fill(); }],
    solar: [2.0, 1.3, (g) => { g.fillStyle = '#1c2f4d'; g.fillRect(-0.9, -0.55, 1.8, 1.1); g.strokeStyle = 'rgba(160,200,240,.6)'; g.lineWidth = 0.04; g.beginPath(); for (let i = -0.9; i <= 0.91; i += 0.45) { g.moveTo(i, -0.55); g.lineTo(i, 0.55); } g.moveTo(-0.9, 0); g.lineTo(0.9, 0); g.stroke(); }],
    line: [2.8, 0.8, (g, R) => { g.strokeStyle = '#55585e'; g.lineWidth = 0.04; g.beginPath(); g.moveTo(-1.3, 0); g.lineTo(1.3, 0); g.stroke(); for (let i = 0; i < 5; i++) { g.fillStyle = ['#f4f1ea', '#c8402c', '#2a6cc4', '#f2c230', '#1e8a82'][(R() * 5) | 0]; g.fillRect(-1.2 + i * 0.5, -0.02, 0.36, 0.3 + R() * 0.15); } }],
    court: [4.0, 4.0, (g, R) => { g.fillStyle = 'rgba(60,35,20,.55)'; g.fillRect(-1.7, -1.7, 3.4, 3.4); g.fillStyle = '#b99468'; g.fillRect(-1.7, -1.2, 3.4, 2.9); g.strokeStyle = 'rgba(90,60,35,.5)'; g.lineWidth = 0.06; g.beginPath(); for (let i = -1.7; i < 1.71; i += 0.68) { g.moveTo(i, -1.2); g.lineTo(i, 1.7); } g.stroke(); for (let i = 0; i < 4; i++) { const x = [-1.1, 1.1, -1.1, 1.1][i], y = [-0.5, -0.5, 1.1, 1.1][i]; g.fillStyle = '#b5623c'; g.beginPath(); g.arc(x, y, 0.26, 0, TAU); g.fill(); g.fillStyle = ['#3d8040', '#5ea653'][i & 1]; g.beginPath(); g.arc(x, y, 0.2, 0, TAU); g.fill(); } g.fillStyle = '#3b9bc9'; g.beginPath(); g.arc(0, 0.3, 0.5, 0, TAU); g.fill(); g.strokeStyle = '#e3d3b0'; g.lineWidth = 0.12; g.stroke(); }],
  },
  roofSprite(kind, v) {
    const d = this.ROOF[kind];
    return this.get('r' + kind + (kind === 'rug' ? v % 4 : kind === 'plant' || kind === 'line' ? v % 3 : 0), () => this.mk(d[0], d[1], g => d[2](g, mulberry(v * 53 + kind.length * 7), v)));
  },

  /* ------------------------------------------------------------------ buildings */
  PAL: {
    cream: { roof: '#ecdbb6', rim: '#f8ecd0', wl: '#f3e3c2', wd: '#d8c29a' },
    terra: { roof: '#e8d3aa', rim: '#c6704a', wl: '#d98d62', wd: '#b56a45' },
    red: { roof: '#c8744d', rim: '#dd9a72', wl: '#cf8358', wd: '#a85f3f' },
    white: { roof: '#eee7d8', rim: '#fbf6ea', wl: '#f6f0e2', wd: '#d9d0bd' },
    sand: { roof: '#dcc391', rim: '#b9794f', wl: '#e6cfa1', wd: '#c2a676' },
    pink: { roof: '#e4c3a0', rim: '#d79b78', wl: '#e2b08c', wd: '#c08f6c' },
    grey: { roof: '#c9c6bd', rim: '#e4e1d8', wl: '#dedad0', wd: '#b4b0a5' },
    metal: { roof: null, pat: 'corr', rim: '#6f7c85', wl: '#b9c1c6', wd: '#8e989e' },
    glass: { roof: null, pat: 'glass', rim: '#4d6a7e', wl: '#8fb0c6', wd: '#5f7f96' },
    tiles: { roof: null, pat: 'tiles', rim: '#9d4f30', wl: '#f3e3c2', wd: '#d8c29a', hip: 1, h1: '#d98560', h2: '#b9603c', h3: '#a5522f' },
    green: { roof: null, pat: 'green', rim: '#1d6a47', wl: '#f1e3c4', wd: '#d3bf98', hip: 1, h1: '#3fa678', h2: '#2f8f63', h3: '#227350' },
    slab: { roof: '#aeaaa0', rim: '#8e8a80', wl: '#b9b5aa', wd: '#96928a' },
  },
  DOORS: ['#2f6fb5', '#1e8a82', '#7a4a2a', '#2c7a44', '#2a5a9a', '#b8452c'],

  makeBuilding(r, i) {
    const I = r.s.b_info, o8 = i * 8, n = I[o8], hM = I[o8 + 1], style = I[o8 + 2], prof = I[o8 + 3], flags = I[o8 + 4], seed = I[o8 + 5];
    const P = r.s.b_pts, o = r.bOff[i], sign = r.bSign[i], R = mulberry(seed * 7919 + i * 31 + r.ri * 977 + r.rj * 131 + 3);
    const fm = r.s.b_fm[i];
    const pick = a => a[(R() * a.length) | 0];
    let pal;
    if (style === 6) pal = 'glass';
    else if (style === 5) pal = pick(['glass', 'grey', 'white', 'grey']);
    else if (style === 7 || style === 8) pal = pick(['metal', 'metal', 'grey']);
    else if (style === 11) pal = 'green';
    else if (style === 12) pal = 'slab';
    else if (flags & 4) pal = 'tiles';
    else if (prof === 9 || prof === 10 || prof === 3) pal = pick(['terra', 'terra', 'cream', 'red', 'sand', 'white', 'pink', 'cream']);
    else if (prof === 8 || prof === 6 || prof === 4) pal = pick(['white', 'cream', 'white', 'terra', 'pink']);
    else if (prof >= 11 && prof <= 13) pal = pick(['grey', 'metal', 'cream', 'grey']);
    else pal = pick(['cream', 'white', 'cream', 'terra', 'sand', 'grey', 'pink', 'white']);
    const tall = style === 6 || hM > 45;
    const hm = tall ? clamp(hM * 0.2, 8, 19) : clamp(hM * 0.3, 2.4, 5.6);
    const c = { pal: this.PAL[pal], hu: hm / U, hm, sh: (tall ? clamp(hM * 0.45, 12, 34) : clamp(hM * 0.5, 2.6, 10)) / U, win: [], door: [], items: [], doorCol: pick(this.DOORS) };
    // bbox, centroid
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, cx = 0, cz = 0;
    for (let k = 0; k < n; k++) { const x = P[o + k * 2], z = P[o + k * 2 + 1]; cx += x; cz += z; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    c.cx = cx / n; c.cz = cz / n;
    // south-facing walls: windows + doors as quads (data units)
    const hu = c.hu, shop = flags & 1;
    let doorDone = false;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n, ax = P[o + k * 2], az = P[o + k * 2 + 1], bx = P[o + k2 * 2], bz = P[o + k2 * 2 + 1];
      const dx = bx - ax, dz = bz - az;
      if (dx * sign >= 0) continue;
      const L = Math.hypot(dx, dz), Lm = L * U;
      if (Lm < 2.4 || Math.abs(dx) / L < 0.35) continue;
      const ex = dx / L, ez = dz / L, cnt = Math.max(1, Math.floor(Lm / 2.7)), road = k < 31 && (fm >> k) & 1;
      const quad = (arr, t, w, v0, v1) => {
        const px = ax + dx * t, pz = az + dz * t, hw = w / U / 2;
        arr.push(px - ex * hw, pz - ez * hw - v0, px + ex * hw, pz + ez * hw - v0, px + ex * hw, pz + ez * hw - v1, px - ex * hw, pz - ez * hw - v1);
      };
      const dk = (R() * cnt) | 0;
      for (let w = 0; w < cnt; w++) {
        const t = (w + 0.5) / cnt;
        if (road && shop && !tall) quad(c.door, t, Math.min(2.0, Lm / cnt - 0.5), 0, Math.min(hu * 0.5, 2.2 / U));
        else if (w === dk && !doorDone && (road || R() < 0.5)) { quad(c.door, t, 1.0, 0, Math.min(hu * 0.55, 2.1 / U)); doorDone = true; }
        else quad(c.win, t, 0.85, hu * 0.16, Math.min(hu * 0.5, hu * 0.16 + 1.1 / U));
        if (hm > 4.2) quad(c.win, t, 0.85, hu * 0.6, hu * 0.86);
        if (tall) for (let f = 1; f < 5; f++) quad(c.win, t, 1.5, hu * (0.16 + f * 0.17), hu * (0.26 + f * 0.17));
      }
    }
    // roof furniture
    const area = (x1 - x0) * (z1 - z0) * U * U * 0.6;
    const pip = (x, z) => { let ins = false; for (let a = 0, b = n - 1; a < n; b = a++) { const xa = P[o + a * 2], za = P[o + a * 2 + 1], xb = P[o + b * 2], zb = P[o + b * 2 + 1]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) ins = !ins; } return ins; };
    const inside = (x, z, m) => pip(x, z) && pip(x + m, z) && pip(x - m, z) && pip(x, z + m) && pip(x, z - m);
    if (!c.pal.hip && pal !== 'metal') {
      const trad = prof === 9 || prof === 10 || prof === 3;
      let cnt = Math.min(7, Math.floor(area / (pal === 'glass' ? 160 : 34) * (0.5 + R())));
      const kinds = pal === 'glass' || pal === 'grey' ? ['ac', 'ac', 'ac', 'hut', 'solar', 'tank', 'dish']
        : trad ? ['rug', 'plant', 'dish', 'tank', 'line', 'plant', 'ac', 'rug', 'hut', 'dish'] : ['ac', 'dish', 'tank', 'hut', 'plant', 'solar', 'line', 'sky', 'dish'];
      if (trad && area > 150 && R() < 0.4) { cnt++; kinds.unshift('court', 'court', 'court', 'court', 'court', 'court'); }
      if (style === 11 || (style === 10 && R() < 0.3)) { kinds.unshift('dome', 'dome', 'dome', 'dome'); cnt = Math.max(cnt, 1); }
      for (let q = 0; q < cnt; q++) {
        const kind = q === 0 && (kinds[0] === 'court' || kinds[0] === 'dome') ? kinds[0] : pick(kinds), d = this.ROOF[kind], m = Math.max(d[0], d[1]) * 0.5 / U + 8;
        for (let t = 0; t < 8; t++) {
          const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
          if (!inside(x, z, m)) continue;
          let ok = true;
          for (const it of c.items) if (Math.hypot(it.x - x, it.z - z) < (m + it.m) * 0.8) { ok = false; break; }
          if (!ok) continue;
          c.items.push({ k: kind, x, z, m, a: kind === 'court' || kind === 'dome' ? 0 : (R() < 0.5 ? 0 : 1.5708) + (R() - 0.5) * 0.3, v: (R() * 97) | 0 });
          break;
        }
      }
    }
    return c;
  },

  /* shadow of an extruded footprint (flat pts in the current transform's units) into the shadow layer */
  shadowPoly(sg, P, o, n, sign, len) {
    const sx = SH[0] * len, sz = SH[1] * len;
    sg.beginPath();
    for (let q = 0; q < n; q++) {
      const k = sign > 0 ? q : n - 1 - q, k2 = sign > 0 ? (q + 1) % n : (n - 2 - q + n) % n;
      const ax = P[o + k * 2], az = P[o + k * 2 + 1], bx = P[o + k2 * 2], bz = P[o + k2 * 2 + 1];
      if (q === 0) sg.moveTo(ax + sx, az + sz); else sg.lineTo(ax + sx, az + sz);
      void bx; void bz;
    }
    sg.closePath();
    for (let q = 0; q < n; q++) {
      const k = sign > 0 ? q : n - 1 - q, k2 = sign > 0 ? (q + 1) % n : (n - 2 - q + n) % n;
      const ax = P[o + k * 2], az = P[o + k * 2 + 1], bx = P[o + k2 * 2], bz = P[o + k2 * 2 + 1];
      if ((bx - ax) * sz - (bz - az) * sx > 0) { sg.moveTo(ax, az); sg.lineTo(bx, bz); sg.lineTo(bx + sx, bz + sz); sg.lineTo(ax + sx, az + sz); }
      else { sg.moveTo(ax, az); sg.lineTo(ax + sx, az + sz); sg.lineTo(bx + sx, bz + sz); sg.lineTo(bx, bz); }
      sg.closePath();
    }
    sg.fill();
  },

  /* walls + roof of an extruded footprint. Units = whatever the current transform uses; k = units per metre */
  extrude(g, P, o, n, sign, hu, pal, k, c) {
    // walls (south-facing edges only)
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath(); let any = false;
      for (let q = 0; q < n; q++) {
        const q2 = (q + 1) % n, ax = P[o + q * 2], az = P[o + q * 2 + 1], bx = P[o + q2 * 2], bz = P[o + q2 * 2 + 1];
        const dx = bx - ax;
        if (dx * sign >= 0) continue;
        const f = Math.abs(dx) / (Math.hypot(dx, bz - az) || 1);
        if ((f > 0.55) !== (pass === 0)) continue;
        g.moveTo(ax, az); g.lineTo(bx, bz); g.lineTo(bx, bz - hu); g.lineTo(ax, az - hu); g.closePath(); any = true;
      }
      if (any) { g.fillStyle = pass === 0 ? pal.wl : pal.wd; g.fill(); }
    }
    if (c) {
      if (c.win.length) { g.beginPath(); const w = c.win; for (let q = 0; q < w.length; q += 8) { g.moveTo(w[q], w[q + 1]); g.lineTo(w[q + 2], w[q + 3]); g.lineTo(w[q + 4], w[q + 5]); g.lineTo(w[q + 6], w[q + 7]); g.closePath(); } g.fillStyle = '#3c4d5e'; g.fill(); }
      if (c.door.length) { g.beginPath(); const w = c.door; for (let q = 0; q < w.length; q += 8) { g.moveTo(w[q], w[q + 1]); g.lineTo(w[q + 2], w[q + 3]); g.lineTo(w[q + 4], w[q + 5]); g.lineTo(w[q + 6], w[q + 7]); g.closePath(); } g.fillStyle = c.doorCol; g.fill(); g.strokeStyle = 'rgba(255,245,220,.75)'; g.lineWidth = 0.09 * k; g.stroke(); }
    }
    // ground contact line
    g.beginPath();
    for (let q = 0; q < n; q++) {
      const q2 = (q + 1) % n, ax = P[o + q * 2], bx = P[o + q2 * 2];
      if ((bx - ax) * sign >= 0) continue;
      g.moveTo(ax, P[o + q * 2 + 1]); g.lineTo(bx, P[o + q2 * 2 + 1]);
    }
    g.strokeStyle = 'rgba(50,28,15,.45)'; g.lineWidth = 0.14 * k; g.stroke();
    // roof
    g.beginPath(); g.moveTo(P[o], P[o + 1] - hu);
    for (let q = 1; q < n; q++) g.lineTo(P[o + q * 2], P[o + q * 2 + 1] - hu);
    g.closePath();
    if (pal.hip && c) {
      g.fillStyle = pal.h2; g.fill();
      for (let q = 0; q < n; q++) {
        const q2 = (q + 1) % n, ax = P[o + q * 2], az = P[o + q * 2 + 1], bx = P[o + q2 * 2], bz = P[o + q2 * 2 + 1];
        const nx = (bz - az) * sign, nz = -(bx - ax) * sign, L = Math.hypot(nx, nz) || 1, lit = (-nx * 0.6 - nz * 0.8) / L;
        g.beginPath(); g.moveTo(ax, az - hu); g.lineTo(bx, bz - hu); g.lineTo(c.cx, c.cz - hu - 0.6 * k); g.closePath();
        g.fillStyle = lit > 0.25 ? pal.h1 : lit < -0.25 ? pal.h3 : pal.h2; g.fill();
      }
      g.beginPath(); g.moveTo(P[o], P[o + 1] - hu);
      for (let q = 1; q < n; q++) g.lineTo(P[o + q * 2], P[o + q * 2 + 1] - hu);
      g.closePath();
      g.strokeStyle = pal.rim; g.lineWidth = 0.3 * k; g.stroke();
    } else {
      g.fillStyle = pal.roof || this.pat[pal.pat]; g.fill();
      g.lineJoin = 'miter'; g.strokeStyle = pal.rim; g.lineWidth = 0.62 * k; g.stroke(); g.lineJoin = 'round';
    }
    g.strokeStyle = 'rgba(60,32,16,.42)'; g.lineWidth = 0.1 * k; g.stroke();
  },

  building(g, sg, r, i) {
    const C = this.cam, c = r.bCache[i] || (r.bCache[i] = this.makeBuilding(r, i));
    const P = r.s.b_pts, o = r.bOff[i], n = r.s.b_info[i * 8], sign = r.bSign[i], su = C.S * U;
    if (sg) { sg.setTransform(su * 0.5, 0, 0, su * 0.5, (C.ox + r.cx * C.S) * 0.5, (C.oy + r.cz * C.S) * 0.5); this.shadowPoly(sg, P, o, n, sign, c.sh); return; }
    g.setTransform(su, 0, 0, su, C.ox + r.cx * C.S, C.oy + r.cz * C.S);
    this.extrude(g, P, o, n, sign, c.hu, c.pal, 1 / U, c);
    for (const it of c.items) this.blit(g, this.roofSprite(it.k, it.v), r.cx + it.x * U, r.cz + (it.z - c.hu) * U, it.a, 1);
  },

  /* ------------------------------------------------------------------ landmarks (hand-made, as extruded parts) */
  initLandmarks(meta) {
    const L = this.landmarks = [];
    const box = (w, d, x, z) => [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]];
    const oct = (r, x, z) => { const p = []; for (let i = 0; i < 8; i++) p.push([x + Math.cos(i / 8 * TAU + 0.39) * r, z + Math.sin(i / 8 * TAU + 0.39) * r]); return p; };
    const defs = {
      hassan2: { yaw: -0.14, parts: [[box(96, 190, 0, 10), 9, 'green', 46], [box(40, 60, -70, 70), 5, 'cream', 14], [box(40, 60, 70, 70), 5, 'cream', 14], [box(26, 26, 0, -100), 40, 'cream', 150], [box(14, 14, 0, -100), 46, 'green', 150]] },
      twin_center: { parts: [[box(120, 56, 0, 6), 4, 'grey', 12], [box(30, 30, -27, 0), 22, 'glass', 115], [box(30, 30, 27, 0), 22, 'glass', 115]] },
      cathedral: { parts: [[box(26, 68, 0, 0), 7, 'white', 26], [box(46, 16, 0, -8), 7, 'white', 24], [box(9, 9, -9, 32), 13, 'white', 40], [box(9, 9, 9, 32), 13, 'white', 40]] },
      lighthouse: { yaw: 0, parts: [[box(14, 9, 9, 6), 3, 'white', 6], [oct(4.6, 0, 0), 16, 'white', 50], [oct(2.6, 0, 0), 18.5, 'red', 50]] },
      casa_port: { parts: [[box(92, 48, 0, 0), 5, 'glass', 14], [box(100, 10, 0, 30), 3.4, 'white', 8]] },
      casa_voyageurs: { parts: [[box(104, 26, 0, 0), 4.5, 'terra', 12], [box(9, 9, -44, 12), 15, 'cream', 32]] },
      clock_tower: { parts: [[box(7, 7, 0, 0), 12, 'cream', 22], [box(3.6, 3.6, 0, 0), 14, 'green', 22]] },
      wilaya: { parts: [[box(72, 16, 0, -14), 5, 'white', 16], [box(16, 40, -28, 10), 5, 'white', 16], [box(16, 40, 28, 10), 5, 'white', 16], [box(9, 9, 0, -14), 16, 'cream', 45], [box(5, 5, 0, -14), 18, 'green', 45]] },
      habous: { parts: [[box(44, 8, 0, 0), 4.2, 'green', 9], [box(8, 8, -18, 0), 6.4, 'cream', 12], [box(8, 8, 18, 0), 6.4, 'cream', 12]] },
    };
    for (const key in defs) {
      const m = meta.landmarks[key]; if (!m) continue;
      const d = defs[key], yaw = d.yaw !== undefined ? d.yaw : m.yaw, c = Math.cos(yaw), s = Math.sin(yaw);
      for (const [poly, hm, pal, hreal] of d.parts) {
        const P = []; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, cx = 0, cz = 0, area = 0;
        for (const [lx, lz] of poly) { const x = m.x + lx * c - lz * s, z = m.z + lx * s + lz * c; P.push(x, z); cx += x; cz += z; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
        const n = poly.length;
        for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; area += P[k * 2] * P[k2 * 2 + 1] - P[k2 * 2] * P[k * 2 + 1]; }
        L.push({ key, P, n, sign: area >= 0 ? 1 : -1, hm, pal: this.PAL[pal], sh: clamp(hreal * 0.42, 3, 60), x0, z0, x1, z1, c: { win: [], door: [], cx: cx / n, cz: cz / n } });
      }
    }
    const f = meta.landmarks.mohammed5_square;
    this.bigFountain = f ? { x: f.x, z: f.z } : null;
    this.labels = Object.keys(meta.landmarks).map(k => meta.landmarks[k]);
  },
  landmark(g, sg, lm) {
    const C = this.cam;
    if (sg) { sg.setTransform(C.S * 0.5, 0, 0, C.S * 0.5, C.ox * 0.5, C.oy * 0.5); this.shadowPoly(sg, lm.P, 0, lm.n, lm.sign, lm.sh); return; }
    g.setTransform(C.S, 0, 0, C.S, C.ox, C.oy);
    const pm = this.pat[lm.pal.pat];
    if (pm && pm.setTransform) pm.setTransform(new DOMMatrix().scale(1 / 24));
    this.extrude(g, lm.P, 0, lm.n, lm.sign, lm.hm, lm.pal, 1, lm.c);
    if (pm && pm.setTransform) pm.setTransform(new DOMMatrix().scale(1 / (24 * U)));
  },

  /* ------------------------------------------------------------------ people (drawn live, facing +x) */
  SKIN: ['#f0c8a0', '#e0ac80', '#c98e62', '#a8714a', '#8a5a3a'],
  HAIR: ['#1b1512', '#2b1d14', '#4a3222', '#6b6b6b', '#101010'],
  CLOTH: ['#f4f1ea', '#2b2d31', '#b3261e', '#1f4f8f', '#2f7a4f', '#e0a52c', '#8c8f94', '#c9668a', '#5a3f7a', '#1e8a82', '#d0641e', '#7fb3d5'],
  DJEL: ['#e9dcc0', '#8a6a48', '#f4f1ea', '#8c8f94', '#2a3a5e', '#5a7a5a', '#8e3a44', '#c9b08a'],
  makeLook(type, R) {
    const p = a => a[(R() * a.length) | 0];
    const look = { skin: p(this.SKIN), hair: p(this.HAIR), body: p(this.CLOTH), head: 0, hat: null, k: 1, wide: 1 };
    const roll = R();
    if (type === 'kid') { look.k = 0.74; look.body = p(['#e0a52c', '#b3261e', '#1e8a82', '#7fb3d5', '#f4f1ea']); if (R() < 0.4) { look.head = 1; look.hat = p(['#b3261e', '#1f4f8f', '#f4f1ea']); } }
    else if (type === 'big') { look.k = 1.28; look.wide = 1.25; look.body = p(this.DJEL); look.head = R() < 0.5 ? 2 : 0; look.hat = look.body; }
    else if (type === 'auntie') { look.k = 0.98; look.body = p(['#7a2a5e', '#1e8a82', '#b3261e', '#2a3a5e', '#c9668a', '#5a7a5a']); look.head = 3; look.hat = p(['#f4f1ea', '#e0a52c', '#c9668a', '#2b2d31', '#7fb3d5', '#b3261e']); }
    else if (type === 'police') { look.k = 1.08; look.body = '#1f2d4d'; look.head = 1; look.hat = '#f4f4f1'; }
    else if (type === 'player') { look.body = '#18a79b'; look.head = 4; look.hat = '#c1272d'; look.skin = '#d9a273'; look.hair = '#1b1512'; look.k = 1.06; }
    else if (roll < 0.22) { look.body = p(this.DJEL); look.head = 2; look.hat = look.body; }
    else if (roll < 0.36) { look.head = 3; look.hat = p(['#f4f1ea', '#2b2d31', '#c9668a', '#7fb3d5', '#e0a52c', '#5a7a5a']); look.body = p(['#7a2a5e', '#2a3a5e', '#8c8f94', '#b3261e', '#1e8a82', '#e9dcc0']); }
    else if (roll < 0.5) { look.head = 1; look.hat = p(['#b3261e', '#1f4f8f', '#2b2d31', '#f4f1ea', '#2f7a4f']); }
    return look;
  },
  /* e: {look, walk (phase), slap (0..1 or -1), wind (0..1), lying (bool), sit} — g transformed so 1 unit = 1 m, origin at feet, +x forward */
  person(g, L, walk, slap, wind, lying, sit) {
    const k = L.k * 1.8, w = L.wide;
    g.scale(k, k);
    const sw = Math.sin(walk), out = 'rgba(40,22,12,.55)';
    if (lying) {
      g.fillStyle = L.body; g.beginPath(); g.ellipse(-0.12, 0, 0.5, 0.25 * w, 0, 0, TAU); g.fill(); g.strokeStyle = out; g.lineWidth = 0.035; g.stroke();
      g.fillStyle = L.skin; g.beginPath(); g.arc(0.3, -0.36, 0.09, 0, TAU); g.arc(0.3, 0.36, 0.09, 0, TAU); g.fill();
      g.fillStyle = '#2b2d31'; g.beginPath(); g.ellipse(-0.68, -0.12, 0.13, 0.07, 0, 0, TAU); g.ellipse(-0.68, 0.12, 0.13, 0.07, 0, 0, TAU); g.fill();
      this.head(g, L, 0.5, 0);
      return;
    }
    if (!sit) {                                         // feet
      g.fillStyle = '#2a211c';
      g.beginPath(); g.ellipse(sw * 0.19, -0.12, 0.13, 0.075, 0, 0, TAU); g.ellipse(-sw * 0.19, 0.12, 0.13, 0.075, 0, 0, TAU); g.fill();
    }
    // arms
    const sh = 0.29 * w;
    g.strokeStyle = L.body; g.lineWidth = 0.13; g.lineCap = 'round';
    let hx = -sw * 0.17, hy = -sh - 0.02;                // left hand
    g.beginPath(); g.moveTo(0, -sh); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = L.skin; g.beginPath(); g.arc(hx + 0.04, hy, 0.065, 0, TAU); g.fill();
    let rx = sw * 0.17, ry = sh + 0.02, big = 0;
    if (wind > 0) { const a = 1.9 + wind * 0.5; rx = Math.cos(a) * 0.5; ry = sh + Math.sin(a) * 0.42; big = 0.03; }
    if (slap >= 0) { const a = 1.75 - slap * 3.0, rad = 0.62; rx = Math.cos(a) * rad; ry = sh * 0.5 + Math.sin(a) * rad; big = 0.07; g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.09; g.beginPath(); g.arc(0, sh * 0.5, rad + 0.08, a, a + 1.25); g.stroke(); g.strokeStyle = L.body; g.lineWidth = 0.13; }
    g.beginPath(); g.moveTo(0, sh); g.lineTo(rx, ry); g.stroke();
    g.fillStyle = L.skin; g.beginPath(); g.arc(rx, ry, 0.07 + big, 0, TAU); g.fill();
    if (big) { g.strokeStyle = out; g.lineWidth = 0.03; g.stroke(); }
    // torso
    g.fillStyle = L.body; g.beginPath(); g.ellipse(-0.02, 0, sit ? 0.2 : 0.17, 0.3 * w, 0, 0, TAU); g.fill();
    g.strokeStyle = out; g.lineWidth = 0.035; g.stroke();
    if (L.head === 2) { g.fillStyle = L.body; g.beginPath(); g.moveTo(-0.38, 0); g.lineTo(-0.1, -0.2); g.lineTo(-0.1, 0.2); g.closePath(); g.fill(); }  // djellaba hood point
    this.head(g, L, 0.03, 0);
  },
  head(g, L, x, y) {
    if (L.head === 3) { g.fillStyle = L.hat; g.beginPath(); g.ellipse(x - 0.06, y, 0.2, 0.22, 0, 0, TAU); g.fill(); g.fillStyle = L.skin; g.beginPath(); g.ellipse(x + 0.06, y, 0.1, 0.11, 0, 0, TAU); g.fill(); return; }
    g.fillStyle = L.skin; g.beginPath(); g.arc(x, y, 0.165, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(40,22,12,.5)'; g.lineWidth = 0.03; g.stroke();
    if (L.head === 0) { g.fillStyle = L.hair; g.beginPath(); g.arc(x - 0.03, y, 0.15, 0, TAU); g.fill(); }
    else if (L.head === 1) { g.fillStyle = L.hat; g.beginPath(); g.arc(x - 0.01, y, 0.16, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x + 0.15, y, 0.09, 0.12, 0, 0, TAU); g.fill(); }
    else if (L.head === 2) { g.fillStyle = L.hat; g.beginPath(); g.arc(x - 0.04, y, 0.17, 0, TAU); g.fill(); g.fillStyle = L.skin; g.beginPath(); g.ellipse(x + 0.08, y, 0.08, 0.1, 0, 0, TAU); g.fill(); }
    else if (L.head === 4) { g.fillStyle = L.hair; g.beginPath(); g.arc(x - 0.03, y, 0.15, 0, TAU); g.fill(); g.fillStyle = L.hat; g.beginPath(); g.arc(x, y, 0.12, 0, TAU); g.fill(); g.fillStyle = '#7d1218'; g.beginPath(); g.arc(x, y, 0.05, 0, TAU); g.fill(); g.strokeStyle = '#1b1512'; g.lineWidth = 0.025; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 0.16, y + 0.08); g.stroke(); }
  },
};
