'use strict';
/* 생각펼치기 — 화면과 조작 */

const $ = s => document.querySelector(s);
const SEL = '#2f6fed';
const newId = () => 'n' + Math.random().toString(36).slice(2, 10);
const mk = (text, children = []) => ({ id: newId(), text, children });
const ICONS = ['⭐', '❗', '❓', '✅', '❌', '💡', '📌', '🔥', '👍', '🎯', '📅', '💰', '📚', '🏠', '❤️', '⚠️', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '🙂', '😢', '🚀'];
const EXTRA_COLORS = ['#e03131', '#f08c00', '#2f9e44', '#1971c2', '#7048e8', '#868e96'];

/* ================= 저장소 (기기 안 IndexedDB) ================= */
const Store = {
  db: null, mem: new Map(),
  open() {
    return new Promise(res => {
      try {
        const r = indexedDB.open('saenggak', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('maps', { keyPath: 'id' });
        r.onsuccess = () => { this.db = r.result; res(); };
        r.onerror = () => res();
      } catch (e) { res(); }
    });
  },
  st(mode) { return this.db.transaction('maps', mode).objectStore('maps'); },
  all() { if (!this.db) return Promise.resolve([...this.mem.values()]); return new Promise(res => { const r = this.st('readonly').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); }); },
  get(id) { if (!this.db) return Promise.resolve(this.mem.get(id)); return new Promise(res => { const r = this.st('readonly').get(id); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); },
  put(m) { if (!this.db) { this.mem.set(m.id, m); return Promise.resolve(); } return new Promise((res, rej) => { const r = this.st('readwrite').put(m); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); },
  del(id) { if (!this.db) { this.mem.delete(id); return Promise.resolve(); } return new Promise(res => { const r = this.st('readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => res(); }); },
};

/* ================= 상태 ================= */
let cur = null;                 // 지금 연 마인드맵
let selId = null, editing = null;
let view = { tx: 0, ty: 0, k: 1 };
let undoS = [], redoS = [];
let mode = 'map';               // map | outline
let focusId = null, present = null, panelOpen = false;
const theme = () => THEMES[cur.theme] || THEMES.bright;

const svg = $('#svg'), gView = $('#view'), gE = $('#gE'), gN = $('#gN'), gU = $('#gU');
const stage = $('#stage'), ed = $('#edit');

function toast(m) { const t = $('#toast'); t.textContent = m; t.style.opacity = 1; clearTimeout(t._t); t._t = setTimeout(() => (t.style.opacity = 0), 2000); }
function fixTree(root) { const seen = new Set(); walk(root, n => { if (!n.id || seen.has(n.id)) n.id = newId(); seen.add(n.id); n.children = n.children || []; n.text = n.text ?? ''; }); return root; }
const snap = () => JSON.stringify({ root: stripTemp(cur.root), layout: cur.layout, theme: cur.theme });
function pushUndo(s) { undoS.push(s ?? snap()); if (undoS.length > 200) undoS.shift(); redoS = []; }
function restoreSnap(s) { const o = JSON.parse(s); cur.root = fixTree(o.root); cur.layout = o.layout; cur.theme = o.theme; if (selId && !findNode(cur.root, selId)) selId = null; syncSelects(); }

/* ================= 저장 ================= */
const record = () => ({ id: cur.id, title: cur.title, layout: cur.layout, theme: cur.theme, created: cur.created, updated: cur.updated, root: stripTemp(cur.root) });
function showSaved() {
  if (!Store.db) { $('#status').textContent = '저장 안 됨 (백업 파일로 저장하세요)'; return; }
  $('#status').textContent = Sync.user ? (Sync.online ? '☁ 저장·공유됨' : '저장됨 · 인터넷이 되면 공유') : '저장됨';
}
let saveT = null;
function save() {
  if (!cur) return;
  clearTimeout(saveT);
  $('#status').textContent = '저장 중…';
  saveT = setTimeout(async () => {
    saveT = null;
    cur.updated = Date.now();
    try { const rec = record(); await Store.put(rec); Sync.push(rec); showSaved(); }
    catch (e) { $('#status').textContent = '저장 실패'; toast('저장하지 못했어요. 「내보내기 → 백업 파일」로 저장해 두세요.'); }
  }, 300);
}

/* ================= 그리기 ================= */
function render() {
  if (!cur) return;
  const th = theme();
  doLayout(cur, th);
  const r = renderSVG(cur, th, { selId, editing, dropId: drag && drag.target, visible: present ? present.visible : null, focusId, ui: !present, sel: SEL });
  gE.innerHTML = r.edges; gN.innerHTML = r.nodes; gU.innerHTML = r.ui;
  stage.style.background = th.bg;
  applyView(); placeEditor(); updateButtons();
  if (panelOpen) fillPanel();
  $('#title').placeholder = (cur.root.text || '제목').split('\n')[0];
}
function applyView() { gView.setAttribute('transform', `translate(${view.tx},${view.ty}) scale(${view.k})`); }
function fitTo(visible, animate) {
  const b = mapBounds(cur, visible), W = stage.clientWidth, H = stage.clientHeight;
  if (!W || !H) return;
  view.k = Math.min(1.4, Math.min(W / (b.x2 - b.x1), H / (b.y2 - b.y1)) * 0.94);
  view.tx = W / 2 - (b.x1 + b.x2) / 2 * view.k; view.ty = H / 2 - (b.y1 + b.y2) / 2 * view.k;
  if (animate) { gView.classList.add('anim'); setTimeout(() => gView.classList.remove('anim'), 600); }
  applyView(); placeEditor();
}
function zoomAt(f, cx, cy) {
  const k2 = Math.min(3, Math.max(0.12, view.k * f)), r = k2 / view.k;
  view.tx = cx - (cx - view.tx) * r; view.ty = cy - (cy - view.ty) * r; view.k = k2; applyView(); placeEditor();
}
function ensureVisible(n) {
  const W = stage.clientWidth, H = stage.clientHeight, m = 50;
  const sx = n._x * view.k + view.tx, sy = n._y * view.k + view.ty, sw = n._w * view.k, sh = n._h * view.k;
  if (sx < m) view.tx += m - sx; else if (sx + sw > W - m) view.tx -= sx + sw - (W - m);
  if (sy < m) view.ty += m - sy; else if (sy + sh > H - m) view.ty -= sy + sh - (H - m);
  applyView();
}

/* ================= 바로 적기 ================= */
let editOrig = '', editSnap = '', editNew = false;
function startEdit(id, isNew = false) {
  if (editing && editing !== id) commit();
  const f = findNode(cur.root, id); if (!f) return;
  selId = id; editing = id; editOrig = f.n.text; editNew = isNew; editSnap = isNew ? '' : snap();
  render(); ensureVisible(f.n); placeEditor();
  ed.value = f.n.text; ed.style.display = 'block';
  ed.focus({ preventScroll: true });
  ed.setSelectionRange(ed.value.length, ed.value.length);
}
function placeEditor() {
  if (!editing) { ed.style.display = 'none'; return; }
  const f = findNode(cur.root, editing); if (!f || f.n._x === undefined) return;
  const n = f.n, s = n._s, k = view.k, center = n._shape === 'circle' || cur.layout === 'org' || cur.layout === 'bubble';
  const w = Math.max(n._w, 150), x = center ? n._x + n._w / 2 - w / 2 : n._x;
  ed.style.left = (x * k + view.tx - 2) + 'px';
  ed.style.top = (n._y * k + view.ty - 2) + 'px';
  ed.style.width = (w * k + 4) + 'px';
  ed.style.height = (Math.max(n._h, s.size * 1.35 + s.padY * 2) * k + 4) + 'px';
  ed.style.fontSize = (s.size * k) + 'px'; ed.style.fontWeight = s.weight;
  ed.style.padding = `${s.padY * k}px ${s.padX * k}px`;
  ed.style.textAlign = center ? 'center' : 'left';
}
function commit() {
  if (!editing) return;
  const id = editing; editing = null; ed.style.display = 'none'; ed.blur();
  const f = findNode(cur.root, id);
  if (f) {
    const t = ed.value.replace(/\s+$/, '');
    if (editNew && !t.trim()) { removeRaw(id); undoS.pop(); }
    else {
      f.n.text = t.trim() ? t : (editOrig || '새 가지');
      if (!editNew && f.n.text !== editOrig) pushUndo(editSnap);
    }
  }
  render(); save();
}
function cancelEdit() {
  if (!editing) return;
  const id = editing; editing = null; ed.style.display = 'none'; ed.blur();
  if (editNew) { removeRaw(id); undoS.pop(); }
  else { const f = findNode(cur.root, id); if (f) f.n.text = editOrig; }
  render(); save();
}
ed.addEventListener('input', () => { const f = findNode(cur.root, editing); if (!f) return; f.n.text = ed.value; render(); });
ed.addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229 || !editing) return;   // 한글 조합 중에는 건드리지 않음
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); commit(); }
  else if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); const id = editing; commit(); if (findNode(cur.root, id)) (e.shiftKey ? addSibling(id) : addChild(id)); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEdit(); }
});
ed.addEventListener('blur', () => setTimeout(() => { if (editing && document.activeElement !== ed) commit(); }, 0));

