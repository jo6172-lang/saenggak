'use strict';
/* 생각펼치기 — 크기 재기, 자리 잡기, 그리기 */

const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';

const THEMES = {
  bright: { name: '산뜻한', bg: '#fbfaf7', fg: '#24221f', root: '#2b2a28', rootText: '#ffffff',
            palette: ['#e8590c', '#2f9e44', '#1971c2', '#9c36b5', '#c2255c', '#0c8599', '#f08c00', '#5f3dc4'] },
  pastel: { name: '파스텔', bg: '#fffaf5', fg: '#3a3530', root: '#e76f8a', rootText: '#ffffff',
            palette: ['#f4a261', '#6fbf8a', '#6fa8dc', '#b48ad6', '#ee7fa0', '#4fb8b8', '#e0b343', '#8f86dd'] },
  deep:   { name: '진한', bg: '#f4f6fa', fg: '#1d2433', root: '#1d3557', rootText: '#ffffff',
            palette: ['#1d3557', '#457b9d', '#2a9d8f', '#e76f51', '#6d597a', '#264653', '#b5651d', '#3d405b'] },
  mono:   { name: '단정한', bg: '#ffffff', fg: '#222222', root: '#222222', rootText: '#ffffff',
            palette: ['#2f6fed', '#444444', '#2f6fed', '#666666', '#2f6fed', '#555555', '#2f6fed', '#777777'] },
  night:  { name: '밤하늘', bg: '#16181d', fg: '#e8e6e3', root: '#f0c75e', rootText: '#16181d',
            palette: ['#ff8a5b', '#5fd38d', '#5fa8ff', '#c78bff', '#ff6f91', '#3ad1d1', '#ffc145', '#9b8cff'] },
};

const LAYOUTS = {
  mind: '마인드맵 (양쪽으로)',
  right: '논리도 (오른쪽으로)',
  org: '조직도 (위에서 아래로)',
  tree: '나무 목록 (아래로)',
  timeline: '타임라인 (옆으로)',
  bubble: '버블 (둥글게)',
};

const SHAPES = { auto: '자동', round: '둥근 상자', box: '네모', pill: '알약', circle: '동그라미', line: '밑줄', plain: '글자만' };

/* ---------- 나무 도우미 ---------- */
function walk(n, f, p = null, d = 0) { f(n, p, d); for (const c of n.children) walk(c, f, n, d + 1); }
function findNode(root, id) { let r = null; walk(root, (n, p, d) => { if (n.id === id) r = { n, p, d }; }); return r; }
function isAncestor(a, b) { for (const c of a.children) if (c === b || isAncestor(c, b)) return true; return false; }
const shown = n => (n.collapsed ? [] : n.children);

/* ---------- 글자 재기 ---------- */
const _cv = document.createElement('canvas').getContext('2d');
function meas(t, s) { _cv.font = `${s.weight} ${s.size}px ${FONT}`; return _cv.measureText(t).width; }
function wrapText(text, s, maxW) {
  const out = [];
  for (const para of (text === '' ? ' ' : text).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (line && meas(line + ch, s) > maxW) {
        const sp = line.lastIndexOf(' ');
        if (sp > 0) { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; }
        else { out.push(line); line = ch; }
      } else line += ch;
    }
    out.push(line === '' ? ' ' : line);
  }
  return out;
}
function styleFor(d) {
  return d === 0 ? { size: 22, weight: 700, padX: 22, padY: 13, maxW: 300 }
       : d === 1 ? { size: 17, weight: 600, padX: 14, padY: 8, maxW: 240 }
                 : { size: 15, weight: 400, padX: 9, padY: 6, maxW: 260 };
}
function defaultShape(layout, d) {
  if (layout === 'bubble') return 'circle';
  if (d <= 1) return 'round';
  if (layout === 'mind' || layout === 'right') return 'line';
  if (layout === 'tree') return 'plain';
  return 'box';
}

/* 가지 하나의 크기를 잰다 */
function measureNode(n, d, layout, color, theme) {
  const s = styleFor(d);
  const shape = (n.shape && n.shape !== 'auto') ? n.shape : defaultShape(layout, d);
  const maxW = shape === 'circle' ? Math.min(s.maxW, 150) : s.maxW;
  const label = (n.icon ? n.icon + ' ' : '') + n.text;
  const lines = wrapText(label, s, maxW);
  const lh = s.size * 1.35;
  const textW = Math.max(...lines.map(l => meas(l, s)));
  const noteW = n.note ? 20 : 0;
  let iw = 0, ih = 0;
  if (n.image) { iw = Math.min(n.imgW || 160, 180); ih = iw * (n.imgH || 120) / (n.imgW || 160); }
  const cw = Math.max(textW + noteW, iw), ch = lines.length * lh + (iw ? ih + 6 : 0);
  let w = cw + s.padX * 2, h = ch + s.padY * 2;
  w = Math.max(w, d === 0 ? 110 : d === 1 ? 56 : 36);
  if (shape === 'pill') w += h * 0.5;
  if (shape === 'circle') { const dia = Math.max(d === 0 ? 120 : 64, Math.hypot(cw, ch) + 22); w = h = dia; }
  Object.assign(n, { _d: d, _s: s, _shape: shape, _lines: lines, _lh: lh, _textW: textW, _iw: iw, _ih: ih, _w: w, _h: h, _color: color });
}

