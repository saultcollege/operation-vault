import { initDb, dayKey, fmt } from './db.js';

const VAULT = String((window.OV_CONFIG && window.OV_CONFIG.vault) || '7319').replace(/\D/g, '').padEnd(4, '0').slice(0, 4);
const KIOSK = new URLSearchParams(location.search).has('kiosk');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const cleanName = s => (s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

// Names containing any of these (after undoing common tricks like 0→o, 1→i,
// 3→e, 4/@→a, 5/$→s and removing spaces or symbols) are refused.
// Add words to this list to block them too.
const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'dick', 'cock', 'pussy', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'retard', 'asshole', 'bastard', 'penis', 'vagina', 'porn', 'twat', 'wank', 'kkk', 'jizz', 'tits', 'boob', 'piss', 'sex'];
// Real names and words that contain a blocked word by accident.
const ALLOWED = ['dickson', 'dickens', 'dickinson', 'benedict', 'hancock', 'peacock', 'babcock', 'hitchcock', 'cockburn', 'woodcock', 'alcock', 'fagan', 'grape', 'drape', 'scrape', 'trapeze', 'essex', 'sussex', 'middlesex', 'sexton'];
function isAppropriate(name) {
  let flat = name.toLowerCase()
    .replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e')
    .replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/7/g, 't')
    .replace(/[^a-z]/g, '');
  ALLOWED.forEach(w => { flat = flat.split(w).join(''); });
  return !BLOCKED.some(w => flat.includes(w));
}
const dbReady = initDb();

/* ---------- audio ---------- */
let actx = null;
function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
function chime() { const a = audio(); if (!a) return; const t = a.currentTime; [523, 659, 784, 1047].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * .09); g.gain.exponentialRampToValueAtTime(0.08, t + i * .09 + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * .09 + .25); o.connect(g).connect(a.destination); o.start(t + i * .09); o.stop(t + i * .09 + .3); }); }
function buzz() { const a = audio(); if (!a) return; const t = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = 'sawtooth'; o.frequency.value = 110; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .25); o.connect(g).connect(a.destination); o.start(t); o.stop(t + .26); }

/* ---------- flow ---------- */
const screens = [...document.querySelectorAll('#play .screen')];
function show(name) { screens.forEach(s => s.hidden = s.dataset.s !== name); window.scrollTo(0, 0); }
let t0 = 0, penalty = 0, running = false, stage = 0, ticking = null, finalSecs = 0;
const elapsed = () => (performance.now() - t0) / 1000 + penalty;
function addPen(s, why) { penalty += s; const p = $('pen'); p.textContent = '+' + s + 's ' + why; clearTimeout(p._t); p._t = setTimeout(() => p.textContent = '', 1800); }
function pips() { document.querySelectorAll('.pip').forEach(p => { const n = +p.dataset.p; p.classList.toggle('done', n < stage); p.classList.toggle('now', n === stage); }); }
function tick() { if (running) $('clock').textContent = fmt(elapsed()); }
function bad(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); buzz(); }

function start() {
  audio();
  t0 = performance.now(); penalty = 0; running = true; stage = 1;
  $('hud').hidden = false; pips(); clearInterval(ticking); ticking = setInterval(tick, 250);
  resetStages(); show('s1'); setTimeout(() => $('shift').focus(), 50);
}
$('startBtn').addEventListener('click', start);

/* ---------- stage 1: cipher ---------- */
const WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
const KEY = 7;
const caesar = (s, k) => s.replace(/[A-Z]/g, c => String.fromCharCode((c.charCodeAt(0) - 65 + k + 104) % 26 + 65));
const CIPH = caesar(`MEET AT THE DOCK AT MIDNIGHT. THE FIRST VAULT DIGIT IS ${WORDS[+VAULT[0]]}.`, KEY);
function renderCipher() { const k = +$('shift').value; $('shiftVal').textContent = k; $('cipherText').textContent = caesar(CIPH, -k); $('cipherText').classList.toggle('ok', k === KEY); }
$('shift').addEventListener('input', renderCipher);
$('shDown').addEventListener('click', () => { $('shift').value = (+$('shift').value + 25) % 26; renderCipher(); });
$('shUp').addEventListener('click', () => { $('shift').value = (+$('shift').value + 1) % 26; renderCipher(); });

