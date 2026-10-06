'use strict';
/* CASA SLAP CITY — world data: streams 2 km regions of the whole of Casablanca (OpenStreetMap-derived),
   spatial queries, the road-end graph used by traffic, and the navigation / collision raster. */
const U = 0.05;                      // metres per data unit
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const World = {
  meta: null, regions: new Map(), pending: new Map(), stamp: 1, ends: new Map(), endsDirty: true, version: 0,
  GORDER: [0, 3, 2, 1, 6, 9, 8, 4, 5, 7],   // ground draw order (by type id)

  async init() {
    this.meta = await (await fetch('data/meta.json')).json();
    const M = this.meta;
    M.propId = {}; M.props.forEach((n, i) => M.propId[n] = i);
    M.tram.forEach(t => {
      const n = t.pts.length / 2; t.cum = new Float32Array(n); let L = 0;
      for (let i = 1; i < n; i++) { L += Math.hypot(t.pts[i * 2] - t.pts[i * 2 - 2], t.pts[i * 2 + 1] - t.pts[i * 2 - 1]); t.cum[i] = L; }
      t.len = L;
    });
  },

  regionOf(x, z) {
    const M = this.meta;
    return [clamp(Math.floor((x - M.ex0) / M.region), 0, M.nrx - 1), clamp(Math.floor((z - M.ez0) / M.region), 0, M.nrz - 1)];
  },

  /* make sure every region within `rad` of (x,z) is loaded (or loading); true when all are in memory */
  need(x, z, rad) {
    const M = this.meta, a = this.regionOf(x - rad, z - rad), b = this.regionOf(x + rad, z + rad);
    let all = true;
    for (let j = a[1]; j <= b[1]; j++) for (let i = a[0]; i <= b[0]; i++) {
      const key = i + '_' + j;
      if (!M.regions[key] || this.regions.has(key)) continue;
      all = false;
      if (!this.pending.has(key)) this.pending.set(key, this.load(i, j, key));
    }
    return all;
  },

  async load(ri, rj, key) {
    try {
      const res = await fetch('data/r_' + key + '.bin');
      if (!res.ok) throw new Error('http ' + res.status);
      const g = parseRegion(await res.arrayBuffer(), ri, rj);
      this.regions.set(key, g); this.endsDirty = true; this.version++;
    } catch (e) { console.warn('region', key, e); setTimeout(() => this.pending.delete(key), 3000); return; }
    this.pending.delete(key);
  },

  gc(x, z) {
    if (this.regions.size <= 9) return;
    for (const [key, g] of this.regions) {
      if (Math.max(Math.abs(g.cx - x), Math.abs(g.cz - z)) > 4200) { this.regions.delete(key); this.endsDirty = true; this.version++; }
    }
  },

  /* layers with a bucket index list ('b' buildings, 'r' roads, 'w' walls, 't' rails): cb(region, index) */
  queryIdx(p, x0, z0, x1, z1, cb) {
    const stamp = ++this.stamp, BK = 125;
    for (const g of this.regions.values()) {
      if (x1 < g.x0 - 420 || x0 > g.x1 + 420 || z1 < g.z0 - 420 || z0 > g.z1 + 420) continue;
      const off = g.s[p + '_boff']; if (!off) continue;
      const idx = g.s[p + '_bidx'], st = g[p + 'Stamp'], box = g[p + 'Box'];
      const i0 = clamp(Math.floor((x0 - g.x0) / BK), 0, 15), i1 = clamp(Math.floor((x1 - g.x0) / BK), 0, 15);
      const j0 = clamp(Math.floor((z0 - g.z0) / BK), 0, 15), j1 = clamp(Math.floor((z1 - g.z0) / BK), 0, 15);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const b = j * 16 + i;
        for (let k = off[b], e = off[b + 1]; k < e; k++) {
          const id = idx[k];
          if (st[id] === stamp) continue;
          st[id] = stamp;
          const q = id * 4;
          if (box[q] > x1 || box[q + 2] < x0 || box[q + 1] > z1 || box[q + 3] < z0) continue;
          cb(g, id);
        }
      }
    }
  },

  /* point layers sorted by bucket ('p' props, 'c' parked cars, 's' café seats): cb(region, index) */
  queryPts(p, x0, z0, x1, z1, cb) {
    const BK = 125;
    for (const g of this.regions.values()) {
      if (x1 < g.x0 || x0 > g.x1 || z1 < g.z0 || z0 > g.z1) continue;
      const off = g.s[p + '_boff']; if (!off) continue;
      const i0 = clamp(Math.floor((x0 - g.x0) / BK), 0, 15), i1 = clamp(Math.floor((x1 - g.x0) / BK), 0, 15);
      const j0 = clamp(Math.floor((z0 - g.z0) / BK), 0, 15), j1 = clamp(Math.floor((z1 - g.z0) / BK), 0, 15);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const b = j * 16 + i;
        for (let k = off[b], e = off[b + 1]; k < e; k++) cb(g, k);
      }
    }
  },

  districtAt(x, z) {
    const M = this.meta;
    if (pointInPoly(M.medina, x, z)) return M.medinaD || (M.medinaD = M.districts.find(d => d.profile === 'medina') || M.districts[0]);
    let best = null, bd = 1e18;
    for (const d of M.districts) { const s = Math.hypot(x - d.x, z - d.z) / d.r; if (s < bd) { bd = s; best = d; } }
    return best;
  },

  /* ---- road-end graph (for traffic): key -> flat [region, piece, end, ...] */
  endKey(g, lx, lz) { return (Math.round(g.cx / U) + lx + 400000) * 1048576 + (Math.round(g.cz / U) + lz + 400000); },
  rebuildEnds() {
    this.ends.clear(); this.endsDirty = false;
    for (const g of this.regions.values()) {
      const I = g.s.r_info, P = g.s.r_pts;
      for (let i = 0; i < g.nR; i++) {
        if (I[i * 12 + 1] > 5) continue;
        const o = g.rOff[i], n = I[i * 12];
        for (let e = 0; e < 2; e++) {
          const q = o + (e ? (n - 1) * 2 : 0), key = this.endKey(g, P[q], P[q + 1]);
          let a = this.ends.get(key); if (!a) this.ends.set(key, a = []);
          a.push(g, i, e);
        }
      }
    }
  },

  /* point + unit direction at arc length s on road piece i of region g -> out [x, z, dx, dz] */
  roadAt(g, i, s, out) {
    const P = g.s.r_pts, o = g.rOff[i], n = g.s.r_info[i * 12];
    let acc = 0;
    for (let k = 0; k < n - 1; k++) {
      const ax = P[o + k * 2] * U, az = P[o + k * 2 + 1] * U, bx = P[o + k * 2 + 2] * U, bz = P[o + k * 2 + 3] * U;
      const L = Math.hypot(bx - ax, bz - az);
      if (acc + L >= s || k === n - 2) {
        const t = L > 1e-6 ? clamp((s - acc) / L, 0, 1) : 0;
        out[0] = g.cx + ax + (bx - ax) * t; out[1] = g.cz + az + (bz - az) * t;
        out[2] = L > 1e-6 ? (bx - ax) / L : 1; out[3] = L > 1e-6 ? (bz - az) / L : 0;
        return out;
      }
      acc += L;
    }
    return out;
  },
};

function pointInPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function parseRegion(buf, ri, rj) {
  const M = World.meta, dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x314C5343) throw new Error('bad region file');
  const n = dv.getUint32(4, true), s = {};
  for (let i = 0; i < n; i++) {
    const o = 8 + i * 20; let name = '';
    for (let k = 0; k < 8; k++) { const c = dv.getUint8(o + k); if (c) name += String.fromCharCode(c); }
    const t = dv.getUint32(o + 8, true), off = dv.getUint32(o + 12, true), cnt = dv.getUint32(o + 16, true);
    s[name] = t === 0 ? new Uint8Array(buf, off, cnt) : t === 1 ? new Uint16Array(buf, off, cnt) : t === 2 ? new Int16Array(buf, off, cnt) : new Uint32Array(buf, off, cnt);
  }
  const R = M.region, g = { ri, rj, key: ri + '_' + rj, s, x0: M.ex0 + ri * R, z0: M.ez0 + rj * R };
  g.x1 = g.x0 + R; g.z1 = g.z0 + R; g.cx = g.x0 + R / 2; g.cz = g.z0 + R / 2;

  const lineLayer = (p, info, stride, pts, pad) => {
    const cnt = info ? info.length / stride : 0;
    const off = new Uint32Array(cnt + 1), box = new Float32Array(cnt * 4);
    let o = 0;
    for (let i = 0; i < cnt; i++) {
      const np = info[i * stride]; off[i] = o;
      let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
      for (let k = 0; k < np; k++) {
        const x = pts[o + k * 2], z = pts[o + k * 2 + 1];
        if (x < a) a = x; if (x > c) c = x; if (z < b) b = z; if (z > d) d = z;
      }
      const m = pad ? pad(i) : 0;
      box[i * 4] = g.cx + a * U - m; box[i * 4 + 1] = g.cz + b * U - m; box[i * 4 + 2] = g.cx + c * U + m; box[i * 4 + 3] = g.cz + d * U + m;
      o += np * 2;
    }
    off[cnt] = o;
    g['n' + p.toUpperCase()] = cnt; g[p + 'Off'] = off; g[p + 'Box'] = box; g[p + 'Stamp'] = new Uint32Array(cnt);
  };
  lineLayer('b', s.b_info, 8, s.b_pts, null);
  lineLayer('r', s.r_info, 12, s.r_pts, i => s.r_info[i * 12 + 2] * 0.1 + s.r_info[i * 12 + 3] * 0.2 + 1);
  lineLayer('w', s.w_info, 2, s.w_pts, null);
  lineLayer('t', s.t_info, 2, s.t_pts, null);
  // building winding (+1 = positive shoelace area) and detail cache
  g.bSign = new Int8Array(g.nB); g.bCache = new Array(g.nB);
  for (let i = 0; i < g.nB; i++) {
    const o = g.bOff[i], np = s.b_info[i * 8]; let area = 0;
    for (let k = 0; k < np; k++) {
      const k2 = (k + 1) % np;
      area += s.b_pts[o + k * 2] * s.b_pts[o + k2 * 2 + 1] - s.b_pts[o + k2 * 2] * s.b_pts[o + k * 2 + 1];
    }
    g.bSign[i] = area >= 0 ? 1 : -1;
  }
  // road piece lengths
  g.rLen = new Float32Array(g.nR);
  for (let i = 0; i < g.nR; i++) {
    const o = g.rOff[i], np = s.r_info[i * 12]; let L = 0;
    for (let k = 1; k < np; k++) L += Math.hypot(s.r_pts[o + k * 2] - s.r_pts[o + k * 2 - 2], s.r_pts[o + k * 2 + 1] - s.r_pts[o + k * 2 - 1]);
    g.rLen[i] = L * U;
  }
  g.nP = s.p_dat ? s.p_dat.length / 4 : 0;
  g.nC = s.c_dat ? s.c_dat.length / 4 : 0;
  g.nS = s.s_dat ? s.s_dat.length / 4 : 0;
  // ground polygons
  g.ground = [];
  if (s.g_meta) {
    const m = s.g_meta, P = s.g_pts; let i = 0, po = 0;
    while (i < m.length) {
      const type = m[i++], nr = m[i++], rings = [];
      let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
      for (let r = 0; r < nr; r++) {
        const len = m[i++]; rings.push(po, len);
        for (let k = 0; k < len; k++) {
          const x = P[po + k * 2], z = P[po + k * 2 + 1];
          if (x < a) a = x; if (x > c) c = x; if (z < b) b = z; if (z > d) d = z;
        }
        po += len * 2;
      }
      g.ground.push({ type, rings, x0: g.cx + a * U, z0: g.cz + b * U, x1: g.cx + c * U, z1: g.cz + d * U });
    }
    const ord = World.GORDER;
    g.ground.sort((p, q) => ord.indexOf(p.type) - ord.indexOf(q.type));
  }
  return g;
}

