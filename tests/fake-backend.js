/* 시험 전용: 진짜 파이어베이스 대신 시험 서버(/__fake)에 저장한다. ?fakesync=사용자이름 으로 열 때만 쓰인다. */
(function () {
  const uid = new URLSearchParams(location.search).get('fakesync');
  let authCb = null, seen = {}, timer = null;
  const user = { uid, email: uid + '@test', name: uid };
  let signed = localStorage.getItem('fake-signed') === '1';
  window.Sync.init({
    onAuth: cb => { authCb = cb; cb(signed ? user : null); },
    signIn: async () => { signed = true; localStorage.setItem('fake-signed', '1'); authCb(user); },
    signOut: async () => { signed = false; localStorage.removeItem('fake-signed'); authCb(null); },
    watch: (u, cb) => {
      seen = {};
      const poll = async () => {
        try {
          const all = await (await fetch('/__fake/' + u)).json();
          const changed = Object.values(all).filter(d => seen[d.id] !== d.updated + ':' + d.device);
          changed.forEach(d => seen[d.id] = d.updated + ':' + d.device);
          if (changed.length || !poll.done) { poll.done = true; cb(changed); }
        } catch (_) {}
      };
      poll(); timer = setInterval(poll, 400); return () => clearInterval(timer);
    },
    put: (u, d) => fetch('/__fake/' + u, { method: 'POST', body: JSON.stringify(d) }),
  });
})();
