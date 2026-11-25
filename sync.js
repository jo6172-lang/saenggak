'use strict';
/* 생각펼치기 — 기기 사이 자동 공유(동기화)
   기기 안 저장(IndexedDB)이 먼저이고, 로그인하면 인터넷 저장소와 맞춘다.
   같은 마인드맵을 두 곳에서 고치면 나중에 저장한 쪽이 남는다. */
const Sync = {
  backend: null, user: null, ready: false, first: true, unwatch: null,
  device: (() => { try { let d = localStorage.getItem('saenggak-device'); if (!d) { d = 'd' + Math.random().toString(36).slice(2, 10); localStorage.setItem('saenggak-device', d); } return d; } catch (_) { return 'd' + Math.random().toString(36).slice(2, 10); } })(),
  timers: {}, remote: new Map(), online: navigator.onLine,
  onRemote: null, onRemoteDelete: null, onState: null,

  init(backend) {
    this.backend = backend; this.ready = true;
    backend.onAuth(u => this._auth(u));
    this._state();
  },
  _state() { if (this.onState) this.onState(); },
  async _auth(u) {
    if (this.unwatch) { this.unwatch(); this.unwatch = null; }
    this.user = u; this.first = true; this.remote.clear(); this._state();
    if (u) this.unwatch = this.backend.watch(u.uid, docs => this._incoming(docs));
  },
  async _incoming(docs) {
    for (const r of docs) {
      if (!r || !r.id) continue;
      this.remote.set(r.id, { updated: r.updated || 0, deleted: !!r.deleted });
      const local = await Store.get(r.id);
      if (r.deleted) {
        if (local && (local.updated || 0) <= (r.updated || 0)) { await Store.del(r.id); this.onRemoteDelete && this.onRemoteDelete(r.id); }
        continue;
      }
      if (!local || (r.updated || 0) > (local.updated || 0)) {
        let root; try { root = JSON.parse(r.root); } catch (_) { continue; }
        const m = { id: r.id, title: r.title || '', layout: r.layout || 'mind', theme: r.theme || 'bright', created: r.created || r.updated, updated: r.updated, root };
        await Store.put(m);
        this.onRemote && this.onRemote(m, r.device !== this.device);
      }
    }
    if (this.first) {            // 처음 맞출 때: 이 기기에만 있거나 더 새 것을 올린다
      this.first = false;
      for (const m of await Store.all()) {
        const r = this.remote.get(m.id);
        if (!r || (!r.deleted && (m.updated || 0) > r.updated)) this.push(m, true);
      }
    }
    this._state();
  },
  /* 기기 안에 저장한 마인드맵을 인터넷 저장소로 (잠깐 모아서 보냄) */
  push(m, now) {
    if (!this.user || !m) return;
    clearTimeout(this.timers[m.id]);
    const send = () => {
      const data = { id: m.id, title: m.title || '', layout: m.layout, theme: m.theme, created: m.created || m.updated, updated: m.updated, deleted: false, device: this.device, root: JSON.stringify(m.root) };
      if (data.root.length > 900000) { this.onState && this.onState('큰 그림이 많아 이 마인드맵은 공유하지 못했어요. 그림을 줄여 주세요.'); return; }
      this.remote.set(m.id, { updated: m.updated, deleted: false });
      Promise.resolve(this.backend.put(this.user.uid, data)).catch(e => this.onState && this.onState('공유 저장 실패: ' + (e.code || e.message)));
    };
    if (now) send(); else this.timers[m.id] = setTimeout(send, 1200);
  },
  remove(id) {
    if (!this.user) return;
    clearTimeout(this.timers[id]);
    const u = Date.now();
    this.remote.set(id, { updated: u, deleted: true });
    Promise.resolve(this.backend.put(this.user.uid, { id, deleted: true, updated: u, device: this.device, root: '' })).catch(() => {});
  },
  signIn() { return this.backend && this.backend.signIn(); },
  signOut() { return this.backend && this.backend.signOut(); },
};
window.Sync = Sync;
window.addEventListener('online', () => { Sync.online = true; Sync._state(); });
window.addEventListener('offline', () => { Sync.online = false; Sync._state(); });
