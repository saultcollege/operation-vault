import { initDb, dayKey, fmt, schoolColor } from './db.js?v=20261027a';

const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const bootAt = Date.now();

/* ---------- QR code to the game ---------- */
(function qr() {
  const cfgUrl = window.OV_CONFIG && window.OV_CONFIG.playUrl;
  const url = cfgUrl || new URL('./', location.href).href;
  try {
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    $('qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch (e) { $('qr').textContent = url; }
})();

/* ---------- ticker ---------- */
const THREATS = [['c', 'Ransomware doesn’t take weekends off.'], ['c', 'One click on one email. Whole network down.'], ['h', 'Your boss just called. It was a deepfake.'], ['h', '“Password123” is still out there. Still.'], ['w', 'Your smart fridge is chatting with strangers.'], ['w', 'That free café Wi-Fi? Not your friend.'], ['h', 'MFA prompt #14 at 2 a.m. Someone tapped “Approve.”'], ['w', 'A USB stick in the parking lot. Who plugs it in?'], ['w', 'Someone has to fix all this. Why not you?']];
const SEV = { c: '[CRITICAL]', h: '[HIGH]', w: '[WARN]' };
for (let r = 0; r < 2; r++) THREATS.forEach(([s, x]) => { const a = document.createElement('span'); a.className = 'sv ' + s; a.textContent = SEV[s]; const b = document.createElement('span'); b.textContent = x; $('ticker').append(a, b); });

/* ---------- audio ---------- */
let actx = null, soundOn = false;
function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
function siren() {
  const a = audio(); if (!a) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = 'sawtooth';
  for (let i = 0; i < 5; i++) { o.frequency.setValueAtTime(520, t + i * .8); o.frequency.linearRampToValueAtTime(1150, t + i * .8 + .4); o.frequency.linearRampToValueAtTime(520, t + i * .8 + .8); }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + .05); g.gain.setValueAtTime(0.12, t + 3.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 4.05);
}
$('soundBtn').addEventListener('click', () => { soundOn = !soundOn; audio(); $('soundBtn').textContent = soundOn ? 'Sound on' : 'Sound off'; $('soundBtn').setAttribute('aria-pressed', soundOn); });

function blip(hi) {
  const a = audio(); if (!a) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = 'square';
  o.frequency.setValueAtTime(hi ? 880 : 440, t); o.frequency.setValueAtTime(hi ? 1320 : 660, t + .08);
  g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .2); o.connect(g).connect(a.destination); o.start(t); o.stop(t + .21);
}