/* ================= 가지 다루기 ================= */
function addChild(id) {
  const f = findNode(cur.root, id || selId || cur.root.id); if (!f) return;
  pushUndo(); const c = mk(''); f.n.children.push(c); f.n.collapsed = false;
  startEdit(c.id, true);
}
function addSibling(id) {
  const f = findNode(cur.root, id || selId); if (!f) return;
  if (!f.p) return addChild(f.n.id);
  pushUndo(); const c = mk('');
  if (f.d === 1 && f.n.side) c.side = f.n.side;
  f.p.children.splice(f.p.children.indexOf(f.n) + 1, 0, c);
  startEdit(c.id, true);
}
function removeRaw(id) {
  const f = findNode(cur.root, id); if (!f || !f.p) return;
  const i = f.p.children.indexOf(f.n); f.p.children.splice(i, 1);
  selId = (f.p.children[i] || f.p.children[i - 1] || f.p).id;
}
function delSel() {
  if (editing) commit();
  const f = findNode(cur.root, selId); if (!f) return;
  if (!f.p) { toast('가운데 주제는 지울 수 없어요'); return; }
  pushUndo(); removeRaw(selId); render(); save();
  if (f.n.children.length) toast('지웠어요. 「되돌리기」로 살릴 수 있어요');
}
function toggleFold(id) { const f = findNode(cur.root, id); if (!f || !f.n.children.length) return; pushUndo(); f.n.collapsed = !f.n.collapsed; render(); save(); }
function moveNode(id, targetId) {
  const f = findNode(cur.root, id), t = findNode(cur.root, targetId);
  if (!f || !t || !f.p || f.n === t.n || isAncestor(f.n, t.n) || f.p === t.n) return false;
  pushUndo();
  f.p.children.splice(f.p.children.indexOf(f.n), 1);
  delete f.n.side; t.n.children.push(f.n); t.n.collapsed = false;
  selId = id; render(); save(); return true;
}
function undo() { if (editing) commit(); if (!undoS.length) return; redoS.push(snap()); restoreSnap(undoS.pop()); refresh(); save(); }
function redo() { if (editing) commit(); if (!redoS.length) return; undoS.push(snap()); restoreSnap(redoS.pop()); refresh(); save(); }
function refresh() { if (mode === 'outline') renderOutline(); render(); }
function updateButtons() {
  $('#tUndo').disabled = !undoS.length; $('#tRedo').disabled = !redoS.length;
  $('#tDel').disabled = !selId || selId === cur.root.id;
  $('#bFocus').classList.toggle('on', !!focusId);
  $('#tPanel').classList.toggle('on', panelOpen);
}

