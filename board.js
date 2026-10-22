import { initDb, dayKey, fmt } from './db.js';

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

/* ---------- full screen + keep awake ---------- */
let wake = null;
async function keepAwake() { try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
$('fsBtn').addEventListener('click', async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch (e) {} keepAwake(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

/* ---------- leaderboard ---------- */
let rows = [], manage = false, staff = false, db = null;
function note(t) { $('boardNote').hidden = !t; $('boardNote').textContent = t || ''; }
function render(freshIds = new Set()) {
  const list = $('boardList'); list.textContent = '';
  $('boardEmpty').hidden = rows.length > 0;
  rows.slice(0, 10).forEach((r, i) => {
    const li = document.createElement('li'); if (freshIds.has(r.id)) li.classList.add('fresh');
    const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = '#' + (i + 1);
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.name || 'Anonymous';
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
}

/* ---------- celebration ---------- */
const queue = []; let busy = false, raf = 0;
function celebrate() {
  if (busy || !queue.length) return;
  const c = queue.shift(); busy = true;
  const rank = rows.findIndex(r => r.id === c.id) + 1;
  $('cName').textContent = c.name || 'Anonymous';
  $('cInfo').textContent = 'Vault cracked in ' + fmt(c.secs) + (rank > 0 ? ' · #' + rank + ' today' : '');
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
$('testBtn').addEventListener('click', () => { audio(); queue.push({ name: 'Test Hacker', secs: 154, id: '_test' }); celebrate(); });

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

/* ---------- start ---------- */
(async () => {
  render();
  db = await initDb();
  if (!db) { note('Leaderboard not connected: add your Firebase settings to config.js (see README).'); return; }
  db.onAuth(u => { staff = !!u; $('manageBtn').hidden = !staff; $('staffBtn').textContent = staff ? 'Sign out' : 'Staff sign-in'; if (!staff) manage = false; render(); });
  let day = dayKey(), unsub = null;
  const sub = () => {
    if (unsub) unsub();
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