/* 그려질 가지 모두 재기 (색은 큰 가지에서 아래로 물려줌) */
function prepare(root, layout, theme) {
  walk(root, n => { n._vis = false; });
  const rec = (n, d, color, idx) => {
    n._vis = true;
    let c = n.color || (d === 0 ? theme.root : d === 1 ? theme.palette[idx % theme.palette.length] : color);
    measureNode(n, d, layout, c, theme);
    shown(n).forEach((k, i) => rec(k, d + 1, c, i));
  };
  rec(root, 0, theme.root, 0);
}

/* ---------- 자리 잡기 ---------- */
const anchorY = n => (n._shape === 'line' ? n._y + n._h : n._y + n._h / 2);

function layoutMind(root, oneSide) {
  const vgap = d => (d === 0 ? 20 : d === 1 ? 10 : 5);
  const hgap = d => (d === 0 ? 56 : 38);
  const sh = n => { const k = shown(n); n._sh = k.length ? Math.max(n._h, k.reduce((a, c) => a + sh(c), 0) + vgap(n._d) * (k.length - 1)) : n._h; return n._sh; };
  sh(root);
  const place = (n, x, yc, side) => {
    n._side = side; n._x = side > 0 ? x : x - n._w; n._y = yc - n._h / 2;
    const k = shown(n); if (k.length) stack(k, side > 0 ? n._x + n._w + hgap(n._d) : n._x - hgap(n._d), yc, side, vgap(n._d));
  };
  const stack = (kids, x, yc, side, gap) => {
    const tot = kids.reduce((a, c) => a + c._sh, 0) + gap * (kids.length - 1);
    let y = yc - tot / 2; for (const c of kids) { place(c, x, y + c._sh / 2, side); y += c._sh + gap; }
  };
  root._x = -root._w / 2; root._y = -root._h / 2; root._side = 0;
  const kids = shown(root);
  if (oneSide) { stack(kids, root._x + root._w + hgap(0), 0, 1, vgap(0)); return; }
  let hR = 0, hL = 0;
  for (const c of kids) { if (c.side !== 'L' && c.side !== 'R') c.side = hR <= hL ? 'R' : 'L'; if (c.side === 'R') hR += c._sh + 20; else hL += c._sh + 20; }
  const R = kids.filter(c => c.side === 'R'), L = kids.filter(c => c.side === 'L');
  if (R.length) stack(R, root._x + root._w + hgap(0), 0, 1, vgap(0));
  if (L.length) stack(L, root._x - hgap(0), 0, -1, vgap(0));
}

function layoutOrg(root) {
  const hg = 18, vg = 46;
  const sw = n => { const k = shown(n); n._sw = k.length ? Math.max(n._w, k.reduce((a, c) => a + sw(c), 0) + hg * (k.length - 1)) : n._w; return n._sw; };
  sw(root);
  const place = (n, xc, y) => {
    n._x = xc - n._w / 2; n._y = y; n._side = 1;
    const k = shown(n); if (!k.length) return;
    const rowH = Math.max(...k.map(c => c._h));
    const tot = k.reduce((a, c) => a + c._sw, 0) + hg * (k.length - 1);
    let x = xc - tot / 2;
    for (const c of k) { place(c, x + c._sw / 2, y + n._h + vg + (rowH - c._h) / 2 * 0); x += c._sw + hg; }
  };
  place(root, 0, 0);
}

function layoutTree(root, x0 = 0, y0 = 0, indent = 30, gap = 8) {
  const place = (n, x, y) => {
    n._x = x; n._y = y; n._side = 1;
    let yy = y + n._h + gap, bottom = y + n._h;
    for (const c of shown(n)) { bottom = place(c, x + indent, yy); yy = bottom + gap; }
    n._bottom = bottom; return bottom;
  };
  return place(root, x0, y0);
}