/* 화살표로 가장 가까운 가지 고르기 */
function moveSel(key) {
  const f = findNode(cur.root, selId); if (!f) { selId = cur.root.id; render(); return; }
  const a = f.n, ax = a._x + a._w / 2, ay = a._y + a._h / 2;
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  let best = null, bs = 1e12;
  walk(cur.root, n => {
    if (n === a || !n._vis) return;
    const dx = n._x + n._w / 2 - ax, dy = n._y + n._h / 2 - ay;
    const main = dx * dir[0] + dy * dir[1]; if (main <= 2) return;
    const side = Math.abs(dx * dir[1] + dy * dir[0]);
    const sc = main + side * 2.5; if (sc < bs) { bs = sc; best = n; }
  });
  if (best) { selId = best.id; render(); ensureVisible(best); }
}

/* ================= 마우스·손가락 ================= */
let down = null, drag = null, pinch = null;
const pts = new Map();
const toMap = (cx, cy) => { const r = svg.getBoundingClientRect(); return { x: (cx - r.left - view.tx) / view.k, y: (cy - r.top - view.ty) / view.k }; };
function nodeAt(x, y, skip) {
  let hit = null;
  walk(cur.root, n => { if (!n._vis || (skip && (n === skip || isAncestor(skip, n)))) return; if (x >= n._x - 6 && x <= n._x + n._w + 6 && y >= n._y - 6 && y <= n._y + n._h + 6) hit = n; });
  return hit;
}
svg.addEventListener('pointerdown', e => {
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 2) {
    const [p1, p2] = [...pts.values()];
    pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), k: view.k, tx: view.tx, ty: view.ty, mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 };
    down = null; drag = null; $('#ghost').hidden = true; return;
  }
  const t = e.target.closest('[data-act]');
  down = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, act: t && t.dataset.act, id: t && t.dataset.id, moved: false };
  try { svg.setPointerCapture(e.pointerId); } catch (_) {}
});
svg.addEventListener('pointermove', e => {
  if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pts.size === 2) {
    const [p1, p2] = [...pts.values()], r = svg.getBoundingClientRect();
    const k2 = Math.min(3, Math.max(0.12, pinch.k * Math.hypot(p1.x - p2.x, p1.y - p2.y) / pinch.d));
    const mx = pinch.mx - r.left, my = pinch.my - r.top, nmx = (p1.x + p2.x) / 2 - r.left, nmy = (p1.y + p2.y) / 2 - r.top;
    view.k = k2; view.tx = nmx - (mx - pinch.tx) * k2 / pinch.k; view.ty = nmy - (my - pinch.ty) * k2 / pinch.k;
    applyView(); placeEditor(); return;
  }
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.moved && Math.hypot(dx, dy) > 6) {
    down.moved = true;
    if (down.act === 'node' && !present && down.id !== cur.root.id) {
      if (editing) commit();
      const f = findNode(cur.root, down.id);
      if (f) { drag = { id: down.id, node: f.n, target: null }; const g = $('#ghost'); g.textContent = f.n.text || '(빈 가지)'; g.hidden = false; }
    } else svg.classList.add('panning');
  }
  if (!down.moved) return;
  if (drag) {
    const r = stage.getBoundingClientRect(), g = $('#ghost');
    g.style.left = (e.clientX - r.left + 12) + 'px'; g.style.top = (e.clientY - r.top + 12) + 'px';
    const p = toMap(e.clientX, e.clientY), hit = nodeAt(p.x, p.y, drag.node);
    const tid = hit ? hit.id : null;
    if (tid !== drag.target) { drag.target = tid; render(); }
  } else { view.tx = down.tx + dx; view.ty = down.ty + dy; applyView(); placeEditor(); }
});
function endPointer(e) {
  pts.delete(e.pointerId);
  if (pinch) { if (pts.size < 2) pinch = null; down = null; return; }
  svg.classList.remove('panning');
  const d = down; down = null; if (!d) return;
  if (drag) {
    const dr = drag; drag = null; $('#ghost').hidden = true;
    if (dr.target) { if (!moveNode(dr.id, dr.target)) render(); }
    else {
      // 마인드맵에서 큰 가지를 반대쪽으로 끌면 옆을 바꾼다
      const f = findNode(cur.root, dr.id), p = toMap(e.clientX, e.clientY);
      if (f && f.d === 1 && cur.layout === 'mind') { const side = p.x < cur.root._x + cur.root._w / 2 ? 'L' : 'R'; if (side !== f.n.side) { pushUndo(); f.n.side = side; save(); } }
      render();
    }
    return;
  }
  if (d.moved || e.type === 'pointercancel') return;
  if (present) { (d.act === 'node' || !d.act) && presentStep(1); return; }
  if (d.act === 'node') startEdit(d.id);
  else if (d.act === 'toggle') { if (editing) commit(); toggleFold(d.id); }
  else if (d.act === 'add') { if (editing) commit(); addChild(d.id); }
  else if (d.act === 'note') { if (editing) commit(); selId = d.id; openPanel(true); render(); setTimeout(() => $('#pNote').focus(), 50); }
  else { if (editing) commit(); selId = null; render(); }
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });

