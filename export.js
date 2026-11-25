'use strict';
/* 생각펼치기 — 내보내기 (그림, PDF, 글, 파일) */

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function safeName(s, ext) { return ((s || '마인드맵').split('\n')[0].replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 40) || '마인드맵') + ext; }

/* SVG 글 → 캔버스 (크기는 최대 8000px 안으로) */
function svgToCanvas(svgText, scale = 2) {
  return new Promise((resolve, reject) => {
    const m = svgText.match(/width="([\d.]+)" height="([\d.]+)"/);
    let w = parseFloat(m[1]), h = parseFloat(m[2]);
    const k = Math.min(scale, 8000 / w, 8000 / h);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => reject(new Error('그림 만들기 실패'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  });
}

async function exportPNG(map, theme) {
  const c = await svgToCanvas(standaloneSVG(cloneMap(map), theme), 2);
  await new Promise(r => c.toBlob(b => { downloadBlob(b, safeName(map.root.text, '.png')); r(); }, 'image/png'));
}

/* JPEG 한 장을 담은 PDF를 직접 만든다 */
async function exportPDF(map, theme) {
  const c = await svgToCanvas(standaloneSVG(cloneMap(map), theme), 2);
  const jpgUrl = c.toDataURL('image/jpeg', 0.92);
  const bin = atob(jpgUrl.split(',')[1]);
  const jpg = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) jpg[i] = bin.charCodeAt(i);
  // 쪽 크기: 긴 쪽을 A4 긴 변(842pt)에 맞춤
  const iw = c.width, ih = c.height, long = 842, margin = 24;
  const k = (long - margin * 2) / Math.max(iw, ih);
  const dw = iw * k, dh = ih * k, W = dw + margin * 2, H = dh + margin * 2;
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); body(); push(`\nendobj\n`); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream'); });
  const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${margin} ${margin} cm /Im0 Do Q`;
  obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  const xref = len;
  let x = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  downloadBlob(new Blob(parts, { type: 'application/pdf' }), safeName(map.root.text, '.pdf'));
}

function treeToMd(n, d = 0) {
  const line = d < 6 ? '#'.repeat(d + 1) + ' ' : '  '.repeat(d - 6) + '- ';
  let s = line + n.text.replace(/\n/g, ' ') + '\n';
  if (n.note) s += (d < 6 ? '' : '  '.repeat(d - 5)) + '> ' + n.note.replace(/\n/g, ' ') + '\n';
  return s + n.children.map(c => treeToMd(c, d + 1)).join('');
}
function exportMD(map) { downloadBlob(new Blob([treeToMd(map.root)], { type: 'text/markdown' }), safeName(map.root.text, '.md')); }
function exportJSON(map) {
  const data = { app: '생각펼치기', version: 1, title: map.title, layout: map.layout, theme: map.theme, root: stripTemp(map.root) };
  downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), safeName(map.title || map.root.text, '.saenggak.json'));
}

/* 글 목록(마크다운) → 나무 */
function mdToTree(md, mk) {
  const clean = s => s.replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
  let r = null; const stack = []; let base = 0, last = null;
  for (const raw of md.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let m = raw.match(/^(#{1,6})\s+(.*)$/), depth, text;
    if (m) { depth = m[1].length - 1; text = clean(m[2]); base = depth + 1; }
    else if ((m = raw.match(/^(\s*)[-*+]\s+(.*)$/)) || (m = raw.match(/^(\s*)\d+[.)]\s+(.*)$/))) { depth = base + Math.floor(m[1].replace(/\t/g, '  ').length / 2); text = clean(m[2]); }
    else if ((m = raw.match(/^\s*>\s?(.*)$/)) && last) { last.note = (last.note ? last.note + '\n' : '') + m[1]; continue; }
    else continue;
    const node = mk(text); last = node;
    if (!r) { if (depth === 0) { r = node; stack[0] = r; continue; } r = mk('가운데 주제'); stack[0] = r; }
    if (depth === 0) depth = 1;
    let pd = Math.min(depth - 1, stack.length - 1); while (pd > 0 && !stack[pd]) pd--;
    stack[pd].children.push(node); stack[depth] = node; stack.length = depth + 1;
  }
  return r || mk('가운데 주제');
}

/* 임시 값(_로 시작) 빼고 복사 */
function stripTemp(n) {
  const o = {};
  for (const k in n) if (k[0] !== '_') o[k] = k === 'children' ? n.children.map(stripTemp) : n[k];
  return o;
}
function cloneMap(map) { return { ...map, root: JSON.parse(JSON.stringify(stripTemp(map.root))) }; }