function layoutTimeline(root) {
  root._x = 0; root._y = -root._h / 2; root._side = 1;
  let cursor = root._w + 60;
  shown(root).forEach((c, i) => {
    c._side = 1; c._x = cursor; c._y = -c._h / 2; c._tl = i % 2 === 0 ? 1 : -1; // 1=아래, -1=위
    let maxRight = c._x + c._w;
    const kids = shown(c);
    if (kids.length) {
      // 아래로 먼저 놓고, 위쪽이면 뒤집는다
      let yy = c._y + c._h + 22;
      const all = [];
      for (const k of kids) { const b = layoutTree(k, c._x + 18, yy); yy = b + 8; walk(k, m => { if (m._vis) all.push(m); }); }
      if (c._tl < 0) {
        const top = c._y - 22;               // 위쪽 기준선
        const base = c._y + c._h + 22;
        for (const m of all) { const rel = m._y - base; m._y = top - rel - m._h; m._up = true; }
      }
      for (const m of all) maxRight = Math.max(maxRight, m._x + m._w);
    }
    cursor = maxRight + 46;
  });
}


function layoutBubble(root) {
  const leaves = n => { const k = shown(n); n._lv = k.length ? k.reduce((a, c) => a + leaves(c), 0) : 1; return n._lv; };
  leaves(root);
  const byDepth = [];
  walk(root, (n, p, d) => { if (n._vis) (byDepth[d] = byDepth[d] || []).push(n); });
  const radius = [0];
  for (let d = 1; d < byDepth.length; d++) {
    const ring = byDepth[d], prevMax = Math.max(...byDepth[d - 1].map(n => n._w)) / 2, myMax = Math.max(...ring.map(n => n._w)) / 2;
    const need = ring.reduce((a, n) => a + n._w + 14, 0) / (2 * Math.PI);
    radius[d] = Math.max(radius[d - 1] + prevMax + myMax + (d === 1 ? 40 : 26), need);
  }
  const place = (n, a0, a1, d) => {
    const a = (a0 + a1) / 2, r = radius[d] || 0;
    const cx = d === 0 ? 0 : Math.cos(a) * r, cy = d === 0 ? 0 : Math.sin(a) * r;
    n._x = cx - n._w / 2; n._y = cy - n._h / 2; n._side = Math.cos(a) >= 0 ? 1 : -1; n._ang = a;
    const k = shown(n); let s = a0;
    for (const c of k) { const span = (a1 - a0) * c._lv / n._lv; place(c, s, s + span, d + 1); s += span; }
  };
  place(root, -Math.PI / 2, Math.PI * 1.5, 0);
}

function doLayout(map, theme) {
  const root = map.root;
  prepare(root, map.layout, theme);
  switch (map.layout) {
    case 'right': layoutMind(root, true); break;
    case 'org': layoutOrg(root); break;
    case 'tree': layoutTree(root); break;
    case 'timeline': layoutTimeline(root); break;
    case 'bubble': layoutBubble(root); break;
    default: layoutMind(root, false);
  }
}

/* ---------- 잇는 선 ---------- */
function edgePath(layout, p, c, prevSib) {
  const cxm = n => n._x + n._w / 2, cym = n => n._y + n._h / 2;
  switch (layout) {
    case 'org': {
      const px = cxm(p), py = p._y + p._h, x = cxm(c), y = c._y, my = py + (y - py) / 2;
      return `M${px},${py} V${my} H${x} V${y}`;
    }
    case 'tree': {
      const px = p._x + 14, py = p._y + p._h, y = c._shape === 'line' ? c._y + c._h : cym(c);
      return `M${px},${py} V${y} H${c._x}`;
    }
    case 'timeline': {
      if (p._d === 0) { const from = prevSib || p; return `M${from._x + from._w},0 H${c._x}`; }
      const up = c._up, y = c._shape === 'line' ? (up ? c._y : c._y + c._h) : cym(c);
      if (p._d === 1) { const px = p._x + 18, py = up ? p._y : p._y + p._h; return `M${px},${py} V${y} H${c._x}`; }
      const px = p._x + 14, py = up ? p._y : p._y + p._h; return `M${px},${py} V${y} H${c._x}`;
    }
    case 'bubble': return `M${cxm(p)},${cym(p)} L${cxm(c)},${cym(c)}`;
    case 'right': {
      const px = p._x + p._w, py = p._d === 0 ? cym(p) : anchorY(p), x = c._x, y = anchorY(c), mx = px + Math.min(22, (x - px) / 2);
      return `M${px},${py} H${mx} V${y} H${x}`;
    }
    default: {
      const side = c._side;
      const px = side > 0 ? p._x + p._w : p._x, py = p._d === 0 ? cym(p) : anchorY(p);
      const x = side > 0 ? c._x : c._x + c._w, y = anchorY(c), dx = (x - px) / 2;
      return `M${px},${py} C${px + dx},${py} ${x - dx},${y} ${x},${y}`;
    }
  }
}