/* ================= 글쇠 ================= */
document.addEventListener('keydown', e => {
  if ($('#editor').hidden) return;
  const a = document.activeElement;
  const typing = a === ed || (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'));
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (present) {
    if (['arrowright', ' ', 'enter', 'pagedown', 'arrowdown'].includes(k)) { e.preventDefault(); presentStep(1); }
    else if (['arrowleft', 'pageup', 'arrowup', 'backspace'].includes(k)) { e.preventDefault(); presentStep(-1); }
    else if (k === 'escape') stopPresent();
    return;
  }
  if (ctrl && k === 's') { e.preventDefault(); if (editing) commit(); exportJSON(cur); toast('백업 파일을 내려받았어요'); return; }
  if (typing && a !== ed && a.closest && a.closest('#outline')) {
    if (ctrl && k === 'z') { e.preventDefault(); a.blur(); undo(); }
    else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); a.blur(); redo(); }
    return;
  }
  if (typing) return;
  if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (mode !== 'map') return;
  if (k === 'escape') { if (focusId) { focusId = null; render(); } else { selId = null; render(); } return; }
  if (!selId) { if (k.startsWith('arrow') || k === 'tab' || k === 'enter') { e.preventDefault(); selId = cur.root.id; render(); } return; }
  if (k === 'tab') { e.preventDefault(); e.shiftKey ? addSibling(selId) : addChild(selId); }
  else if (k === 'enter') { e.preventDefault(); addSibling(selId); }
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); delSel(); }
  else if (k === 'f2' || k === ' ') { e.preventDefault(); startEdit(selId); }
  else if (k.startsWith('arrow')) { e.preventDefault(); moveSel(e.key); }
  else if (e.key.length === 1 && !ctrl && !e.altKey) { startEdit(selId); ed.value = ''; }   // 고른 가지에서 바로 치면 새로 적기
});