/* ---------- stage 3: log ---------- */
const LOG = [
  ['02:41:07', '10.0.4.22', 'jreyes', 'ok', 'LOGIN'],
  ['02:58:13', '203.0.113.66', 'admin', 'fail', 'FAILED'],
  ['02:58:14', '203.0.113.66', 'admin', 'fail', 'FAILED'],
  ['02:58:15', '203.0.113.66', 'root', 'fail', 'FAILED'],
  ['02:58:17', '203.0.113.66', 'backup', 'fail', 'FAILED'],
  ['03:01:44', '10.0.4.31', 'mchen', 'ok', 'LOGIN'],
  ['03:12:09', '203.0.113.66', 'svc_backup', 'ok', 'LOGIN'],
  ['03:15:30', '10.0.4.22', 'jreyes', 'out', 'LOGOUT'],
  ['03:40:02', '10.0.4.31', 'mchen', 'fail', 'FAILED']
];
const LOG_ANS = 6;
function buildLog() {
  const box = $('logList'); box.textContent = '';
  LOG.forEach((r, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'logl';
    const a = document.createElement('span'); a.textContent = r[0];
    const m = document.createElement('span'); const ip = document.createElement('span'); ip.className = 'ip'; ip.textContent = r[1] + ' '; const u = document.createElement('span'); u.className = 'u'; u.textContent = r[2]; m.append(ip, u);
    const st = document.createElement('span'); st.className = 'st ' + r[3]; st.textContent = r[4];
    b.append(a, m, st); b.setAttribute('aria-label', r[0] + ' ' + r[1] + ' user ' + r[2] + ' ' + r[4]);
    b.addEventListener('click', () => pickLog(i, b)); box.appendChild(b);
  });
}
function pickLog(i, b) {
  if (stage !== 3) return;
  if (i === LOG_ANS) { b.classList.add('right'); setTimeout(() => reward(3), 500); return; }
  b.classList.add('wrong'); addPen(10, 'wrong line'); bad(b);
  const r = LOG[i];
  $('m3').className = 'msg bad';
  $('m3').textContent = r[3] === 'fail' && r[1].startsWith('203') ? 'That attempt failed. Find the moment they actually got IN.'
    : r[1].startsWith('10.') ? 'That’s an internal address: a staff member on the office network.' : 'Not that one. Look again.';
}

/* ---------- stage 4: phish ---------- */
const MAIL = [
  { ph: true, from: 'SMS · +1 (705) 555-0142', body: 'Lakehead Credit Union: your account is LOCKED. Verify within 1 hour: <span class="lk">lakehead-cu-secure.co/login</span>', why: 'Urgent lock-out plus a link to a look-alike domain.' },
  { ph: false, from: 'Facilities <facilities@lakeheadlogistics.ca>', body: 'Heads up: fire drill Thursday at 10 a.m. Please use the east stairwell. No action needed.', why: 'Real company domain, no link, nothing asked of you.' },
  { ph: true, from: 'Dana Morgan, CEO <dana.lakehead.ceo@outlook.com>', body: 'Need you to wire $4,800 to a new vendor today. I’m in meetings, keep this between us. Bank details attached.', why: 'A "CEO" on a personal account, secrecy and a money transfer.' }
];
let mi = 0, mailLock = false;
function renderMail() { const m = MAIL[mi]; $('p4').textContent = 'Message ' + (mi + 1) + ' of ' + MAIL.length; const box = $('mail'); box.textContent = ''; const f = document.createElement('div'); f.className = 'from'; f.textContent = 'From: ' + m.from; const b = document.createElement('div'); b.innerHTML = m.body; box.append(f, b); }
document.querySelectorAll('[data-ph]').forEach(btn => btn.addEventListener('click', () => {
  if (stage !== 4 || mailLock) return;
  const m = MAIL[mi], ok = (btn.dataset.ph === '1') === m.ph;
  $('m4').className = 'msg ' + (ok ? 'good' : 'bad');
  $('m4').textContent = (ok ? 'Correct. ' : 'Wrong, +10s. ') + (m.ph ? 'Phishing: ' : 'Legit: ') + m.why;
  if (!ok) { addPen(10, 'wrong call'); bad($('mail')); }
  mailLock = true;
  setTimeout(() => { mailLock = false; mi++; if (mi >= MAIL.length) reward(4); else { renderMail(); $('m4').textContent = ''; } }, ok ? 1100 : 2200);
}));

