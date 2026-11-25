/* 생각펼치기 — 파이어베이스 연결 (구글 로그인 + Firestore). config.js 에 설정이 있을 때만 켜진다. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, onSnapshot, doc, setDoc } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const cfg = window.FIREBASE_CONFIG;
if (cfg && cfg.apiKey && window.Sync) {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  window.Sync.init({
    onAuth: cb => onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email, name: u.displayName } : null)),
    signIn: async () => {
      const p = new GoogleAuthProvider();
      try { await signInWithPopup(auth, p); }
      catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, p);
        else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') throw e;
      }
    },
    signOut: () => signOut(auth),
    watch: (uid, cb) => onSnapshot(collection(db, 'users', uid, 'maps'),
      snap => cb(snap.docChanges().filter(c => c.type !== 'removed').map(c => ({ ...c.doc.data(), id: c.doc.id }))),
      err => window.Sync.onState && window.Sync.onState('공유 연결 오류: ' + err.code)),
    put: (uid, d) => setDoc(doc(db, 'users', uid, 'maps', d.id), d, { merge: true }),
  });
}