/* ================= 목록 보기 ================= */
let olSnap = null, olOrig = null;
function renderOutline(focusIdAfter) {
  const box = $('#outline'), th = theme();
  doLayout(cur, th);
  let h = `<p class="ohelp">한 줄이 가지 하나예요. <kbd>Enter</kbd> 새 줄 · <kbd>Tab</kbd> 안쪽으로 · <kbd>Shift</kbd>+<kbd>Tab</kbd> 바깥쪽으로 · 빈 줄에서 <kbd>Backspace</kbd> 지우기</p>`;
  const rec = (n, d) => {
    const color = n._color || th.palette[0];
    h += `<div class="orow d${Math.min(d, 2)}" style="padding-left:${d * 26}px" data-id="${n.id}">`;
    h += n.children.length ? `<button class="ofold" data-fold="${n.id}" title="접기·펴기">${n.collapsed ? '▸' : '▾'}</button>` : `<span class="ofold" style="display:inline-flex;align-items:center;justify-content:center"><span class="dot" style="background:${color}"></span></span>`;
    h += `<input value="${escX(n.text.replace(/\n/g, ' '))}" data-id="${n.id}" aria-label="가지 글">`;
    if (n.icon) h += `<span>${n.icon}</span>`;
    if (n.note) h += `<span title="${escX(n.note)}">📝</span>`;
    h += `</div>`;
    if (!n.collapsed) n.children.forEach(c => rec(c, d + 1));
  };
  rec(cur.root, 0);
  box.innerHTML = h;
  if (focusIdAfter) { const i = box.querySelector(`input[data-id="${focusIdAfter}"]`); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}
const olBox = $('#outline');
olBox.addEventListener('focusin', e => { if (e.target.tagName === 'INPUT') { olSnap = snap(); olOrig = e.target.value; } });
olBox.addEventListener('focusout', e => { if (e.target.tagName === 'INPUT' && olSnap && e.target.value !== olOrig) { pushUndo(olSnap); save(); } olSnap = null; });
olBox.addEventListener('input', e => { const f = findNode(cur.root, e.target.dataset.id); if (f) { f.n.text = e.target.value; save(); } });
olBox.addEventListener('click', e => { const b = e.target.closest('[data-fold]'); if (b) { toggleFold(b.dataset.fold); renderOutline(); } });
olBox.addEventListener('keydown', e => {
  if (e.target.tagName !== 'INPUT' || e.isComposing || e.keyCode === 229) return;
  const id = e.target.dataset.id, f = findNode(cur.root, id); if (!f) return;
  const flush = () => { if (olSnap && e.target.value !== olOrig) pushUndo(olSnap); olSnap = null; };
  if (e.key === 'Enter') {
    e.preventDefault(); flush(); pushUndo(); const c = mk('');
    if (!f.p) { f.n.children.unshift(c); f.n.collapsed = false; }
    else if (f.n.children.length && !f.n.collapsed) f.n.children.unshift(c);
    else { if (f.d === 1 && f.n.side) c.side = f.n.side; f.p.children.splice(f.p.children.indexOf(f.n) + 1, 0, c); }
    renderOutline(c.id); save();
  } else if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault(); if (!f.p) return; const i = f.p.children.indexOf(f.n); if (i === 0) return;
    flush(); pushUndo(); const prev = f.p.children[i - 1]; f.p.children.splice(i, 1); delete f.n.side; prev.children.push(f.n); prev.collapsed = false;
    renderOutline(id); save();
  } else if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault(); if (!f.p) return; const gp = findNode(cur.root, f.p.id).p; if (!gp) return;
    flush(); pushUndo(); f.p.children.splice(f.p.children.indexOf(f.n), 1); gp.children.splice(gp.children.indexOf(f.p) + 1, 0, f.n);
    renderOutline(id); save();
  } else if (e.key === 'Backspace' && e.target.value === '' && f.p) {
    e.preventDefault(); const inputs = [...olBox.querySelectorAll('input')], idx = inputs.indexOf(e.target), prevId = inputs[idx - 1] && inputs[idx - 1].dataset.id;
    olSnap = null; pushUndo(); removeRaw(id); renderOutline(prevId); save();
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const inputs = [...olBox.querySelectorAll('input')], idx = inputs.indexOf(e.target), nx = inputs[idx + (e.key === 'ArrowUp' ? -1 : 1)];
    if (nx) { e.preventDefault(); nx.focus(); }
  }
});
function setMode(m) {
  if (editing) commit();
  mode = m; $('#vMap').classList.toggle('on', m === 'map'); $('#vList').classList.toggle('on', m === 'outline');
  $('#stage').hidden = m !== 'map'; $('#outline').hidden = m !== 'outline';
  if (m === 'outline') renderOutline(); else { render(); }
}

/* ================= 집중·발표 ================= */
function toggleFocus() {
  if (editing) commit();
  if (focusId) { focusId = null; render(); toast('집중 모드를 껐어요'); return; }
  focusId = selId || cur.root.id; render();
  toast('고른 가지만 밝게 보여요. 다시 누르거나 Esc로 꺼요');
}
function startPresent() {
  if (editing) commit(); if (mode !== 'map') setMode('map');
  doLayout(cur, theme());
  const order = []; walk(cur.root, n => { if (n._vis) order.push(n.id); });
  present = { order, i: 0, visible: new Set([order[0]]) };
  document.body.classList.add('presenting'); $('#presentBar').hidden = false;
  requestAnimationFrame(() => { render(); fitTo(present.visible, false); updatePresentBar(); });
}
function presentStep(dir) {
  if (!present) return;
  const i = Math.max(0, Math.min(present.order.length - 1, present.i + dir));
  if (i === present.i) { if (dir > 0) toast('마지막 가지예요. 「끝내기」를 누르세요'); return; }
  present.i = i; present.visible = new Set(present.order.slice(0, i + 1));
  render(); fitTo(present.visible, true); updatePresentBar();
}
function updatePresentBar() { $('#pCount').textContent = `${present.i + 1} / ${present.order.length}`; }
function stopPresent() { present = null; document.body.classList.remove('presenting'); $('#presentBar').hidden = true; requestAnimationFrame(() => { render(); fitTo(null, true); }); }

/* ================= 꾸미기 판 ================= */
function openPanel(on) { panelOpen = on; $('#panel').hidden = !on; updateButtons(); if (on) fillPanel();
  setTimeout(() => { const f = selId && findNode(cur.root, selId); if (f && f.n._vis) ensureVisible(f.n); placeEditor(); }, 0); }