/* ------------------------------------------------------------------------------------------------
   Nav: a 128 m x 128 m occupancy raster (0.5 m cells) around the player, redrawn as they move.
   Buildings, water, walls, parked cars and solid props are rasterised with a tiny 2D canvas; a BFS
   from the player's cell gives every chaser the shortest way around the blocks. */
const Nav = {
  N: 256, res: 0.5, ox: 0, oz: 0, ready: false, cx: 1e9, cz: 1e9, ver: -1,
  init() {
    const N = this.N;
    this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = N;
    this.g = this.cv.getContext('2d', { willReadFrequently: true });
    this.occ = new Uint8Array(N * N); this.inf = new Uint8Array(N * N);
    this.dist = new Uint16Array(N * N); this.q = new Int32Array(N * N);
  },

  /* redraw the occupancy raster centred on (px, pz); `extra(g, k, x0, z0)` may add more blockers */
  rebuild(px, pz, propR, extra) {
    const N = this.N, res = this.res, k = 1 / res, g = this.g;
    this.cx = px; this.cz = pz; this.ver = World.version;
    const x0 = this.ox = Math.round(px) - N * res / 2, z0 = this.oz = Math.round(pz) - N * res / 2;
    const x1 = x0 + N * res, z1 = z0 + N * res;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineJoin = 'round'; g.lineCap = 'round';
    const tr = r => g.setTransform(U * k, 0, 0, U * k, (r.cx - x0) * k, (r.cz - z0) * k);
    for (const r of World.regions.values()) {
      if (x1 < r.x0 || x0 > r.x1 || z1 < r.z0 || z0 > r.z1) continue;
      tr(r);
      const P = r.s.g_pts;
      for (const p of r.ground) {
        if (p.type !== 0 || p.x0 > x1 || p.x1 < x0 || p.z0 > z1 || p.z1 < z0) continue;
        g.beginPath();
        for (let q = 0; q < p.rings.length; q += 2) {
          const o = p.rings[q], n = p.rings[q + 1];
          g.moveTo(P[o], P[o + 1]);
          for (let i = 1; i < n; i++) g.lineTo(P[o + i * 2], P[o + i * 2 + 1]);
          g.closePath();
        }
        g.fill('evenodd');
      }
    }
    World.queryIdx('b', x0, z0, x1, z1, (r, i) => {
      tr(r);
      const P = r.s.b_pts, o = r.bOff[i], n = r.s.b_info[i * 8];
      g.beginPath(); g.moveTo(P[o], P[o + 1]);
      for (let q = 1; q < n; q++) g.lineTo(P[o + q * 2], P[o + q * 2 + 1]);
      g.closePath(); g.fill();
    });
    g.lineWidth = 0.6 / U;
    World.queryIdx('w', x0, z0, x1, z1, (r, i) => {
      tr(r);
      const P = r.s.w_pts, o = r.wOff[i], n = r.s.w_info[i * 2];
      g.beginPath(); g.moveTo(P[o], P[o + 1]);
      for (let q = 1; q < n; q++) g.lineTo(P[o + q * 2], P[o + q * 2 + 1]);
      g.stroke();
    });
    World.queryPts('c', x0, z0, x1, z1, (r, i) => {
      const D = r.s.c_dat, x = r.cx + D[i * 4] * U, z = r.cz + D[i * 4 + 1] * U, a = -D[i * 4 + 2] / 5000;
      const c = Math.cos(a) * k, s = Math.sin(a) * k;
      g.setTransform(c, s, -s, c, (x - x0) * k, (z - z0) * k);
      g.fillRect(-0.85, -2.1, 1.7, 4.2);
    });
    World.queryPts('p', x0, z0, x1, z1, (r, i) => {
      const D = r.s.p_dat, rad = propR[D[i * 4 + 2] & 255];
      if (!rad) return;
      g.setTransform(k, 0, 0, k, (r.cx + D[i * 4] * U - x0) * k, (r.cz + D[i * 4 + 1] * U - z0) * k);
      g.beginPath(); g.arc(0, 0, rad * (rad > 2.5 ? r.s.p_sc[i] / 50 : 1), 0, 6.2832); g.fill();
    });
    if (extra) extra(g, k, x0, z0);
    const d = g.getImageData(0, 0, N, N).data, occ = this.occ, inf = this.inf;
    for (let i = 0, n = N * N; i < n; i++) occ[i] = d[i * 4] > 90 ? 1 : 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = j * N + i;
      inf[c] = occ[c] || (i > 0 && occ[c - 1]) || (i < N - 1 && occ[c + 1]) || (j > 0 && occ[c - N]) || (j < N - 1 && occ[c + N]) ? 1 : 0;
    }
    this.ready = true;
  },

  cell(x, z) {
    const i = Math.floor((x - this.ox) / this.res), j = Math.floor((z - this.oz) / this.res);
    return (i < 0 || j < 0 || i >= this.N || j >= this.N) ? -1 : j * this.N + i;
  },
  solid(x, z) { const c = this.cell(x, z); return c >= 0 && this.occ[c] === 1; },
  /* can a body of radius r stand at (x, z)? (outside the raster everything is free) */
  free(x, z, r) {
    return !(this.solid(x, z) || this.solid(x + r, z) || this.solid(x - r, z) || this.solid(x, z + r) || this.solid(x, z - r));
  },

  /* breadth-first distance field from the player's cell over un-inflated-free cells */
  flow(px, pz) {
    const N = this.N, dist = this.dist, inf = this.inf, q = this.q;
    dist.fill(65535);
    let s = this.cell(px, pz);
    if (s < 0) return;
    if (inf[s]) {                                   // standing against a wall: seed from the nearest open cell
      const ci = s % N, cj = (s / N) | 0; let best = -1, bd = 1e9;
      for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const c = j * N + i, d2 = di * di + dj * dj;
        if (!inf[c] && d2 < bd) { bd = d2; best = c; }
      }
      if (best < 0) return;
      s = best;
    }
    let head = 0, tail = 0;
    dist[s] = 0; q[tail++] = s;
    while (head < tail) {
      const c = q[head++], d = dist[c] + 1, i = c % N, j = (c / N) | 0;
      const L = i > 0, R = i < N - 1, T = j > 0, B = j < N - 1;
      if (L && !inf[c - 1] && dist[c - 1] > d) { dist[c - 1] = d; q[tail++] = c - 1; }
      if (R && !inf[c + 1] && dist[c + 1] > d) { dist[c + 1] = d; q[tail++] = c + 1; }
      if (T && !inf[c - N] && dist[c - N] > d) { dist[c - N] = d; q[tail++] = c - N; }
      if (B && !inf[c + N] && dist[c + N] > d) { dist[c + N] = d; q[tail++] = c + N; }
      if (L && T && !inf[c - 1] && !inf[c - N] && !inf[c - N - 1] && dist[c - N - 1] > d) { dist[c - N - 1] = d; q[tail++] = c - N - 1; }
      if (R && T && !inf[c + 1] && !inf[c - N] && !inf[c - N + 1] && dist[c - N + 1] > d) { dist[c - N + 1] = d; q[tail++] = c - N + 1; }
      if (L && B && !inf[c - 1] && !inf[c + N] && !inf[c + N - 1] && dist[c + N - 1] > d) { dist[c + N - 1] = d; q[tail++] = c + N - 1; }
      if (R && B && !inf[c + 1] && !inf[c + N] && !inf[c + N + 1] && dist[c + N + 1] > d) { dist[c + N + 1] = d; q[tail++] = c + N + 1; }
    }
  },

  /* steering direction toward the player along the distance field; false = no path info here */
  steer(x, z, out) {
    const N = this.N, c = this.cell(x, z);
    if (c < 0) return false;
    const i = c % N, j = (c / N) | 0, dist = this.dist;
    let best = -1, bd = dist[c];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const n = b * N + a;
      if (dist[n] < bd) {
        if (di && dj && (this.inf[j * N + a] || this.inf[b * N + i])) continue;
        bd = dist[n]; best = n;
      }
    }
    if (best < 0) return false;
    const tx = this.ox + ((best % N) + 0.5) * this.res - x, tz = this.oz + (((best / N) | 0) + 0.5) * this.res - z;
    const L = Math.hypot(tx, tz) || 1;
    out[0] = tx / L; out[1] = tz / L;
    return true;
  },

  /* nearest free spot to (x, z) within a few metres -> out [x, z] or null */
  nearestFree(x, z, out) {
    const N = this.N, c = this.cell(x, z);
    if (c < 0) return null;
    const ci = c % N, cj = (c / N) | 0; let best = -1, bd = 1e9;
    for (let dj = -14; dj <= 14; dj++) for (let di = -14; di <= 14; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const n = j * N + i, d2 = di * di + dj * dj;
      if (!this.inf[n] && d2 < bd) { bd = d2; best = n; }
    }
    if (best < 0) return null;
    out[0] = this.ox + ((best % N) + 0.5) * this.res; out[1] = this.oz + (((best / N) | 0) + 0.5) * this.res;
    return out;
  },

  /* a reachable open cell between rmin and rmax from the player and outside the screen rect */
  spawnSpot(px, pz, rmin, rmax, vx0, vz0, vx1, vz1, out) {
    for (let t = 0; t < 40; t++) {
      const a = Math.random() * 6.2832, r = rmin + Math.random() * (rmax - rmin);
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      if (x > vx0 && x < vx1 && z > vz0 && z < vz1) continue;
      const c = this.cell(x, z);
      if (c < 0 || this.inf[c] || this.dist[c] === 65535) continue;
      out[0] = x; out[1] = z;
      return out;
    }
    return null;
  },
};
