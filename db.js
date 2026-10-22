// Leaderboard storage (Firebase Firestore). Returns null when Firebase
// isn't configured or can't load, so the game still works without it.
const V = '10.12.2';
const base = `https://www.gstatic.com/firebasejs/${V}/`;

export async function initDb() {
  const cfg = window.OV_CONFIG && window.OV_CONFIG.firebase;
  if (!cfg || !cfg.apiKey || cfg.apiKey.startsWith('PASTE')) return null;
  try {
    const [{ initializeApp }, fs, au] = await Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-firestore.js'),
      import(base + 'firebase-auth.js')
    ]);
    const app = initializeApp(cfg);
    const store = fs.getFirestore(app);
    const auth = au.getAuth(app);
    const runs = fs.collection(store, 'runs');
    const live = fs.collection(store, 'live');
    const rowOf = d => {
      const x = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, name: x.name, secs: x.secs, day: x.day, at: x.at && x.at.toMillis ? x.at.toMillis() : Date.now() };
    };
    const liveOf = d => {
      const x = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, name: x.name, stage: x.stage, at: x.at && x.at.toMillis ? x.at.toMillis() : Date.now() };
    };
    return {
      async addRun(name, secs, day) {
        const ref = await fs.addDoc(runs, { name, secs, day, at: fs.serverTimestamp() });
        return ref.id;
      },
      async listDay(day) {
        const snap = await fs.getDocs(fs.query(runs, fs.where('day', '==', day)));
        return snap.docs.map(rowOf).sort((a, b) => a.secs - b.secs);
      },
      watchDay(day, onRows, onError) {
        let first = true;
        return fs.onSnapshot(fs.query(runs, fs.where('day', '==', day)), snap => {
          const added = first ? [] : snap.docChanges().filter(c => c.type === 'added').map(c => rowOf(c.doc));
          first = false;
          onRows(snap.docs.map(rowOf).sort((a, b) => a.secs - b.secs), added);
        }, onError);
      },
      // Live intruder map: one small doc per player in progress.
      newLiveId: () => fs.doc(live).id,
      setLive: (id, name, stage, day) => fs.setDoc(fs.doc(live, id), { name, stage, day, at: fs.serverTimestamp() }),
      dropLive: id => fs.deleteDoc(fs.doc(live, id)),
      watchLive(day, onChange, onError) {
        return fs.onSnapshot(fs.query(live, fs.where('day', '==', day)), snap => {
          onChange(snap.docs.map(liveOf), snap.docChanges().map(c => ({ type: c.type, row: liveOf(c.doc) })));
        }, onError);
      },
      deleteRun: id => fs.deleteDoc(fs.doc(store, 'runs', id)),
      signIn: (email, pw) => au.signInWithEmailAndPassword(auth, email, pw),
      signOut: () => au.signOut(auth),
      onAuth: fn => au.onAuthStateChanged(auth, fn)
    };
  } catch (e) {
    console.warn('Leaderboard unavailable:', e);
    return null;
  }
}

export const dayKey = (d = new Date()) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