function fillPanel() {
  const f = selId && findNode(cur.root, selId);
  $('#pNone').hidden = !!f; $('#pBody').hidden = !f;
  $('#pTarget').textContent = f ? '· ' + (f.n.text || '(빈 가지)').split('\n')[0] : '';
  if (!f) return;
  const n = f.n, th = theme();
  const colors = [...new Set([...th.palette, ...EXTRA_COLORS])];
  $('#pColors').innerHTML = `<button class="auto${n.color ? '' : ' on'}" data-color="" title="자동 색">자동</button>` +
    colors.map(c => `<button data-color="${c}" style="background:${c}" class="${n.color === c ? 'on' : ''}" title="${c}"></button>`).join('');
  $('#pShapes').innerHTML = Object.entries(SHAPES).map(([k, v]) => `<button data-shape="${k}" class="${(n.shape || 'auto') === k ? 'on' : ''}">${v}</button>`).join('');
  $('#pIcons').innerHTML = `<button data-icon="" class="${n.icon ? '' : 'on'}" title="없음" style="font-size:13px">없음</button>` +
    ICONS.map(i => `<button data-icon="${i}" class="${n.icon === i ? 'on' : ''}">${i}</button>`).join('');
  if (document.activeElement !== $('#pNote')) $('#pNote').value = n.note || '';
  $('#pImgDel').disabled = !n.image;
}
function setProp(k, v) {
  if (editing) commit();
  const f = findNode(cur.root, selId); if (!f) return;
  if ((f.n[k] || '') === (v || '')) return;
  pushUndo(); if (v) f.n[k] = v; else delete f.n[k]; render(); save();
}
$('#panel').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if ('color' in b.dataset) setProp('color', b.dataset.color);
  else if ('shape' in b.dataset) setProp('shape', b.dataset.shape === 'auto' ? '' : b.dataset.shape);
  else if ('icon' in b.dataset) setProp('icon', b.dataset.icon);
});
let noteSnap = null;
$('#pNote').addEventListener('focus', () => { noteSnap = snap(); });
$('#pNote').addEventListener('input', () => { const f = findNode(cur.root, selId); if (!f) return; const v = $('#pNote').value; if (v) f.n.note = v; else delete f.n.note; render(); save(); });
$('#pNote').addEventListener('blur', () => { if (noteSnap && noteSnap !== snap()) pushUndo(noteSnap); noteSnap = null; updateButtons(); });
$('#pImg').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const max = 480, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.85);
    const f = findNode(cur.root, selId); if (!f) return;
    pushUndo(); f.n.image = url; f.n.imgW = Math.min(160, c.width); f.n.imgH = Math.round(f.n.imgW * c.height / c.width);
    render(); save(); toast('그림을 넣었어요');
  } catch (_) { toast('그림을 읽지 못했어요'); }
});
$('#pImgDel').onclick = () => { const f = findNode(cur.root, selId); if (!f || !f.n.image) return; pushUndo(); delete f.n.image; delete f.n.imgW; delete f.n.imgH; render(); save(); };
$('#pClose').onclick = () => openPanel(false);

