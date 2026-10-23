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
    const leads = fs.collection(store, 'leads');
    const rowOf = d => {
      const x = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, name: x.name, secs: x.secs, day: x.day, school: x.school || '', bonus: !!x.bonus, at: x.at && x.at.toMillis ? x.at.toMillis() : Date.now() };
    };
    const liveOf = d => {
      const x = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, name: x.name, stage: x.stage, school: x.school || '', at: x.at && x.at.toMillis ? x.at.toMillis() : Date.now() };
    };
    return {
      async addRun(name, secs, day, extra = {}) {
        const ref = await fs.addDoc(runs, { name, secs, day, ...extra, at: fs.serverTimestamp() });
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
      setLive: (id, name, stage, day, school) => fs.setDoc(fs.doc(live, id), { name, stage, day, ...(school ? { school } : {}), at: fs.serverTimestamp() }),
      markBonus: id => fs.updateDoc(fs.doc(runs, id), { bonus: true }),
      dropLive: id => fs.deleteDoc(fs.doc(live, id)),
      watchLive(day, onChange, onError) {
        return fs.onSnapshot(fs.query(live, fs.where('day', '==', day)), snap => {
          onChange(snap.docs.map(liveOf), snap.docChanges().map(c => ({ type: c.type, row: liveOf(c.doc) })));
        }, onError);
      },
      // Program info opt-ins. Anyone can add one; only staff can read them.
      addLead: lead => fs.addDoc(leads, { ...lead, at: fs.serverTimestamp() }),
      async listLeads() {
        const snap = await fs.getDocs(leads);
        return snap.docs.map(d => { const x = d.data(); return { ...x, id: d.id, at: x.at && x.at.toMillis ? x.at.toMillis() : 0 }; });
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
// School battle colours, in the order schools are listed in config.js.
const PALETTE = ['#38D6FF', '#FFB020', '#FF6FAE', '#B48CFF', '#FF7A45', '#F5E663', '#7AA2FF', '#5EEAD4', '#E2E8F0', '#C6F68D'];
export function schoolColor(name) {
  const list = (window.OV_CONFIG && window.OV_CONFIG.schools) || [], i = list.indexOf(name);
  return i < 0 ? '#9DB0A3' : PALETTE[i % PALETTE.length];
}
export const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