/* ---------- answers + hints ---------- */
document.querySelectorAll('[data-submit]').forEach(b => b.addEventListener('click', () => submit(+b.dataset.submit)));
['a1', 'a2'].forEach((id, i) => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') submit(i + 1); }));
function submit(n) {
  if (n === 1 && stage === 1) {
    const v = $('a1').value.trim().toUpperCase();
    if (v === VAULT[0] || v === WORDS[+VAULT[0]]) reward(1);
    else { addPen(10, 'wrong answer'); $('m1').className = 'msg bad'; $('m1').textContent = +$('shift').value === KEY ? 'Read the decoded note again: the digit is spelled out.' : 'Not yet. Keep turning the dial until the note is readable.'; bad($('a1')); }
  }
  if (n === 2 && stage === 2) {
    const v = $('a2').value.trim();
    if (/^biscuit2019!?$/i.test(v)) reward(2);
    else { addPen(10, 'access denied'); $('m2').className = 'msg bad'; $('m2').textContent = 'ACCESS DENIED. ' + (/biscuit/i.test(v) ? 'Right name. What about the year Biscuit came home?' : 'Look for something Jordan clearly loves.'); bad($('a2')); }
  }
}
document.querySelectorAll('[data-hint]').forEach(b => b.addEventListener('click', () => { const n = b.dataset.hint; if ($('h' + n).hidden) { addPen(30, 'hint'); $('h' + n).hidden = false; b.disabled = true; } }));

/* ---------- rewards ---------- */
const RW = {
  1: ['Note decrypted', 'Cipher cracked', 'A Caesar cipher only has 25 possible keys, so a computer breaks it instantly. Real encryption has more possible keys than there are atoms in the universe.'],
  2: ['Account compromised', 'You’re in as Jordan', 'Pet name + year: found in two posts. Long random passphrases and a password manager stop this. So does multi-factor authentication.'],
  3: ['Intruder located', 'Gotcha: 203.0.113.66', 'A burst of failed logins then a success is a brute-force attack. Account lockouts and alerts on patterns like this are a defender’s bread and butter.'],
  4: ['Inbox secured', 'Phish caught', 'Urgency, secrecy, look-alike domains and money requests are the classic tells. Phishing is still the number one way attackers get in.']
};
function reward(n) {
  chime();
  $('rwKick').textContent = 'Defence 0' + n + ' cleared · ' + RW[n][0];
  $('rwTitle').textContent = RW[n][1]; $('rwText').textContent = RW[n][2];
  $('rwLbl').textContent = 'VAULT DIGIT ' + n; $('rwDig').textContent = VAULT[n - 1];
  $('rwNext').textContent = n < 4 ? 'Next defence →' : 'Go to the vault →';
  stage = n + 1; pips(); show('reward'); $('rwNext').focus();
}
$('rwNext').addEventListener('click', () => {
  if (stage === 2) { show('s2'); $('a2').focus(); }
  else if (stage === 3) show('s3');
  else if (stage === 4) { mi = 0; renderMail(); $('m4').textContent = ''; show('s4'); }
  else if (stage === 5) { entry = ''; renderSlots(); $('collected').textContent = VAULT.split('').join(' '); show('vault'); }
});

/* ---------- vault ---------- */
let entry = '', vaultBusy = false;
function renderSlots() { [...$('slots').children].forEach((s, i) => s.textContent = entry[i] || ''); }
['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', '⌫'].forEach(k => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'key' + (k.length > 1 ? ' fn' : ''); b.textContent = k;
  if (k === '⌫') b.setAttribute('aria-label', 'Delete'); if (k === 'CLR') b.setAttribute('aria-label', 'Clear');
  b.addEventListener('click', () => press(k)); $('keypad').appendChild(b);
});
function press(k) {
  if (stage !== 5 || vaultBusy) return;
  if (k === 'CLR') entry = ''; else if (k === '⌫') entry = entry.slice(0, -1); else if (entry.length < 4) entry += k;
  renderSlots();
  if (entry.length < 4) return;
  if (entry === VAULT) {
    vaultBusy = true; running = false; finalSecs = Math.round(elapsed()); clearInterval(ticking); $('clock').textContent = fmt(finalSecs);
    $('door').classList.add('open'); $('m5').className = 'msg good'; $('m5').textContent = 'VAULT OPEN'; chime(); setTimeout(chime, 400);
    setTimeout(() => { vaultBusy = false; finish(); }, reduce ? 300 : 1600);
  } else { addPen(10, 'wrong code'); $('m5').className = 'msg bad'; $('m5').textContent = 'WRONG CODE. Enter the digits in the order you collected them.'; bad($('slots')); entry = ''; setTimeout(renderSlots, 300); }
}