/* ================= 위쪽 단추 ================= */
function syncSelects() { $('#selLayout').value = cur.layout; $('#selTheme').value = cur.theme; }
$('#selLayout').innerHTML = Object.entries(LAYOUTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('#selTheme').innerHTML = Object.entries(THEMES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
$('#selLayout').onchange = e => { if (editing) commit(); pushUndo(); cur.layout = e.target.value; render(); fitTo(null, true); save(); };
$('#selTheme').onchange = e => { if (editing) commit(); pushUndo(); cur.theme = e.target.value; render(); save(); };
$('#title').addEventListener('input', e => { cur.title = e.target.value; save(); });
$('#vMap').onclick = () => setMode('map');
$('#vList').onclick = () => setMode('outline');
$('#bFocus').onclick = toggleFocus;
$('#bPresent').onclick = startPresent;
$('#pNext').onclick = () => presentStep(1); $('#pPrev').onclick = () => presentStep(-1); $('#pEnd').onclick = stopPresent;
$('#bExport').onclick = e => { e.stopPropagation(); $('#exportMenu').hidden = !$('#exportMenu').hidden; };
document.addEventListener('click', e => { if (!e.target.closest('.menu')) $('#exportMenu').hidden = true; });
$('#exportMenu').addEventListener('click', async e => {
  const b = e.target.closest('[data-ex]'); if (!b) return; $('#exportMenu').hidden = true; if (editing) commit();
  try {
    const th = theme();
    if (b.dataset.ex === 'png') { toast('그림을 만들고 있어요…'); await exportPNG(cur, th); toast('그림을 내려받았어요'); }
    else if (b.dataset.ex === 'pdf') { toast('PDF를 만들고 있어요…'); await exportPDF(cur, th); toast('PDF를 내려받았어요'); }
    else if (b.dataset.ex === 'md') { exportMD(cur); toast('글 목록을 내려받았어요'); }
    else { exportJSON(cur); toast('백업 파일을 내려받았어요'); }
  } catch (err) { toast('내보내지 못했어요: ' + err.message); }
});
$('#tChild').onclick = () => { if (mode === 'outline') setMode('map'); const id = editing || selId || cur.root.id; if (editing) commit(); addChild(id); };
$('#tSib').onclick = () => { if (mode === 'outline') setMode('map'); const id = editing || selId; if (editing) commit(); id ? addSibling(id) : addChild(cur.root.id); };
$('#tDel').onclick = delSel;
$('#tUndo').onclick = undo; $('#tRedo').onclick = redo;
$('#tIn').onclick = () => zoomAt(1.2, stage.clientWidth / 2, stage.clientHeight / 2);
$('#tOut').onclick = () => zoomAt(1 / 1.2, stage.clientWidth / 2, stage.clientHeight / 2);
$('#tFit').onclick = () => fitTo(null, true);
$('#tPanel').onclick = () => openPanel(!panelOpen);
$('#bBack').onclick = () => { history.state && history.state.map ? history.back() : goHome(); };
window.addEventListener('resize', () => placeEditor());
window.addEventListener('popstate', () => { if (!$('#editor').hidden) goHome(true); });

/* ================= 첫 화면 ================= */
function templateMap(t) {
  return { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: t.name === '빈 마인드맵' ? '' : t.name,
           layout: t.layout, theme: t.theme, created: Date.now(), updated: Date.now(), root: fixTree(mdToTree(t.md, mk)) };
}
function thumb(map) {
  try { return standaloneSVG(cloneMap(map), THEMES[map.theme] || THEMES.bright, '100%', '100%'); }
  catch (_) { return ''; }
}
function tplCards(small) {
  return TEMPLATES.map(t => { const m = templateMap(t);
    return `<button class="card" data-tpl="${t.id}"><div class="thumb">${thumb(m)}</div><div class="meta"><b>${t.name}</b>${small ? '' : `<span>${t.desc} · ${LAYOUTS[t.layout].split(' ')[0]}</span>`}</div></button>`; }).join('');
}
async function renderHome() {
  const maps = (await Store.all()).sort((a, b) => b.updated - a.updated);
  $('#mapCount').textContent = maps.length ? `(${maps.length})` : '';
  $('#emptyMsg').hidden = maps.length > 0;
  const d = t => new Date(t).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  $('#mapList').innerHTML = maps.map(m => `<div class="card" data-open="${m.id}" role="button" tabindex="0"><div class="thumb">${thumb(m)}</div>
    <div class="meta"><b>${escX(m.title || m.root.text || '제목 없음')}</b><div class="row"><span>${d(m.updated)}</span>
    <span><button class="more" data-copy="${m.id}" title="복사본 만들기">복사</button> <button class="more" data-del="${m.id}" title="지우기">지우기</button></span></div></div></div>`).join('');
}
$('#mapList').addEventListener('click', async e => {
  const del = e.target.closest('[data-del]'), cp = e.target.closest('[data-copy]'), op = e.target.closest('[data-open]');
  if (del) { e.stopPropagation(); const m = await Store.get(del.dataset.del); if (m && confirm(`「${m.title || m.root.text}」을(를) 지울까요?\n지운 뒤에는 되살릴 수 없어요.`)) { await Store.del(m.id); Sync.remove(m.id); renderHome(); toast('지웠어요'); } return; }
  if (cp) { e.stopPropagation(); const m = await Store.get(cp.dataset.copy); if (m) { const c = JSON.parse(JSON.stringify(m)); c.id = 'm' + Date.now().toString(36); c.title = (m.title || m.root.text) + ' (복사본)'; c.created = c.updated = Date.now(); await Store.put(c); Sync.push(c, true); renderHome(); toast('복사본을 만들었어요'); } return; }
  if (op) openMap(await Store.get(op.dataset.open));
});
$('#mapList').addEventListener('keydown', async e => { if (e.key === 'Enter' && e.target.dataset.open) openMap(await Store.get(e.target.dataset.open)); });
async function newFromTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id); if (!t) return;
  const m = templateMap(t); await Store.put(m); Sync.push(m, true); $('#tplDlg').open && $('#tplDlg').close(); openMap(m, true);
}
$('#tplRow').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (b) newFromTemplate(b.dataset.tpl); });
$('#tplGrid').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (b) newFromTemplate(b.dataset.tpl); });
$('#hNew').onclick = () => { if (!$('#tplGrid').innerHTML) $('#tplGrid').innerHTML = tplCards(false); $('#tplDlg').showModal(); };
$('#tplClose').onclick = () => $('#tplDlg').close();
$('#hOpen').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const txt = await file.text(); let m;
  try { const j = JSON.parse(txt); const r = j.root || j; if (typeof r.text !== 'string') throw 0;
        m = { id: 'm' + Date.now().toString(36), title: j.title || '', layout: LAYOUTS[j.layout] ? j.layout : 'mind', theme: THEMES[j.theme] ? j.theme : 'bright', root: fixTree(r) }; }
  catch (_) { m = { id: 'm' + Date.now().toString(36), title: file.name.replace(/\.[^.]+$/, ''), layout: 'mind', theme: 'bright', root: fixTree(mdToTree(txt, mk)) }; }
  m.created = m.updated = Date.now(); await Store.put(m); Sync.push(m, true); openMap(m); toast('파일을 열었어요');
});