/* ---------- full screen + keep awake ---------- */
let wake = null;
async function keepAwake() { try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
$('fsBtn').addEventListener('click', async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch (e) {} keepAwake(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

/* ---------- leaderboard ---------- */
let rows = [], manage = false, staff = false, db = null;
const CFG = window.OV_CONFIG || {};
const INSTR = (() => { const i = CFG.instructor || {}, m = String(i.time || '').match(/^(\d+):(\d\d)$/); return m ? { name: String(i.name || 'Instructor'), secs: +m[1] * 60 + +m[2] } : null; })();
// The live-map warning sticks until reload, so leaderboard updates don't wipe it.
let liveErr = '';
function note(t) { t = t || liveErr; $('boardNote').hidden = !t; $('boardNote').textContent = t; }
function render(freshIds = new Set()) {
  const list = $('boardList'); list.textContent = '';
  $('boardEmpty').hidden = rows.length > 0;
  // The instructor's "line to beat" sits among the top 10 but takes no rank.
  const top = rows.slice(0, 10), at = INSTR ? rows.filter(r => r.secs < INSTR.secs).length : -1;
  if (INSTR) {
    if (at >= 10) top.splice(9);
    const li = document.createElement('li'); li.className = 'target';
    const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = '★';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = 'Line to beat: ' + INSTR.name;
    const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = fmt(INSTR.secs);
    li.append(rk, nm, tm, document.createElement('span'));
    top.splice(Math.min(at, top.length), 0, { target: li });
  }
  let n = 0;
  top.forEach(r => {
    if (r.target) { list.appendChild(r.target); return; }
    const i = n++;
    const li = document.createElement('li'); if (freshIds.has(r.id)) li.classList.add('fresh');
    if (r.school) { li.classList.add('has-sch'); li.style.setProperty('--sc', schoolColor(r.school)); }
    const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = '#' + (i + 1);
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = (r.name || 'Anonymous') + (r.bonus ? ' ★' : '');
    if (r.school) { const sc = document.createElement('span'); sc.className = 'sch'; sc.textContent = r.school; nm.appendChild(sc); }
    const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = fmt(r.secs);
    const d = document.createElement('span');
    if (manage && staff) {
      const x = document.createElement('button'); x.type = 'button'; x.className = 'del'; x.textContent = '✕'; x.setAttribute('aria-label', 'Remove ' + (r.name || 'entry'));
      x.addEventListener('click', async () => { try { await db.deleteRun(r.id); } catch (e) { note('Couldn’t remove that entry. Check that your staff UID is in the Firestore rules.'); } });
      d.appendChild(x);
    }
    li.append(rk, nm, tm, d); list.appendChild(li);
  });
  $('stCount').textContent = rows.length;
  $('stBest').textContent = rows.length ? fmt(rows[0].secs) : '—';
  drawBattle(freshIds.size > 0);
}

/* ---------- school battle ---------- */
// Score = average of a school's 5 best times today, so a big group can't win
// on numbers alone. Schools with fewer than 5 finishers sit below, marked.
const TEAM_N = 5;
let leader = null;
function drawBattle(live) {
  const by = new Map();
  rows.forEach(r => { if (r.school) { if (!by.has(r.school)) by.set(r.school, []); by.get(r.school).push(r.secs); } });
  const teams = [...by.entries()].map(([name, t]) => { const best = t.sort((a, b) => a - b).slice(0, TEAM_N); return { name, n: t.length, full: best.length >= TEAM_N, avg: best.reduce((a, b) => a + b, 0) / best.length }; })
    .sort((a, b) => (b.full - a.full) || (a.avg - b.avg));
  const list = $('battle'); list.textContent = ''; $('battleEmpty').hidden = teams.length > 0;
  teams.forEach((t, i) => {
    const li = document.createElement('li'); li.style.setProperty('--sc', schoolColor(t.name)); if (!t.full) li.classList.add('prov');
    const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = i + 1;
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = t.name;
    const ct = document.createElement('span'); ct.className = 'ct'; ct.textContent = t.full ? t.n + ' hackers' : t.n + '/' + TEAM_N + ' to qualify';
    const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = fmt(t.avg);
    li.append(rk, nm, ct, sc); list.appendChild(li);
  });
  const now = teams[0] ? teams[0].name : null;
  if (live && now && now !== leader) pushAlert('c', now + ' takes the lead in the school battle!', true);
  leader = now;
}

/* ---------- live intruder map ---------- */
// Players at stage 1–6 sit at that node; stage 7 means they opened the vault.
// Node n sits at NODE_X[n] across the map.
// A dot disappears when its phone stops checking in (STALE), or soon after the vault opens.
const STALE = 120000, VAULT_SHOW = 25000, MAXC = 3, NODES = 6, NODE_X = n => ((n - .5) * 100 / NODES).toFixed(2) + '%';
const ALERT = {
  1: ['w', n => 'New intruder ' + n + ' is probing the firewall'],
  2: ['w', n => n + ' cracked the cipher and slipped past the firewall'],
  3: ['h', n => n + ' cracked a staff password'],
  4: ['h', n => n + ' traced the break-in in the server logs'],
  5: ['h', n => n + ' beat the phishing test and is rewriting the door code'],
  6: ['c', n => n + ' fixed the door code and is heading for the vault'],
  7: ['c', n => n + ' OPENED THE VAULT']
};
const live = new Map(), demo = new Map(), chips = new Map(), seenStage = new Map();
function addAlert(stageN, name, school) { const [sev, txt] = ALERT[stageN]; pushAlert(sev, txt((name || 'Anonymous') + (school ? ' (' + school + ')' : '')), stageN >= 6); }
function pushAlert(sev, text, hi) {
  const li = document.createElement('li'); li.className = 'new';
  const tm = document.createElement('span'); tm.className = 'at'; tm.textContent = new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const sv = document.createElement('span'); sv.className = 'sv ' + sev; sv.textContent = SEV[sev];
  const tx = document.createElement('span'); tx.textContent = text;
  li.append(tm, sv, tx); $('alerts').prepend(li);
  while ($('alerts').children.length > 6) $('alerts').lastChild.remove();
  if (soundOn) blip(hi);
}
function track(row, initial) {
  const prev = seenStage.get(row.id) || 0;
  if (!initial && row.stage > prev) addAlert(row.stage, row.name, row.school);
  if (initial) row.movedAt = row.at; else if (row.stage !== prev) row.movedAt = Date.now(); else row.movedAt = (live.get(row.id) || demo.get(row.id) || row).movedAt || row.at;
  row.seen = initial ? row.at : Date.now();
  seenStage.set(row.id, row.stage);
}
function onScreen(now = Date.now()) {
  return [...live.values(), ...demo.values()].filter(r => now - r.seen < STALE && !(r.stage === 7 && now - r.movedAt > VAULT_SHOW));
}
function drawMap() {
  const rows = onScreen(), net = $('net');
  const inside = rows.filter(r => r.stage < 7).length;
  $('inCount').textContent = inside;
  $('inText').textContent = inside === 0 ? 'intruders detected. The network is quiet… for now.' : (inside === 1 ? 'intruder' : 'intruders') + ' inside the network right now';
  $('inCount').classList.toggle('hot', inside > 0);
  const byNode = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  rows.forEach(r => byNode[Math.min(r.stage, NODES)].push(r));
  const want = new Map();
  Object.entries(byNode).forEach(([n, list]) => {
    list.sort((a, b) => a.movedAt - b.movedAt);
    const node = net.querySelector('.node[data-n="' + n + '"]');
    node.classList.toggle('hot', list.length > 0); node.querySelector('.nc').textContent = list.length || '';
    const shown = list.length > MAXC ? list.slice(0, MAXC - 1) : list;
    shown.forEach((r, i) => want.set(r.id, { n: +n, i, name: r.name || 'Anonymous', won: r.stage === 7, sc: r.school ? schoolColor(r.school) : '' }));
    if (list.length > MAXC) want.set('_more' + n, { n: +n, i: MAXC - 1, name: '+' + (list.length - MAXC + 1) + ' more', more: true });
  });
  chips.forEach((el, id) => { if (!want.has(id)) { chips.delete(id); el.classList.add('gone'); setTimeout(() => el.remove(), 600); } });
  want.forEach((w, id) => {
    let el = chips.get(id);
    if (!el) {
      el = document.createElement('div'); el.className = 'chip';
      el.style.setProperty('--x', w.more ? NODE_X(w.n) : '-6%'); el.style.setProperty('--i', w.i);
      net.appendChild(el); chips.set(id, el); void el.offsetWidth;
    }
    el.textContent = w.name; el.classList.toggle('more', !!w.more); el.classList.toggle('won', !!w.won);
    if (w.sc) el.style.setProperty('--sc', w.sc); else el.style.removeProperty('--sc');
    el.style.setProperty('--x', NODE_X(w.n)); el.style.setProperty('--i', w.i);
  });
}
setInterval(drawMap, 5000);

// Staff "Test alarm": a fake intruder runs the course on this screen only.
function runDemo() {
  const id = '_demo' + Date.now(), name = 'TEST-' + (10 + Math.floor(Math.random() * 90));
  const sl = CFG.schools || [], school = sl.length ? sl[Math.floor(Math.random() * sl.length)] : '';
  [1, 2, 3, 4, 5, 6, 7].forEach((n, k) => setTimeout(() => {
    const row = { id, name, school, stage: n, at: Date.now() }; track(row, false); demo.set(id, row); drawMap();
    if (n === 7) { setTimeout(() => { demo.delete(id); drawMap(); }, 8000); queue.push({ name, school, secs: 154, id: '_test' }); setTimeout(celebrate, 2500); }
  }, k * 2200));
}

/* ---------- celebration ---------- */
const queue = []; let busy = false, raf = 0;
function celebrate() {
  if (busy || !queue.length) return;
  const c = queue.shift(); busy = true;
  const rank = rows.findIndex(r => r.id === c.id) + 1;
  $('cName').textContent = c.name || 'Anonymous';
  $('cInfo').textContent = (c.school ? c.school + ' · ' : '') + 'Vault cracked in ' + fmt(c.secs) + (rank > 0 ? ' · #' + rank + ' today' : '');
  $('cBeat').hidden = !(INSTR && c.secs < INSTR.secs); $('cBeat').textContent = INSTR ? '★ Beat ' + INSTR.name + '’s time! ★' : '';
  $('cName').style.color = c.school ? schoolColor(c.school) : '';
  $('celebrate').hidden = false; rain(); if (soundOn) siren();
  setTimeout(() => { $('celebrate').hidden = true; cancelAnimationFrame(raf); busy = false; celebrate(); }, 7000);
}
function rain() {
  if (reduce) return; const cv = $('rain'), ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const fs = 22, cols = Math.ceil(cv.width / fs), y = Array.from({ length: cols }, () => Math.random() * -50);
  const draw = () => { ctx.fillStyle = 'rgba(10,14,11,.18)'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#3DFF8A'; ctx.font = fs + 'px JetBrains Mono, monospace';
    for (let i = 0; i < cols; i++) { ctx.fillText(Math.random() < .5 ? '0' : '1', i * fs, y[i] * fs); if (y[i] * fs > cv.height && Math.random() > .975) y[i] = 0; y[i]++; }
    raf = requestAnimationFrame(draw); };
  draw();
}
$('testBtn').addEventListener('click', () => { audio(); runDemo(); });

/* ---------- staff sign-in ---------- */
$('staffBtn').addEventListener('click', async () => {
  if (!db) { note('Leaderboard isn’t connected yet. Add your Firebase settings to config.js.'); return; }
  if (staff) { await db.signOut(); return; }
  $('staffPanel').hidden = false; $('stEmail').focus();
});
$('stCancel').addEventListener('click', () => { $('staffPanel').hidden = true; });
$('staffForm').addEventListener('submit', async e => {
  e.preventDefault(); $('stMsg').className = 'msg info'; $('stMsg').textContent = 'Signing in…';
  try { await db.signIn($('stEmail').value.trim(), $('stPw').value); $('staffPanel').hidden = true; $('stPw').value = ''; $('stMsg').textContent = ''; }
  catch (err) { $('stMsg').className = 'msg bad'; $('stMsg').textContent = 'Sign-in failed. Check the email and password.'; }
});
$('manageBtn').addEventListener('click', () => { manage = !manage; $('manageBtn').setAttribute('aria-pressed', manage); $('manageBtn').textContent = manage ? 'Done' : 'Manage'; render(); });

/* ---------- game on/off (staff) ---------- */
let gameOpen = true;
$('gameBtn').addEventListener('click', async () => {
  const msg = gameOpen ? 'Turn the game OFF? New visitors will see the program showcase instead. Anyone mid-game can still finish.' : 'Turn the game back ON for everyone?';
  if (!confirm(msg)) return;
  try { await db.setGameOpen(!gameOpen); } catch (e) { note('Couldn’t change the game switch. Check that your staff UID is in the Firestore rules and the latest rules are published.'); }
});

/* ---------- start ---------- */
(async () => {
  render(); drawMap();
  db = await initDb();
  if (!db) { note('Leaderboard not connected: add your Firebase settings to config.js (see README).'); return; }
  db.onAuth(u => { staff = !!u; $('manageBtn').hidden = !staff; $('gameBtn').hidden = !staff; $('staffBtn').textContent = staff ? 'Sign out' : 'Staff sign-in'; if (!staff) manage = false; render(); });
  db.watchGame(open => {
    gameOpen = open; $('gateTag').hidden = open;
    $('gameBtn').textContent = 'Game: ' + (open ? 'ON' : 'OFF'); $('gameBtn').classList.toggle('off', !open);
  }, () => {});
  let day = dayKey(), unsub = null, unsubLive = null;
  const sub = () => {
    if (unsub) unsub();
    if (unsubLive) unsubLive();
    let firstLive = true;
    live.clear();
    unsubLive = db.watchLive(day, (all, changes) => {
      changes.forEach(({ type, row }) => {
        if (type === 'removed') { live.delete(row.id); seenStage.delete(row.id); return; }
        track(row, firstLive); live.set(row.id, row);
      });
      firstLive = false; drawMap();
    }, () => { liveErr = 'Live map stopped. Check that the latest firestore.rules are published, then reload.'; note(); });
    unsub = db.watchDay(day, (r, added) => {
      rows = r; note('');
      const fresh = new Set();
      added.forEach(a => { if (a.at > bootAt - 60000) { fresh.add(a.id); queue.push(a); } });
      render(fresh); celebrate();
    }, () => note('Live updates stopped. Reload the page to reconnect.'));
  };
  sub();
  setInterval(() => { if (dayKey() !== day) { day = dayKey(); sub(); } }, 60000);
})();