/* 접기 단추 자리 (선이 나가는 쪽) */
function foldPoint(layout, n) {
  if (layout === 'bubble') { const a = n._ang || 0, r = n._w / 2 + 2; return { x: n._x + n._w / 2 + Math.cos(a) * r, y: n._y + n._h / 2 + Math.sin(a) * r, dx: Math.cos(a), dy: Math.sin(a) }; }
  if (layout === 'org') return { x: n._x + n._w / 2, y: n._y + n._h + 9, dx: 0, dy: 1 };
  if (layout === 'tree' || (layout === 'timeline' && n._d >= 1)) {
    const up = layout === 'timeline' && (n._up || n._tl < 0) && !(n._d === 1 && n._tl > 0);
    return { x: n._x + (n._d === 1 && layout === 'timeline' ? 18 : 14), y: up ? n._y - 9 : n._y + n._h + 9, dx: 0, dy: up ? -1 : 1 };
  }
  const side = n._side || 1;
  return { x: side > 0 ? n._x + n._w + 9 : n._x - 9, y: anchorY(n), dx: side, dy: 0 };
}

/* ---------- SVG 그리기 ---------- */
const escX = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* opt: {selId, editing, dropId, visible:Set|null, focusId, ui:true/false, sel:'#색'} */
function renderSVG(map, theme, opt = {}) {
  const root = map.root, layout = map.layout;
  const vis = n => !opt.visible || opt.visible.has(n.id);
  let focusSet = null;
  if (opt.focusId) { const f = findNode(root, opt.focusId); if (f) { focusSet = new Set(); walk(f.n, m => focusSet.add(m.id)); let cur = findNode(root, opt.focusId); while (cur && cur.p) { focusSet.add(cur.p.id); cur = findNode(root, cur.p.id); } } }
  const dim = n => (focusSet && !focusSet.has(n.id) ? ' opacity="0.18"' : '');
  let E = '', N = '', U = '';
  const visit = (n) => {
    const k = shown(n);
    k.forEach((c, i) => {
      if (vis(c)) {
        const w = c._d === 1 ? (layout === 'timeline' ? 3.5 : 3) : 2;
        E += `<path d="${edgePath(layout, n, c, i > 0 ? k[i - 1] : null)}" fill="none" stroke="${c._color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${dim(c)}/>`;
      }
      visit(c);
    });
  };
  visit(root);
  walk(root, (n, p) => {
    if (!n._vis || !vis(n)) return;
    const { _x: x, _y: y, _w: w, _h: h, _d: d, _s: s, _shape: shape, _color: color } = n;
    const solid = d === 0 || (layout === 'bubble' && d === 1);
    const txt = solid ? (d === 0 ? theme.rootText : '#ffffff') : theme.fg;
    const fill = solid ? color : color + '1f';
    let g = `<g data-act="node" data-id="${n.id}"${dim(n)}>`;
    if (opt.dropId === n.id) g += `<rect x="${x - 7}" y="${y - 7}" width="${w + 14}" height="${h + 14}" rx="12" fill="${opt.sel}33" stroke="${opt.sel}" stroke-width="2"/>`;
    switch (shape) {
      case 'circle': g += `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}" fill="${theme.bg}"/><circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}" fill="${fill}" stroke="${color}" stroke-width="${solid ? 0 : 2}"/>`; break;
      case 'line': g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${theme.bg}" fill-opacity="0.01"/><line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`; break;
      case 'plain': g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${theme.bg}" fill-opacity="0.01"/>`; break;
      default: {
        const rx = shape === 'pill' ? h / 2 : shape === 'box' ? 3 : Math.min(12, h / 2);
        if (!solid) g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${theme.bg}"/>`;
        g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${solid ? color : (shape === 'box' ? theme.bg : fill)}" stroke="${color}" stroke-width="${solid ? 0 : 2}"/>`;
        if (shape === 'box' && !solid) g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${color}" fill-opacity="0.08"/>`;
      }
    }
    const center = shape === 'circle' || layout === 'org' || layout === 'bubble';
    const cw = Math.max(n._textW + (n.note ? 20 : 0), n._iw);
    let cy = y + (h - (n._lines.length * n._lh + (n._iw ? n._ih + 6 : 0))) / 2;
    if (n._iw) {
      const ix = center ? x + (w - n._iw) / 2 : x + s.padX;
      g += `<image href="${n.image}" x="${ix}" y="${cy}" width="${n._iw}" height="${n._ih}" preserveAspectRatio="xMidYMid meet"/>`;
      cy += n._ih + 6;
    }
    if (opt.editing !== n.id) {
      const tx = center ? x + w / 2 - (n.note ? 10 : 0) : x + s.padX;
      g += `<text font-family='${FONT}' font-size="${s.size}" font-weight="${s.weight}" fill="${txt}"${center ? ' text-anchor="middle"' : ''}>`;
      n._lines.forEach((l, i) => { g += `<tspan x="${tx}" y="${cy + n._lh * i + s.size * 1.02}">${escX(l)}</tspan>`; });
      g += `</text>`;
      if (n.note) {
        const nx = center ? x + w / 2 + n._textW / 2 + 1 : x + s.padX + n._textW + 4;
        g += `<text data-act="note" data-id="${n.id}" x="${nx}" y="${cy + s.size}" font-size="${s.size - 2}">📝<title>${escX(n.note.slice(0, 200))}</title></text>`;
      }
    }
    void cw;
    g += `</g>`;
    N += g;
    if (opt.ui) {
      if (opt.selId === n.id) {
        const r = shape === 'circle' ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2 + 6}"` : `<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="10"`;
        U += `${r} fill="none" stroke="${opt.sel}" stroke-width="2.5" stroke-dasharray="${opt.editing === n.id ? '0' : '6 4'}"/>`;
      }
      if (d > 0 && n.children.length && layout !== 'bubble') {
        const f = foldPoint(layout, n);
        U += `<g data-act="toggle" data-id="${n.id}"><circle cx="${f.x}" cy="${f.y}" r="8.5" fill="${n.collapsed ? color : theme.bg}" stroke="${color}" stroke-width="2"/>`;
        U += n.collapsed ? `<text x="${f.x}" y="${f.y + 4}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff" font-family='${FONT}'>${n.children.length}</text>`
                         : `<path d="M${f.x - 4},${f.y} H${f.x + 4}" stroke="${color}" stroke-width="2"/>`;
        U += `</g>`;
      }
      if (opt.selId === n.id && opt.editing !== n.id) {
        const f = d === 0 && layout !== 'org' && layout !== 'tree' && layout !== 'timeline' ? { x: x + w + 6, y: y + h / 2, dx: 1, dy: 0 } : foldPoint(layout, n);
        const off = (d > 0 && n.children.length && layout !== 'bubble') ? 22 : 10;
        const ax = f.x + f.dx * off, ay = f.y + f.dy * off;
        U += `<g data-act="add" data-id="${n.id}"><title>아래 가지 더하기 (Tab)</title><circle cx="${ax}" cy="${ay}" r="12" fill="${opt.sel}"/><path d="M${ax - 5.5},${ay} H${ax + 5.5} M${ax},${ay - 5.5} V${ay + 5.5}" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></g>`;
      }
    }
  });
  if (layout === 'timeline' && shown(root).length) {
    const last = shown(root).slice(-1)[0];
    E = `<path d="M${last._x + last._w},0 h28" stroke="${theme.fg}" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/><path d="M${last._x + last._w + 28},-6 l10,6 l-10,6" fill="none" stroke="${theme.fg}" stroke-opacity="0.35" stroke-width="3" stroke-linejoin="round"/>` + E;
  }
  return { edges: E, nodes: N, ui: U };
}

/* 보이는 가지들이 차지하는 넓이 */
function mapBounds(map, visible) {
  let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  walk(map.root, n => {
    if (!n._vis || (visible && !visible.has(n.id))) return;
    x1 = Math.min(x1, n._x); y1 = Math.min(y1, n._y); x2 = Math.max(x2, n._x + n._w); y2 = Math.max(y2, n._y + n._h);
  });
  if (x1 > x2) return { x1: -100, y1: -50, x2: 100, y2: 50 };
  return { x1: x1 - 34, y1: y1 - 30, x2: x2 + 50, y2: y2 + 30 };
}

/* 화면 없이 쓰는 그림(미리보기·내보내기) */
function standaloneSVG(map, theme, width, height, opt = {}) {
  doLayout(map, theme);
  const b = mapBounds(map, opt.visible);
  const r = renderSVG(map, theme, { visible: opt.visible });
  const W = b.x2 - b.x1, H = b.y2 - b.y1;
  const w = width || W, h = height || H;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${b.x1} ${b.y1} ${W} ${H}" preserveAspectRatio="xMidYMid meet"><rect x="${b.x1}" y="${b.y1}" width="${W}" height="${H}" fill="${theme.bg}"/>${r.edges}${r.nodes}</svg>`;
}