function openMap(m, fresh) {
  if (!m) return;
  cur = { ...m, root: fixTree(m.root) }; selId = null; editing = null; undoS = []; redoS = []; focusId = null; present = null; mode = 'map';
  $('#home').hidden = true; $('#editor').hidden = false;
  $('#title').value = cur.title || ''; $('#title').placeholder = cur.root.text || '제목';
  syncSelects(); setMode('map'); openPanel(window.innerWidth > 760 && panelOpen);
  if (!history.state || !history.state.map) history.pushState({ map: cur.id }, '', '#map');
  requestAnimationFrame(() => { render(); fitTo(null, false); if (fresh) { selId = cur.root.id; render(); } });
  $('#status').textContent = '';
}
async function goHome(fromPop, skipSave) {
  if (editing && !skipSave) commit();
  if (cur && !skipSave && saveT) { clearTimeout(saveT); saveT = null; cur.updated = Date.now(); try { const rec = record(); await Store.put(rec); Sync.push(rec, true); } catch (_) {} }
  if (present) stopPresent();
  cur = null; $('#editor').hidden = true; $('#home').hidden = false;
  if (!fromPop && history.state && history.state.map) history.replaceState(null, '', location.pathname);
  renderHome();
}

/* ================= 기기 사이 공유 ================= */
let homeT = null;
const renderHomeSoon = () => { clearTimeout(homeT); homeT = setTimeout(() => { if (!$('#home').hidden) renderHome(); }, 250); };
const busyTyping = () => { const a = document.activeElement; return editing || drag || (a && (a.closest('#outline') || a.id === 'pNote' || a.id === 'title')); };
Sync.onRemote = (m, fromOther) => {
  if (cur && cur.id === m.id) {
    if (!fromOther || busyTyping() || present || m.updated <= (cur.updated || 0)) return;
    if (saveT) return;   // 이 기기에서 막 고친 것이 아직 저장 전이면 이 기기 것을 남긴다
    cur.title = m.title; cur.layout = m.layout; cur.theme = m.theme; cur.updated = m.updated; cur.root = fixTree(m.root);
    if (selId && !findNode(cur.root, selId)) selId = null;
    syncSelects(); $('#title').value = cur.title || ''; refresh();
    toast('다른 기기에서 고친 내용을 불러왔어요');
  } else renderHomeSoon();
};
Sync.onRemoteDelete = id => {
  if (cur && cur.id === id) { toast('다른 기기에서 이 마인드맵을 지웠어요'); goHome(false, true); }
  else renderHomeSoon();
};
Sync.onState = msg => {
  const b = $('#hSync');
  b.hidden = !Sync.ready;
  if (Sync.ready) b.textContent = Sync.user ? '☁ 공유 중' : '☁ 기기 사이 공유 켜기';
  b.title = Sync.user ? Sync.user.email + ' 로 로그인됨 · 누르면 로그아웃' : '구글 계정으로 로그인하면 컴퓨터와 휴대폰에 자동으로 같이 저장돼요';
  b.classList.toggle('on', !!Sync.user);
  $('#footNote').textContent = !Sync.ready
    ? '마인드맵은 이 기기 안에 저장돼요. 다른 기기로 옮기려면 「내보내기 → 백업 파일」로 저장한 뒤 다른 기기에서 「파일 열기」를 누르세요.'
    : Sync.user
      ? '☁ ' + Sync.user.email + ' 계정으로 컴퓨터와 휴대폰에 자동으로 함께 저장돼요. 같은 마인드맵을 두 곳에서 동시에 고치면 나중에 저장한 쪽이 남아요.' + (Sync.online ? '' : ' 지금은 인터넷이 끊겨 있어요. 연결되면 맞춰져요.')
      : '지금은 이 기기 안에만 저장돼요. 위의 「☁ 기기 사이 공유 켜기」를 누르고 구글 계정으로 로그인하면 컴퓨터와 휴대폰이 자동으로 같은 마인드맵을 보여 줘요.';
  if (cur) showSaved();
  if (typeof msg === 'string') toast(msg);
  if (Sync.user) renderHomeSoon();
};
$('#hSync').onclick = async () => {
  if (Sync.user) {
    if (confirm(Sync.user.email + ' 에서 로그아웃할까요?\n이 기기의 마인드맵은 그대로 남지만 더는 자동으로 공유되지 않아요.')) { await Sync.signOut(); toast('로그아웃했어요'); }
    return;
  }
  try { await Sync.signIn(); } catch (e) { toast('로그인하지 못했어요: ' + (e.code || e.message)); }
};

/* ================= 시작 ================= */
(async function init() {
  await Store.open();
  if (!Store.db) toast('이 브라우저에서는 저장이 안 돼요. 백업 파일로 저장해 주세요.');
  if (history.state && history.state.map) history.replaceState(null, '', location.pathname);
  $('#tplRow').innerHTML = tplCards(true);
  renderHome(); Sync.onState();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