/* ---------- finish + leaderboard ---------- */
let posted = false;
async function finish() {
  stage = 6; pips(); show('done');
  $('finalTime').textContent = fmt(finalSecs);
  $('finalBreak').textContent = penalty > 0 ? 'Includes ' + Math.round(penalty) + 's of penalties.' : 'No penalties. Clean run.';
  $('combo').textContent = VAULT.split('').join('-');
  posted = false; $('saveMsg').textContent = ''; $('nameIn').value = ''; $('saveBtn').disabled = false;
  const db = await dbReady;
  $('saveDirect').hidden = !db; $('saveOff').hidden = !!db;
  armIdle();
}
$('saveBtn').addEventListener('click', async () => {
  if (posted) return;
  const db = await dbReady; if (!db) return;
  const name = cleanName($('nameIn').value);
  const m = $('saveMsg');
  if (!name) { m.className = 'msg bad'; m.textContent = 'Type a name first.'; return; }
  if (!isAppropriate(name)) { m.className = 'msg bad'; m.textContent = 'That name can’t go on the big screen. Please pick another.'; return; }
  $('saveBtn').disabled = true; m.className = 'msg info'; m.textContent = 'Posting…';
  const secs = Math.max(25, Math.min(3600, finalSecs));
  try {
    const id = await db.addRun(name, secs, dayKey());
    posted = true;
    let rank = null; try { const rows = await db.listDay(dayKey()); rank = rows.findIndex(r => r.id === id) + 1 || null; } catch (e) {}
    m.className = 'msg good'; m.textContent = 'Posted. Look at the big screen!' + (rank ? ' You’re #' + rank + ' today.' : '');
  } catch (e) {
    m.className = 'msg bad'; m.textContent = 'Couldn’t post your time. Check the connection and try again.'; $('saveBtn').disabled = false;
  }
});
$('nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('saveBtn').click(); });

/* ---------- reset + booth tablet idle (index.html?kiosk) ---------- */
function resetStages() {
  $('shift').value = 0; renderCipher(); ['a1', 'a2'].forEach(id => $(id).value = '');
  ['m1', 'm2', 'm3', 'm4', 'm5'].forEach(id => $(id).textContent = '');
  [1, 2, 3].forEach(n => { $('h' + n).hidden = true; document.querySelector('[data-hint="' + n + '"]').disabled = false; });
  buildLog(); mi = 0; entry = ''; renderSlots(); $('door').classList.remove('open');
}
function reset() { running = false; clearInterval(ticking); stage = 0; $('hud').hidden = true; $('clock').textContent = '0:00'; resetStages(); show('intro'); }
$('againBtn').addEventListener('click', reset);
let idle = null;
function armIdle() { if (!KIOSK) return; clearTimeout(idle); if (stage > 0) idle = setTimeout(reset, stage === 6 ? 60000 : 180000); }
['pointerdown', 'keydown', 'input'].forEach(ev => document.addEventListener(ev, armIdle, { passive: true }));

renderCipher(); buildLog();
