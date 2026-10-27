import { initDb, dayKey, fmt, schoolColor } from './db.js?v=20261027a';

const VAULT = String((window.OV_CONFIG && window.OV_CONFIG.vault) || '73192').replace(/\D/g, '').padEnd(5, '0').slice(0, 5);
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

function ding() { const a = audio(); if (!a) return; const t = a.currentTime; [1319, 1760].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * .07); g.gain.exponentialRampToValueAtTime(0.09, t + i * .07 + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * .07 + .3); o.connect(g).connect(a.destination); o.start(t + i * .07); o.stop(t + i * .07 + .32); }); }
function whoosh() { const a = audio(); if (!a || a.state !== 'running') return; const t = a.currentTime, len = a.sampleRate * .25, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); src.buffer = buf; f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + .25); g.gain.value = 0.05; src.connect(f).connect(g).connect(a.destination); src.start(t); }

/* ---------- flow ---------- */
const screens = [...document.querySelectorAll('#play .screen')];
// Each challenge's brief types itself out, and screens glitch in.
function typeOut(el) {
  if (!el) return; const full = el.dataset.full || el.textContent; el.dataset.full = full; clearInterval(el._t);
  if (reduce) { el.textContent = full; return; }
  let n = 0; el.textContent = ''; el._t = setInterval(() => { n += 3; el.textContent = full.slice(0, n); if (n >= full.length) clearInterval(el._t); }, 16);
}
function show(name) {
  screens.forEach(s => s.hidden = s.dataset.s !== name); window.scrollTo(0, 0);
  const s = screens.find(x => x.dataset.s === name);
  if (s && !reduce) { s.classList.remove('glitch'); void s.offsetWidth; s.classList.add('glitch'); }
  if (s && /^(s\d|bonus)$/.test(name)) { typeOut(s.querySelector('.brief')); whoosh(); }
}
let t0 = 0, penalty = 0, running = false, stage = 0, ticking = null, finalSecs = 0;
let streak = 0, bestStreak = 0, hintsUsed = 0, mistakes = 0, penSecs = 0, bonusSecsWon = 0;
const elapsed = () => (performance.now() - t0) / 1000 + penalty;
function flash(text, cls) { const p = $('pen'); p.className = 'pen ' + (cls || ''); p.textContent = text; clearTimeout(p._t); p._t = setTimeout(() => p.textContent = '', 1800); }
function addPen(s, why) { penalty += s; penSecs += s; streak = 0; showStreak(); if (why === 'hint') hintsUsed++; else mistakes++; flash('+' + s + 's ' + why); }
function addBonus(s, why) { penalty -= s; bonusSecsWon += s; flash('\u2212' + s + 's ' + why, 'plus'); }
function good() { streak++; bestStreak = Math.max(bestStreak, streak); showStreak(); }
function showStreak() { const el = $('streak'); el.textContent = streak >= 2 ? '\u00d7' + streak + ' streak' : ''; el.classList.remove('pop'); void el.offsetWidth; if (streak >= 2) el.classList.add('pop'); }
function pips() { document.querySelectorAll('.pip').forEach(p => { const n = +p.dataset.p; p.classList.toggle('done', n < stage); p.classList.toggle('now', n === stage); }); }
function tick() { if (running) $('clock').textContent = fmt(elapsed()); }
function bad(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); buzz(); }

/* ---------- school battle ---------- */
// Schools come from config.js. A device remembers its pick, except the booth PC/tablet (?kiosk).
const SCHOOLS = ((window.OV_CONFIG && window.OV_CONFIG.schools) || []).map(String).filter(Boolean);
let school = '';
try { if (!KIOSK) school = localStorage.getItem('ov-school') || ''; } catch (e) {}
if (!SCHOOLS.includes(school)) school = '';
function drawSchools() {
  const box = $('schools'); box.textContent = '';
  SCHOOLS.concat(['']).forEach(n => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sch-btn'; b.textContent = n || 'Just visiting';
    b.style.setProperty('--sc', n ? schoolColor(n) : 'var(--muted)'); b.setAttribute('aria-pressed', n === school);
    b.addEventListener('click', () => { school = n; try { if (!KIOSK) localStorage.setItem('ov-school', n); } catch (e) {} drawSchools(); });
    box.appendChild(b);
  });
}
drawSchools();
if (!SCHOOLS.length) $('schools').parentElement.hidden = true;

function start() {
  const typed = cleanName($('codeIn').value);
  if (typed && !isAppropriate(typed)) { $('m0').hidden = false; $('m0').className = 'msg bad'; $('m0').textContent = 'That name can’t go on the big screen. Please pick another.'; bad($('codeIn')); return; }
  $('m0').hidden = true;
  const name = typed || codename();
  $('hudName').textContent = name; $('hud').style.setProperty('--sc', school ? schoolColor(school) : 'var(--amber)');
  audio(); liveStart(name);
  t0 = performance.now(); penalty = 0; running = true; stage = 1;
  streak = 0; bestStreak = 0; hintsUsed = 0; mistakes = 0; penSecs = 0; bonusSecsWon = 0; bonusDone = false; showStreak();
  $('hud').hidden = false; pips(); clearInterval(ticking); ticking = setInterval(tick, 250);
  resetStages(); show('s1'); setTimeout(() => $('shift').focus(), 50);
}
$('startBtn').addEventListener('click', start);
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });

/* ---------- live intruder map (board.html) ---------- */
// While someone plays, one small Firestore doc says which stage they're on.
// The heartbeat keeps the dot on the board; a quiet dot fades after 2 min.
const CODE_A = ['GHOST', 'VIPER', 'RAVEN', 'CIPHER', 'NOVA', 'ROGUE', 'SHADOW', 'BYTE', 'GLITCH', 'ZERO', 'SPECTRE', 'PHANTOM'];
const codename = () => CODE_A[Math.floor(Math.random() * CODE_A.length)] + '-' + (10 + Math.floor(Math.random() * 90));
let liveId = null, liveName = '', liveBeat = null, liveEnd = null;
function liveSet(n) { dbReady.then(db => { if (db && liveId) return db.setLive(liveId, liveName, n, dayKey(), school); }).catch(() => {}); }
function liveStart(name) {
  liveStop(); liveName = name;
  dbReady.then(db => { if (!db) return; liveId = db.newLiveId(); liveSet(1); liveBeat = setInterval(() => { if (running) liveSet(stage); }, 45000); });
}
function liveStop() {
  clearInterval(liveBeat); clearTimeout(liveEnd);
  const id = liveId; liveId = null;
  if (id) dbReady.then(db => db && db.dropLive(id)).catch(() => {});
}
function liveDone() { liveSet(7); clearInterval(liveBeat); clearTimeout(liveEnd); liveEnd = setTimeout(liveStop, 30000); }
addEventListener('pagehide', liveStop);

/* ---------- stage 1: cipher ---------- */
const WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
// A new note and key every game, so the answer can't be passed down the line.
const NOTES = [
  'MEET AT THE DOCK AT MIDNIGHT. THE FIRST VAULT DIGIT IS {D}.',
  'THE GUARD CHANGES AT NINE. FIRST DIGIT OF THE VAULT CODE: {D}.',
  'DELETE THIS AFTER READING. THE VAULT CODE STARTS WITH {D}.',
  'BRING THE USB DRIVE. THE FIRST VAULT DIGIT IS {D}.',
  'THE CAMERAS GO DARK AT TWO. VAULT DIGIT ONE IS {D}.'
];
let KEY = 7, CIPH = '';
const caesar = (s, k) => s.replace(/[A-Z]/g, c => String.fromCharCode((c.charCodeAt(0) - 65 + k + 104) % 26 + 65));
function newCipher() {
  KEY = 3 + Math.floor(Math.random() * 21);
  CIPH = caesar(NOTES[Math.floor(Math.random() * NOTES.length)].replace('{D}', WORDS[+VAULT[0]]), KEY);
  $('h1').textContent = 'Try a shift between ' + (KEY - 2) + ' and ' + (KEY + 2) + '. You’ll know it when real words appear.';
}
// Cipher wheel: outer ring is the scrambled letter, inner ring is what it decodes to.
(function buildWheel() {
  const NS = 'http://www.w3.org/2000/svg', svg = $('wheel'), c = 110;
  const el = (tag, at) => { const e = document.createElementNS(NS, tag); Object.entries(at).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  [104, 78, 52].forEach(r => svg.appendChild(el('circle', { cx: c, cy: c, r, class: 'w-ring' })));
  const ring = (r, cls, id) => { const g = el('g', { class: cls }); if (id) g.id = id; for (let i = 0; i < 26; i++) { const t = el('text', { x: c, y: c - r, transform: 'rotate(' + (i * 360 / 26) + ' ' + c + ' ' + c + ')' }); t.textContent = String.fromCharCode(65 + i); g.appendChild(t); } return g; };
  svg.appendChild(ring(91, 'w-out')); svg.appendChild(ring(65, 'w-in', 'wIn'));
  svg.appendChild(el('path', { d: 'M104 0 L116 0 L110 10 Z', class: 'w-ptr' }));
  const k = el('text', { x: c, y: c + 6, class: 'w-key', id: 'wKey' }); k.textContent = 'KEY 0'; svg.appendChild(k);
})();
function renderCipher() {
  const k = +$('shift').value; $('shiftVal').textContent = k; $('cipherText').textContent = caesar(CIPH, -k);
  $('cipherText').classList.toggle('ok', k === KEY); $('wheel').classList.toggle('ok', k === KEY);
  $('wIn').style.transform = 'rotate(' + (k * 360 / 26) + 'deg)'; $('wKey').textContent = 'KEY ' + k;
}
$('shift').addEventListener('input', renderCipher);
$('shDown').addEventListener('click', () => { $('shift').value = (+$('shift').value + 25) % 26; renderCipher(); });
$('shUp').addEventListener('click', () => { $('shift').value = (+$('shift').value + 1) % 26; renderCipher(); });

/* ---------- stage 2: OSINT ---------- */
// One of these people is picked each game. Add more freely: pass is the
// accepted password, near catches a half-right guess.
const PEOPLE = [
  { name: 'Jordan Reyes', user: 'jreyes', init: 'JR', av: '#C98D4B', cover: '#2E5E8C', role: 'Ops Manager at Lakehead Logistics · Sault Ste. Marie',
    posts: [['2 days ago', 'Biscuit turned 6 today. Best dog in the Soo.'], ['Last week', 'Reminder to self: work password expires Friday. Ugh, again??'], ['March', 'Throwback to the day we brought Biscuit home in 2019. Look at those ears!'], ['January', 'Go Greyhounds! Poutine after the game, obviously.']],
    pass: /^biscuit2019!?$/i, near: /biscuit/i, nearMsg: 'Right name. What about the year Biscuit came home?', far: 'Look for something Jordan clearly loves.',
    hint: 'Jordan’s passwords always follow the same pattern: pet’s name + the year the pet came home.', lesson: 'Pet name + year: found in two posts.' },
  { name: 'Taylor Brooks', user: 'tbrooks', init: 'TB', av: '#5B8C5A', cover: '#8C2E2E', role: 'Dispatch Supervisor at Lakehead Logistics · Sault Ste. Marie',
    posts: [['Yesterday', 'Greyhounds win in overtime!! Best team in the league. I will not be taking questions.'], ['Last week', 'Work made us change passwords AGAIN. At least mine is easy to remember 😎'], ['September', 'Rec hockey starts tonight. Lucky number 17 is back on my jersey.'], ['August', 'Camping at Pancake Bay. No signal, no problem.']],
    pass: /^greyhounds17!?$/i, near: /greyhounds|hounds|17/i, nearMsg: 'Close. Taylor’s password mixes a favourite team and a number.', far: 'Look for what Taylor brags about most.',
    hint: 'Taylor’s passwords are always: favourite team + jersey number.', lesson: 'Favourite team + jersey number: both in public posts.' },
  { name: 'Morgan Lee', user: 'mlee', init: 'ML', av: '#7A5BA6', cover: '#2E7A6C', role: 'Payroll Coordinator at Lakehead Logistics · Sault Ste. Marie',
    posts: [['Today', 'Can’t believe my baby girl Ellie turns 8 today 🎂'], ['Last month', 'Ellie’s first day of grade 3! Where does the time go?'], ['May', 'Spring cleaning turned up Ellie’s hospital bracelet from 2018. Crying.'], ['February', 'Who else is sick of snow? Asking for everyone in the Soo.']],
    pass: /^ellie2018!?$/i, near: /ellie/i, nearMsg: 'Right name. What year was Ellie born?', far: 'Look at who Morgan posts about most.',
    hint: 'Morgan always uses: child’s name + the year they were born.', lesson: 'Child’s name + birth year: pieced together from a few posts.' },
  { name: 'Casey Martin', user: 'cmartin', init: 'CM', av: '#B5563C', cover: '#4A4F8C', role: 'Warehouse Lead at Lakehead Logistics · Sault Ste. Marie',
    posts: [['3 days ago', 'Drove past the big goose on the way home to Wawa. Nothing beats your hometown.'], ['Last week', 'IT says my password is “too simple.” It’s literally where I grew up plus my grad year. Who would guess that?'], ['June', 'Class of 2009 reunion this summer! Wawa represent!'], ['April', 'New forklift certification. Fear me.']],
    pass: /^wawa2009!?$/i, near: /wawa|2009/i, nearMsg: 'Close. One of Casey’s posts gives away the pattern.', far: 'Read Casey’s posts carefully. One gives the pattern away.',
    hint: 'Casey’s password is hometown + high school graduation year.', lesson: 'Hometown + grad year: Casey even posted the pattern.' }
];
let P = PEOPLE[0];
const first = () => P.name.split(' ')[0];
function newPerson() {
  P = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
  $('b2').dataset.full = first() + ' works at Lakehead Logistics. People often build passwords from things they post online. Read ' + first() + '’s profile, then log in as ' + first() + '.';
  $('b4').dataset.full = 'Three messages just landed in ' + first() + '’s inbox. Call each one. Spot a phish, then tap its red flag for a 5-second bonus.';
  $('prof').setAttribute('aria-label', first() + '’s social profile');
  $('pCover').style.background = P.cover; $('pAv').style.background = P.av; $('pAv').textContent = P.init;
  $('pName').textContent = P.name; $('pRole').textContent = P.role; $('u2').value = P.user; $('h2').textContent = P.hint;
  const box = $('pPosts'); box.textContent = '';
  P.posts.forEach(([when, text]) => { const d = document.createElement('div'); d.className = 'post'; const m = document.createElement('div'); m.className = 'meta'; m.textContent = when; d.append(m, text); box.appendChild(d); });
}

/* ---------- stage 3: log ---------- */
// A fresh server log every game: one outside address tries a burst of
// usernames, then gets in a few minutes later. Staff noise and a stray
// failed login from elsewhere make it a hunt.
const STAFF = [['10.0.4.22', 'jreyes'], ['10.0.4.31', 'mchen'], ['10.0.4.17', 'tbrooks'], ['10.0.4.40', 'mlee'], ['10.0.4.12', 'cmartin'], ['10.0.4.55', 'pkhan']];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pickOne = a => a[Math.floor(Math.random() * a.length)];
let LOG = [], LOG_ANS = 0, ATTACKER = '';
function newLog() {
  const nets = ['203.0.113.', '198.51.100.', '192.0.2.'];
  ATTACKER = pickOne(nets) + rnd(10, 250);
  let decoy; do { decoy = pickOne(nets) + rnd(10, 250); } while (decoy === ATTACKER);
  const lines = [], ts = x => [Math.floor(x / 3600), Math.floor(x / 60) % 60, x % 60].map(n => String(n).padStart(2, '0')).join(':');
  let t = rnd(2 * 3600, 3 * 3600);
  shuffle(['admin', 'root', 'backup', 'administrator', 'guest', 'test', 'oracle']).slice(0, rnd(3, 5)).forEach(u => { lines.push([t, ATTACKER, u, 'fail', 'FAILED']); t += rnd(1, 3); });
  lines.push([t + rnd(120, 900), ATTACKER, pickOne(['svc_backup', 'helpdesk', 'admin_old', 'scanner']), 'ok', 'LOGIN']);
  shuffle(STAFF.slice()).slice(0, 3).forEach(([ip, u], i) => {
    const at = rnd(5400, 4 * 3600); lines.push([at, ip, u, 'ok', 'LOGIN']);
    if (i === 0) lines.push([at + rnd(600, 2400), ip, u, 'out', 'LOGOUT']);
    if (i === 1) lines.push([at + rnd(300, 3000), ip, u, 'fail', 'FAILED']);
  });
  lines.push([rnd(5400, 4 * 3600), decoy, pickOne(['admin', 'root']), 'fail', 'FAILED']);
  lines.sort((a, b) => a[0] - b[0]);
  LOG = lines.map(l => [ts(l[0]), l[1], l[2], l[3], l[4]]);
  LOG_ANS = LOG.findIndex(l => l[1] === ATTACKER && l[3] === 'ok');
}
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
  if (i === LOG_ANS) { b.classList.add('right'); good(); setTimeout(() => reward(3), 500); return; }
  b.classList.add('wrong'); addPen(10, 'wrong line'); bad(b);
  const r = LOG[i];
  $('m3').className = 'msg bad';
  $('m3').textContent = r[1] === ATTACKER ? 'That attempt failed. Find the moment they actually got IN.'
    : r[1].startsWith('10.') ? 'That’s an internal address: a staff member on the office network.'
    : r[3] === 'fail' ? 'One failed try from outside isn’t a break-in. Look for a burst of failures, then a success.' : 'Not that one. Look again.';
}

/* ---------- stage 4: phish ---------- */
// Question bank. Each game picks MAIL_PER_GAME messages at random, always
// with at least one phish and one legit. Add or edit entries freely.
// flag is the exact text players tap for the red-flag bonus (in: 'from'
// when it's in the sender line).
// Lakehead Logistics' real domain is lakeheadlogistics.ca. All names,
// companies, numbers and sites here are made up.
const MAIL_PER_GAME = 3;
const MAIL_BANK = [
  // ----- phishing -----
  { ph: true, from: 'SMS · +1 (705) 555-0142', body: 'Lakehead Credit Union: your account is LOCKED. Verify within 1 hour: <span class="lk">lakehead-cu-secure.co/login</span>', why: 'Urgent lock-out plus a link to a look-alike domain.', flag: 'lakehead-cu-secure.co/login' },
  { ph: true, from: 'Dana Morgan, CEO <dana.lakehead.ceo@outlook.com>', body: 'Need you to wire $4,800 to a new vendor today. I’m in meetings, keep this between us. Bank details attached.', why: 'A "CEO" on a personal account, secrecy and a money transfer.', flag: 'dana.lakehead.ceo@outlook.com', in: 'from' },
  { ph: true, from: 'IT Support <it-support@lakeheadlogistlcs.ca>', body: 'Your password expires today. Keep your current password here to avoid losing access: <span class="lk">lakeheadlogistlcs.ca/keep-password</span>', why: 'Look closely: "logistlcs" uses an L instead of an i. Real IT never asks you to type your password into a link.', flag: 'lakeheadlogistlcs.ca/keep-password' },
  { ph: true, from: 'SMS · +1 (249) 555-0198', body: 'NorthPost: your parcel is on hold due to an unpaid $1.99 customs fee. Pay now: <span class="lk">northpost-redelivery.info</span>', why: 'A tiny fee is bait to steal card numbers, and the link isn’t the courier’s site.', flag: 'northpost-redelivery.info' },
  { ph: true, from: 'Payroll <payroll@lakeheadlogistics.ca.hr-portal.net>', body: 'Your pay stub is ready. Sign in to view it before Friday: <span class="lk">lakeheadlogistics.ca.hr-portal.net</span>', why: 'The real domain is the last part before the first slash: hr-portal.net, not lakeheadlogistics.ca.', flag: 'lakeheadlogistics.ca.hr-portal.net' },
  { ph: true, from: 'Canada Benefits Office <refunds@cra-refund-online.com>', body: 'You are owed a tax refund of $612.40. Click to accept by Interac e-Transfer within 24 hours: <span class="lk">cra-refund-online.com/claim</span>', why: 'Government agencies don’t send refunds through an email link, and the deadline is there to rush you.', flag: 'cra-refund-online.com/claim' },
  { ph: true, from: 'Jordan Reyes <jordan.reyes.work@gmail.com>', body: 'Hey, I lost my phone. Can you text me the 6-digit code you’re about to receive? I need it to get back into my account.', why: 'Nobody legit asks for your MFA or verification code. That code is the key to your account.', flag: 'Can you text me the 6-digit code you’re about to receive?' },
  { ph: true, from: 'StreamBox <billing@streambox-accounts.support>', body: 'Your payment failed and your account will be closed today. Update your card: <span class="lk">streambox-accounts.support/update</span>', why: 'Threat of closing your account, plus a link to a strange domain asking for card details.', flag: 'streambox-accounts.support/update' },
  { ph: true, from: 'Shared Files <no-reply@docshare-secure.net>', body: 'Mike Chen shared "Q4 Salaries - CONFIDENTIAL.xlsx" with you. Sign in with your work email and password to open it.', why: 'A juicy file name to make you curious, and a login page outside the company.', flag: 'Sign in with your work email and password to open it.' },
  { ph: true, from: 'Help Desk <helpdesk@lakeheadlogistics.ca>', body: 'Hi, this is Sam from IT. We’re upgrading your laptop tonight. Reply with your username and password so we can set it up.', why: 'Even from a real address (accounts get hacked), no IT team ever needs your password.', flag: 'Reply with your username and password' },
  { ph: true, from: 'SMS · +1 (705) 555-0177', body: 'Congrats! You’ve been selected for a $500 Gift Card from SooMart. Claim before midnight: <span class="lk">soomart-winner.club</span>', why: 'A prize you never entered for, a deadline and an odd link.', flag: 'soomart-winner.club' },
  { ph: true, from: 'Accounts Payable <ap@lakehead-logistics.ca>', body: 'Our banking details have changed. Please send all future invoice payments to the new account below, effective today.', why: 'Note the extra hyphen: lakehead-logistics.ca isn’t the real domain. Changed bank details should always be confirmed by phone.', flag: 'lakehead-logistics.ca', in: 'from' },

  // ----- legit -----
  { ph: false, from: 'Facilities <facilities@lakeheadlogistics.ca>', body: 'Heads up: fire drill Thursday at 10 a.m. Please use the east stairwell. No action needed.', why: 'Real company domain, no link, nothing asked of you.' },
  { ph: false, from: 'HR <hr@lakeheadlogistics.ca>', body: 'Benefits enrolment opens Monday. Sign in to the HR portal from the intranet as usual. There’s no link in this email on purpose.', why: 'Real domain, and it tells you to go to the site the way you normally do instead of clicking.' },
  { ph: false, from: 'IT Support <it@lakeheadlogistics.ca>', body: 'Your verification code is 482193. Lakehead Logistics will never ask you for this code. If you didn’t request it, tell IT.', why: 'A code you asked for, with a warning not to share it. Just don’t give the code to anyone.' },
  { ph: false, from: 'Your bank (in-app notification)', body: 'New sign-in on a new device near Sault Ste. Marie, ON at 9:14 a.m. If this wasn’t you, open the app and choose Security › Sign out everywhere.', why: 'No link, nothing to type in, and it tells you to use the app yourself.' },
  { ph: false, from: 'Mike Chen <mchen@lakeheadlogistics.ca>', body: 'Thanks for covering my shift Friday! Coffee’s on me next week.', why: 'A coworker on the real domain, nothing asked of you, no links or attachments.' },
  { ph: false, from: 'Library <library@saultcollege.ca>', body: 'Reminder: Network+ Guide to Networks is due back on Friday. Renew it by signing in to your library account the usual way.', why: 'Real college domain, no link, no pressure, no request for a password.' },
  { ph: false, from: 'Reception <reception@lakeheadlogistics.ca>', body: 'Your visitor (Pat from NorthPost) has arrived at the front desk.', why: 'A simple notice from the real domain that asks you to do nothing risky.' },
  { ph: false, from: 'Payroll <payroll@lakeheadlogistics.ca>', body: 'Reminder: T4 slips will be available in the payroll system by the end of February. Questions? Call payroll at extension 2210.', why: 'Real domain, no link, and it offers a phone number you already know to check.' }
];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pickMail() {
  const ph = shuffle(MAIL_BANK.filter(m => m.ph)), ok = shuffle(MAIL_BANK.filter(m => !m.ph));
  const pick = [ph[0], ok[0]];
  shuffle(ph.slice(1).concat(ok.slice(1))).slice(0, MAIL_PER_GAME - 2).forEach(m => pick.push(m));
  return shuffle(pick);
}
let MAIL = pickMail();
let mi = 0, mailLock = false, hunting = false, huntT = null, flagsFound = 0, phishRight = 0;
function renderMail() {
  const m = MAIL[mi]; $('p4').textContent = 'Message ' + (mi + 1) + ' of ' + MAIL.length;
  const box = $('mail'); box.textContent = ''; box.classList.remove('hunt');
  const f = document.createElement('div'); f.className = 'from'; const b = document.createElement('div');
  const from = 'From: ' + m.from;
  if (m.ph && m.in === 'from') { const k = from.indexOf(m.flag), rf = document.createElement('span'); rf.className = 'rf'; rf.textContent = m.flag; f.append(from.slice(0, k), rf, from.slice(k + m.flag.length)); }
  else f.textContent = from;
  b.innerHTML = m.ph && m.in !== 'from' ? m.body.replace(m.flag, '<span class="rf">' + m.flag + '</span>') : m.body;
  box.append(f, b);
}
function nextMail(ms) { setTimeout(() => { mailLock = false; mi++; if (mi >= MAIL.length) reward(4); else { renderMail(); $('m4').textContent = ''; } }, ms); }
document.querySelectorAll('[data-ph]').forEach(btn => btn.addEventListener('click', () => {
  if (stage !== 4 || mailLock) return;
  const m = MAIL[mi], ok = (btn.dataset.ph === '1') === m.ph;
  mailLock = true;
  if (ok) { phishRight++; good(); } else { addPen(10, 'wrong call'); bad($('mail')); }
  if (ok && m.ph) {
    // Bonus: find the exact red flag before the timer runs out.
    hunting = true; $('mail').classList.add('hunt');
    $('m4').className = 'msg info'; $('m4').textContent = 'Correct, it’s phishing! BONUS: tap the red flag in the message for \u22125s.';
    huntT = setTimeout(() => endHunt(false, true), 6000);
    return;
  }
  $('m4').className = 'msg ' + (ok ? 'good' : 'bad');
  $('m4').textContent = (ok ? 'Correct. ' : 'Wrong, +10s. ') + (m.ph ? 'Phishing: ' : 'Legit: ') + m.why;
  if (m.ph) $('mail').querySelector('.rf').classList.add('show');
  nextMail(ok ? 1300 : 2600);
}));
function endHunt(found, timeout) {
  if (!hunting) return; hunting = false; clearTimeout(huntT); $('mail').classList.remove('hunt');
  $('mail').querySelector('.rf').classList.add(found ? 'got' : 'show');
  if (found) { flagsFound++; addBonus(5, 'red flag'); good(); ding(); }
  $('m4').className = 'msg ' + (found ? 'good' : 'info');
  $('m4').textContent = (found ? 'Red flag found, \u22125s! ' : timeout ? 'Bonus time’s up. ' : 'Not quite, it’s highlighted now. ') + MAIL[mi].why;
  nextMail(found ? 1900 : 2800);
}
$('mail').addEventListener('click', e => { if (hunting) endHunt(!!e.target.closest('.rf')); });

/* ---------- stage 5: door code (Python) ---------- */
// The door controller is a short Python program with its lines scrambled.
// Players tap them into order and press RUN. A tiny interpreter runs the
// order they chose, so a wrong order gives a real error or wrong output.
// Each template's numbers are worked out so the right program prints the
// fifth vault digit. Lines: [text, indent, step], where step does the work.
class PyError extends Error { constructor(type, msg, line) { super(msg); this.type = type; this.line = line; } }
const pyStr = v => Array.isArray(v) ? '[' + v.map(pyStr).join(', ') + ']' : v === undefined ? 'None' : String(v);
const range = n => [...Array(n).keys()];
const CODE_TEMPLATES = [
  d => { // countdown loop
    const n = rnd(2, 4), s = rnd(2, 5), a = d + n * s;
    return { name: 'countdown', hint: 'Set up both variables first. The loop runs the indented line under it. Print comes last.', lines: [
      ['step = ' + s, 0, { set: 'step', f: e => s }],
      ['code = ' + a, 0, { set: 'code', f: e => a }],
      ['for i in range(' + n + '):', 0, { for: 'i', it: e => range(n) }],
      ['code = code - step', 4, { set: 'code', f: e => e.code - e.step }],
      ['print("Override digit:", code)', 0, { print: e => ['Override digit:', e.code] }]] };
  },
  d => { // add up a list
    let k; do { k = [rnd(2, 9), rnd(2, 9), rnd(2, 9)]; } while (k[0] + k[1] + k[2] - d < 1);
    const m = k[0] + k[1] + k[2] - d;
    return { name: 'keys', hint: 'Make the list and the total before the loop. The indented line adds each key to the total.', lines: [
      ['keys = [' + k.join(', ') + ']', 0, { set: 'keys', f: e => k.slice() }],
      ['total = 0', 0, { set: 'total', f: e => 0 }],
      ['for key in keys:', 0, { for: 'key', it: e => e.keys }],
      ['total = total + key', 4, { set: 'total', f: e => e.total + e.key }],
      ['print("Override digit:", total - ' + m + ')', 0, { print: e => ['Override digit:', e.total - m] }]] };
  },
  d => { // a function
    let x, k; do { x = rnd(2, 5); k = rnd(2, 4); } while (x * k - d < 1);
    const j = x * k - d;
    return { name: 'function', hint: 'A function is defined first (def), with its return line indented under it. Then call it and print the result.', lines: [
      ['def unlock(power):', 0, { def: 'unlock', params: ['power'] }],
      ['return power * ' + k + ' - ' + j, 4, { ret: e => e.power * k - j }],
      ['level = ' + x, 0, { set: 'level', f: e => x }],
      ['digit = unlock(level)', 0, { set: 'digit', f: e => e.unlock(e.level) }],
      ['print("Override digit:", digit)', 0, { print: e => ['Override digit:', e.digit] }]] };
  },
  d => { // if / else
    const hot = Math.random() < .5, t = hot ? rnd(61, 95) : rnd(20, 59);
    let other; do { other = rnd(0, 9); } while (other === d);
    const a = hot ? d : other, b = hot ? other : d;
    return { name: 'alarm', hint: 'Set the temperature first. The comments after # say which digit line belongs under the if (over 60) and which under the else. The else goes straight after the if’s indented line.', lines: [
      ['temp = ' + t, 0, { set: 'temp', f: e => t }],
      ['if temp > 60:', 0, { if: e => e.temp > 60 }],
      ['digit = ' + a + '  # too hot: over 60', 4, { set: 'digit', f: e => a }],
      ['else:', 0, { else: true }],
      ['digit = ' + b + '  # normal: 60 or less', 4, { set: 'digit', f: e => b }],
      ['print("Override digit:", digit)', 0, { print: e => ['Override digit:', e.digit] }]] };
  },
  d => { // string length
    const word = pickOne(['FIREWALL', 'PASSWORD', 'KEYLOGGER', 'ENCRYPTION', 'BACKDOOR', 'AUTHENTICATION', 'CYBERSECURITY'].filter(w => w.length > d));
    const s = word.length - d;
    return { name: 'word', hint: 'Create word and shift first, then count the letters, then work out the digit, then print it.', lines: [
      ['word = "' + word + '"', 0, { set: 'word', f: e => word }],
      ['shift = ' + s, 0, { set: 'shift', f: e => s }],
      ['letters = len(word)', 0, { set: 'letters', f: e => e.word.length }],
      ['digit = letters - shift', 0, { set: 'digit', f: e => e.letters - e.shift }],
      ['print("Override digit:", digit)', 0, { print: e => ['Override digit:', e.digit] }]] };
  }
];
// Turn the chosen order into blocks using indentation, the way Python does.
function pyParse(lines) {
  const root = { ind: 0, body: [] }, stack = [root]; let open = null;
  lines.forEach((L, i) => {
    const no = i + 1, ind = L[1], s = L[2];
    if (open) {
      if (ind <= open.ind) throw new PyError('IndentationError', 'expected an indented block after line ' + open.no, no);
      stack.push({ ind, body: open.body }); open = null;
    } else {
      if (ind > stack[stack.length - 1].ind) throw new PyError('IndentationError', 'unexpected indent', no);
      while (ind < stack[stack.length - 1].ind) stack.pop();
    }
    const body = stack[stack.length - 1].body;
    if (s.else) {
      const prev = body[body.length - 1];
      if (!prev || !prev.if || prev.elseBody) throw new PyError('SyntaxError', 'invalid syntax (else without a matching if)', no);
      prev.elseBody = []; open = { ind, body: prev.elseBody, no }; return;
    }
    const node = { ...s, no, body: [] }; body.push(node);
    if (s.for || s.if || s.def) open = { ind, body: node.body, no };
  });
  if (open) throw new PyError('IndentationError', 'expected an indented block after line ' + open.no, lines.length);
  return root.body;
}
function pyRun(lines) {
  const out = [], tree = pyParse(lines); let steps = 0;
  const scope = vars => new Proxy(vars, { get(t, k) { if (typeof k === 'symbol' || k in t) return t[k]; throw new PyError('NameError', 'name \'' + k + '\' is not defined'); } });
  class Ret { constructor(v) { this.v = v; } }
  function exec(body, vars, inDef) {
    for (const n of body) {
      if (++steps > 500) throw new PyError('RuntimeError', 'too many steps');
      try {
        if (n.set) vars[n.set] = n.f(scope(vars));
        else if (n.print) out.push(n.print(scope(vars)).map(pyStr).join(' '));
        else if (n.for) { for (const x of n.it(scope(vars))) { vars[n.for] = x; exec(n.body, vars, inDef); } }
        else if (n.if) exec(n.if(scope(vars)) ? n.body : n.elseBody || [], vars, inDef);
        else if (n.def) vars[n.def] = (...args) => { const local = Object.assign(Object.create(null), vars); n.params.forEach((p, i) => local[p] = args[i]); try { exec(n.body, local, true); } catch (r) { if (r instanceof Ret) return r.v; throw r; } };
        else if (n.ret) { if (!inDef) throw new PyError('SyntaxError', '\'return\' outside function'); throw new Ret(n.ret(scope(vars))); }
      } catch (e) { if (e instanceof PyError && !e.line) e.line = n.no; throw e; }
    }
  }
  exec(tree, Object.create(null), false);
  return out;
}
let PROG = null, codeOrder = [], codePool = [], codeExpect = '', codeRuns = 0, codeBusy = false;
function newCode() {
  const t = pickOne(CODE_TEMPLATES)(+VAULT[4]);
  PROG = t; codeExpect = pyRun(t.lines).join('\n'); codeOrder = []; codeRuns = 0; codeBusy = false;
  do { codePool = shuffle(t.lines.slice()); } while (codePool.every((l, i) => l === t.lines[i]));
  $('h4c').textContent = t.hint; $('console').textContent = ''; $('console').hidden = true; $('m5c').textContent = '';
  renderCode();
}
function codeLine(l, i) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cl';
  const no = document.createElement('span'); no.className = 'no'; no.textContent = i == null ? '' : i + 1;
  const tx = document.createElement('span'); tx.className = 'tx'; const k = l[0].indexOf('  #');
  tx.textContent = ' '.repeat(l[1]) + (k < 0 ? l[0] : l[0].slice(0, k));
  if (k >= 0) { const cm = document.createElement('span'); cm.className = 'cm'; cm.textContent = l[0].slice(k); tx.appendChild(cm); }
  b.append(no, tx); return b;
}
function renderCode() {
  const prog = $('prog'), pool = $('pool'); prog.textContent = ''; pool.textContent = '';
  codeOrder.forEach((l, i) => { const b = codeLine(l, i); b.setAttribute('aria-label', 'Line ' + (i + 1) + ': ' + l[0] + '. Tap to remove.'); b.addEventListener('click', () => { if (codeBusy) return; codeOrder.splice(i, 1); codePool.push(l); renderCode(); }); prog.appendChild(b); });
  if (!codeOrder.length) { const p = document.createElement('div'); p.className = 'cl-empty'; p.textContent = 'Tap lines below to build the program.'; prog.appendChild(p); }
  codePool.forEach((l, i) => { const b = codeLine(l, null); b.setAttribute('aria-label', 'Add line: ' + l[0]); b.addEventListener('click', () => { if (codeBusy) return; codePool.splice(i, 1); codeOrder.push(l); renderCode(); }); pool.appendChild(b); });
  $('pool').hidden = !codePool.length; $('runBtn').disabled = codePool.length > 0 || codeBusy;
}
const CODE_HELP = {
  NameError: v => 'A line uses ' + v + ' before it exists. Move the line that creates it higher.',
  IndentationError: () => 'Indented lines must sit right under a line ending in a colon (:), and every such line needs one.',
  SyntaxError: () => 'That line can’t go there. An else must come right after its if block, and return only works inside a def.',
  RuntimeError: () => 'Something went round and round. Check the order.'
};
function typeConsole(lines, done) {
  const box = $('console'); box.hidden = false; box.textContent = '';
  let i = 0; const next = () => {
    if (i >= lines.length) return done();
    const [text, cls] = lines[i++], row = document.createElement('div'); if (cls) row.className = cls; row.textContent = text; box.appendChild(row);
    setTimeout(next, reduce ? 0 : 260);
  };
  next();
}
$('runBtn').addEventListener('click', () => {
  if (stage !== 5 || codeBusy || codePool.length) return;
  codeBusy = true; codeRuns++; renderCode(); $('m5c').textContent = '';
  let out = null, err = null;
  try { out = pyRun(codeOrder); } catch (e) { if (e instanceof PyError) err = e; else throw e; }
  const lines = [['$ python3 door.py', 'cmd']];
  if (err) lines.push(['Traceback (most recent call last):', 'err'], ['  File "door.py", line ' + err.line, 'err'], [err.type + ': ' + err.message, 'err']);
  else out.forEach(o => lines.push([o, '']));
  const ok = !err && out.join('\n') === codeExpect;
  if (ok) lines.push(['>>> DOOR OVERRIDE ACCEPTED', 'okl']);
  else if (!err) lines.push(['>>> OVERRIDE REJECTED: wrong digit', 'err']);
  typeConsole(lines, () => {
    codeBusy = false;
    if (ok) { good(); $('m5c').className = 'msg good'; $('m5c').textContent = 'It runs! Door override accepted.'; setTimeout(() => reward(5), 1200); return; }
    addPen(10, 'bug'); bad($('console'));
    const m = err && err.type === 'NameError' && err.message.match(/'(\w+)'/);
    $('m5c').className = 'msg bad';
    $('m5c').textContent = err ? (CODE_HELP[err.type] || CODE_HELP.RuntimeError)(m ? m[1] : '') : 'It ran, but printed the wrong thing. Programs run top to bottom, so check the order of the steps.';
    renderCode();
  });
});
$('codeReset').addEventListener('click', () => { if (codeBusy) return; codePool = shuffle(codePool.concat(codeOrder)); codeOrder = []; renderCode(); });

/* ---------- answers + hints ---------- */
document.querySelectorAll('[data-submit]').forEach(b => b.addEventListener('click', () => submit(+b.dataset.submit)));
['a1', 'a2'].forEach((id, i) => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') submit(i + 1); }));
function submit(n) {
  if (n === 1 && stage === 1) {
    const v = $('a1').value.trim().toUpperCase();
    if (v === VAULT[0] || v === WORDS[+VAULT[0]]) { good(); reward(1); }
    else { addPen(10, 'wrong answer'); $('m1').className = 'msg bad'; $('m1').textContent = +$('shift').value === KEY ? 'Read the decoded note again: the digit is spelled out.' : 'Not yet. Keep turning the dial until the note is readable.'; bad($('a1')); }
  }
  if (n === 2 && stage === 2) {
    const v = $('a2').value.trim();
    if (P.pass.test(v)) { good(); reward(2); }
    else { addPen(10, 'access denied'); $('m2').className = 'msg bad'; $('m2').textContent = 'ACCESS DENIED. ' + (P.near.test(v) ? P.nearMsg : P.far); bad($('a2')); }
  }
}
document.querySelectorAll('[data-hint]').forEach(b => b.addEventListener('click', () => { const n = b.dataset.hint; if ($('h' + n).hidden) { addPen(30, 'hint'); $('h' + n).hidden = false; b.disabled = true; } }));

/* ---------- rewards ---------- */
const JOBS = {
  1: ['Cryptographer', 'Designs the encryption that protects online banking, messaging apps and every “https” website.'],
  2: ['Penetration tester', 'Gets paid to break into companies, just like you did, then shows them how to fix the holes.'],
  3: ['SOC analyst', 'Works in a Security Operations Centre, watching logs and alerts to catch attackers in real time.'],
  4: ['Security awareness lead', 'Teaches staff to spot scams and runs fake phishing tests to see who clicks.'],
  5: ['Software developer', 'Writes the code behind apps, games and websites, then tracks down the bugs. It’s what Sault College’s Computer Programming program trains you for.']
};
function rw(n) {
  return {
    1: ['Note decrypted', 'Cipher cracked', 'A Caesar cipher only has 25 possible keys, so a computer breaks it instantly. Real encryption has more possible keys than there are atoms in the universe.'],
    2: ['Account compromised', 'You’re in as ' + first(), P.lesson + ' Long random passphrases and a password manager stop this. So does multi-factor authentication.'],
    3: ['Intruder located', 'Gotcha: ' + ATTACKER, 'A burst of failed logins then a success is a brute-force attack. Account lockouts and alerts on patterns like this are a defender’s bread and butter.'],
    4: ['Inbox secured', 'Phish caught', 'Urgency, secrecy, look-alike domains and money requests are the classic tells. Phishing is still the number one way attackers get in.'],
    5: ['Door code fixed', 'Override accepted', 'Code runs one line at a time, top to bottom. Put the steps in the wrong order and the computer does exactly what you said, not what you meant. Finding that is called debugging.']
  }[n];
}
function reward(n) {
  chime(); const r = rw(n);
  $('rwKick').textContent = 'Defence 0' + n + ' cleared · ' + r[0];
  $('rwTitle').textContent = r[1]; $('rwText').textContent = r[2];
  $('rwJob').textContent = JOBS[n][0]; $('rwJobText').textContent = JOBS[n][1];
  $('rwLbl').textContent = 'VAULT DIGIT ' + n; $('rwDig').textContent = VAULT[n - 1];
  $('rwNext').textContent = n < 5 ? 'Next defence →' : 'Go to the vault →';
  stage = n + 1; pips(); liveSet(stage); show('reward'); $('rwNext').focus();
}
$('rwNext').addEventListener('click', () => {
  if (stage === 2) { show('s2'); $('a2').focus(); }
  else if (stage === 3) show('s3');
  else if (stage === 4) { MAIL = pickMail(); mi = 0; flagsFound = 0; phishRight = 0; renderMail(); $('m4').textContent = ''; show('s4'); }
  else if (stage === 5) { show('s5'); }
  else if (stage === 6) { entry = ''; renderSlots(); $('collected').textContent = VAULT.split('').join(' '); show('vault'); }
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
  if (stage !== 6 || vaultBusy) return;
  if (k === 'CLR') entry = ''; else if (k === '⌫') entry = entry.slice(0, -1); else if (entry.length < VAULT.length) entry += k;
  renderSlots();
  if (entry.length < VAULT.length) return;
  if (entry === VAULT) {
    good(); vaultBusy = true; running = false; liveDone(); finalSecs = Math.round(elapsed()); clearInterval(ticking); $('clock').textContent = fmt(finalSecs);
    $('door').classList.add('open'); $('m5').className = 'msg good'; $('m5').textContent = 'VAULT OPEN'; chime(); setTimeout(chime, 400);
    setTimeout(() => { vaultBusy = false; finish(); }, reduce ? 300 : 1600);
  } else { addPen(10, 'wrong code'); $('m5').className = 'msg bad'; $('m5').textContent = 'WRONG CODE. Enter the digits in the order you collected them.'; bad($('slots')); entry = ''; setTimeout(renderSlots, 300); }
}

/* ---------- ranks + badges ---------- */
const RANKS = [[90, 'Red Team Lead'], [120, 'Penetration Tester'], [150, 'Threat Hunter'], [210, 'Security Analyst'], [330, 'Junior Analyst'], [Infinity, 'Script Kiddie']];
const rankOf = x => RANKS.find(r => x <= r[0])[1];
// The "line to beat" from config.js, e.g. { name: 'Mr. Laitinen', time: '2:41' }.
const INSTR = (() => { const i = (window.OV_CONFIG && window.OV_CONFIG.instructor) || {}, m = String(i.time || '').match(/^(\d+):(\d\d)$/); return m ? { name: String(i.name || 'Instructor'), secs: +m[1] * 60 + +m[2] } : null; })();
let badgeList = [], bonusDone = false, bonusSecs = 0;
function renderBadges() {
  const b = [];
  if (!mistakes && !hintsUsed) b.push('Flawless'); else if (!hintsUsed) b.push('No hints');
  if (phishRight === MAIL.length && flagsFound === MAIL.filter(m => m.ph).length) b.push('Phish spotter');
  if (finalSecs < 90) b.push('Under 1:30');
  if (codeRuns === 1) b.push('Bug free');
  if (bestStreak >= 5) b.push('On a roll');
  if (INSTR && finalSecs < INSTR.secs) b.push('Beat ' + INSTR.name);
  if (bonusDone) b.push('Hash cracker');
  badgeList = b;
  const box = $('badges'); box.textContent = '';
  b.forEach(t => { const s = document.createElement('span'); s.className = 'badge'; s.textContent = t; box.appendChild(s); });
  box.hidden = !b.length;
}

/* ---------- finish + leaderboard ---------- */
let posted = false, postedId = null;
async function finish() {
  stage = 7; pips(); show('done');
  $('finalTime').textContent = fmt(finalSecs);
  $('finalBreak').textContent = (penSecs ? 'Includes ' + penSecs + 's of penalties' : 'No penalties. Clean run') + (bonusSecsWon ? (penSecs ? ' and ' : '. Plus ') + bonusSecsWon + 's of red-flag bonuses.' : '.');
  $('combo').textContent = VAULT.split('').join('-');
  $('rankT').textContent = rankOf(finalSecs).toUpperCase(); renderBadges();
  $('profLine').hidden = !INSTR;
  if (INSTR) $('profLine').textContent = finalSecs < INSTR.secs ? '★ You beat ' + INSTR.name + '’s time of ' + fmt(INSTR.secs) + '!' : INSTR.name + ' did it in ' + fmt(INSTR.secs) + '. ' + (finalSecs - INSTR.secs) + ' seconds to go. Play again?';
  $('bonusCard').hidden = !bonusOK; $('bonusGo').disabled = false; $('bonusGo').textContent = 'Start the bonus round →';
  posted = false; postedId = null; $('saveMsg').textContent = ''; $('nameIn').value = liveName; $('saveBtn').disabled = false;
  posterReset(); $('wantedCard').hidden = KIOSK;
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
    const extra = {}; if (school) extra.school = school; if (bonusDone) extra.bonus = true;
    const id = await db.addRun(name, secs, dayKey(), extra);
    posted = true; postedId = id;
    let rank = null; try { const rows = await db.listDay(dayKey()); rank = rows.findIndex(r => r.id === id) + 1 || null; } catch (e) {}
    m.className = 'msg good'; m.textContent = 'Posted. Look at the big screen!' + (rank ? ' You’re #' + rank + ' today.' : '');
  } catch (e) {
    m.className = 'msg bad'; m.textContent = 'Couldn’t post your time. Check the connection and try again.'; $('saveBtn').disabled = false;
  }
});
$('nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('saveBtn').click(); });

/* ---------- bonus round: crack the hash ---------- */
// A dictionary attack: hash words from a leaked list until one matches the
// stolen hash. The clue narrows it to two words; the rest cost 5s each.
const HASH_OK = ['dragon12', 'sunshin3', 'monkey99', 'hockey22', 'qwerty12', 'soccer10', 'pass1234', 'summer24'];
const HASH_NO = ['password', '123456', 'letmein', 'iloveyou', 'football', 'welcome1!', 'trustno1x', 'princess', 'baseball1', 'master123', 'shadow', 'sunshine'];
const bonusOK = !!(window.crypto && crypto.subtle && window.TextEncoder);
const sha256 = async w => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(w)))].map(x => x.toString(16).padStart(2, '0')).join('');
let bT0 = 0, bPenalty = 0, bTick = null, bTarget = '', bLive = false;
const bElapsed = () => (performance.now() - bT0) / 1000 + bPenalty;
async function startBonus() {
  const ok = shuffle(HASH_OK.slice()).slice(0, 2), list = shuffle(ok.concat(shuffle(HASH_NO.slice()).slice(0, 8)));
  bTarget = await sha256(ok[0]);
  $('hTarget').textContent = bTarget.slice(0, 28) + '…'; $('m6').textContent = ''; $('bPen').textContent = '';
  const box = $('words'); box.textContent = '';
  list.forEach(w => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'word';
    const a = document.createElement('span'); a.className = 'w'; a.textContent = w;
    const h = document.createElement('span'); h.className = 'h'; h.textContent = 'tap to hash';
    b.append(a, h); b.addEventListener('click', () => tryWord(b, w, h)); box.appendChild(b);
  });
  bT0 = performance.now(); bPenalty = 0; bLive = true; clearInterval(bTick);
  bTick = setInterval(() => { if (bLive) $('bClock').textContent = fmt(bElapsed()); }, 250);
  show('bonus');
}
async function tryWord(b, w, h) {
  if (!bLive || b.disabled) return; b.disabled = true;
  const x = await sha256(w); h.textContent = x.slice(0, 28) + '…';
  if (x !== bTarget) {
    b.classList.add('wrong'); bPenalty += 5; buzz();
    const p = $('bPen'); p.textContent = '+5s'; clearTimeout(p._t); p._t = setTimeout(() => p.textContent = '', 1200);
    $('m6').className = 'msg bad'; $('m6').textContent = (w.length !== 8 || !/\d/.test(w)) ? '“' + w + '” breaks the password rules. Check the clue!' : 'Hashes don’t match. Try another.';
    return;
  }
  b.classList.add('right'); bLive = false; clearInterval(bTick); bonusSecs = Math.round(bElapsed()); $('bClock').textContent = fmt(bonusSecs);
  bonusDone = true; chime(); renderBadges();
  if (posted && postedId) dbReady.then(db => db && db.markBonus(postedId)).catch(() => {});
  $('m6').className = 'msg good'; $('m6').textContent = 'CRACKED in ' + fmt(bonusSecs) + '! The password was “' + w + '”. That’s a dictionary attack, and it’s why your password should never be a common word plus a number.';
  $('bonusGo').disabled = true; $('bonusGo').textContent = '★ Cracked in ' + fmt(bonusSecs);
  $('m6').scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  if (posterUrl) makePoster();
}
$('bonusGo').addEventListener('click', () => { audio(); startBonus(); });
$('bonusBack').addEventListener('click', () => { bLive = false; clearInterval(bTick); show('done'); });

/* ---------- wanted poster ---------- */
// Drawn on the player's own phone. The photo never leaves the device.
const PROGRAM_URL = 'https://www.saultcollege.ca/programs/categories/information-technology-studies';
let posterPhoto = null, posterBlob = null, posterUrl = '', caseNo = '';
const posterName = () => { const n = cleanName($('nameIn').value); return n && isAppropriate(n) ? n : liveName || 'Unknown hacker'; };
const caption = () => 'I cracked the vault in ' + fmt(finalSecs) + ' (rank: ' + rankOf(finalSecs) + ')' + (school ? ' for ' + school : '') + ' at the Sault College Cyber Security booth. Think you can catch me? ' + PROGRAM_URL;
async function posterFonts() {
  const want = ['400 100px Anton', '700 30px "JetBrains Mono"', '400 30px "JetBrains Mono"', '700 40px "IBM Plex Sans"'];
  try { await Promise.race([Promise.all(want.map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
}
function drawPoster() {
  const W = 1080, H = 1350, INK = '#1B1A17', PAPER = '#EADFC4', RED = '#A8241B';
  const MONO = '"JetBrains Mono", monospace', ANTON = 'Anton, Impact, sans-serif', PLEX = '"IBM Plex Sans", sans-serif';
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  // aged paper
  c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
  const vg = c.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .78); vg.addColorStop(0, 'rgba(120,90,40,0)'); vg.addColorStop(1, 'rgba(120,90,40,.38)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 2200; i++) { c.fillStyle = 'rgba(60,40,20,' + (Math.random() * .09).toFixed(3) + ')'; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  c.strokeStyle = INK; c.lineWidth = 6; c.strokeRect(28, 28, W - 56, H - 56); c.lineWidth = 2; c.strokeRect(42, 42, W - 84, H - 84);
  // headline
  c.textAlign = 'center'; c.fillStyle = INK;
  c.font = '400 220px ' + ANTON; c.fillText('WANTED', W / 2, 250);
  c.font = '700 30px ' + MONO; const sub = 'FOR BREAKING INTO THE VAULT', sw = c.measureText(sub).width;
  c.fillText(sub, W / 2, 300); c.lineWidth = 3; c.beginPath(); c.moveTo(80, 290); c.lineTo(W / 2 - sw / 2 - 20, 290); c.moveTo(W / 2 + sw / 2 + 20, 290); c.lineTo(W - 80, 290); c.stroke();
  // mugshot height chart
  const PX = 150, PY = 330, PW = 780, PH = 430, BX = 305, BW = 470;
  c.fillStyle = '#D6CAAB'; c.fillRect(PX, PY, PW, PH);
  c.strokeStyle = 'rgba(27,26,23,.45)'; c.fillStyle = 'rgba(27,26,23,.65)'; c.lineWidth = 2; c.font = '700 18px ' + MONO;
  for (let i = 0; i <= 10; i++) {
    const y = PY + 34 + i * 38, inch = 78 - i * 3, lab = Math.floor(inch / 12) + '′' + (inch % 12) + '″';
    c.beginPath(); c.moveTo(PX, y); c.lineTo(PX + PW, y); c.stroke();
    c.textAlign = 'left'; c.fillText(lab, PX + 10, y - 6); c.textAlign = 'right'; c.fillText(lab, PX + PW - 10, y - 6);
  }
  if (posterPhoto) {
    const iw = posterPhoto.naturalWidth, ih = posterPhoto.naturalHeight, s = Math.max(BW / iw, PH / ih), dw = iw * s, dh = ih * s;
    c.save(); c.beginPath(); c.rect(BX, PY, BW, PH); c.clip(); c.drawImage(posterPhoto, BX + (BW - dw) / 2, PY + (PH - dh) * .35, dw, dh); c.restore();
    // old-photo look: sepia with a little extra contrast
    const img = c.getImageData(BX, PY, BW, PH), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11 - 128) * 1.15 + 128; d[i] = l + 12; d[i + 1] = l * .96 + 4; d[i + 2] = l * .82; }
    c.putImageData(img, BX, PY);
    c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(BX, PY, BW, PH);
  } else {
    c.fillStyle = '#2B2924';
    c.beginPath(); c.ellipse(W / 2, PY + PH + 30, 200, 200, 0, Math.PI, 0); c.fill();
    c.beginPath(); c.arc(W / 2, PY + 165, 90, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#D6CAAB'; c.textAlign = 'center'; c.font = '400 130px ' + ANTON; c.fillText('?', W / 2, PY + 212);
  }
  c.strokeStyle = INK; c.lineWidth = 6; c.strokeRect(PX, PY, PW, PH);
  // booking placard
  c.fillStyle = INK; c.fillRect(W / 2 - 230, PY + PH - 40, 460, 66);
  c.fillStyle = PAPER; c.textAlign = 'center'; c.font = '700 26px ' + MONO; c.fillText('CASE OV-' + caseNo + ' · ' + dayKey(), W / 2, PY + PH + 3);
  // name, time, rank, badges, last seen
  const nm = posterName().toUpperCase(); let fs = 120;
  c.fillStyle = INK; do { c.font = '400 ' + fs + 'px ' + ANTON; fs -= 4; } while (c.measureText(nm).width > W - 160 && fs > 48);
  c.fillText(nm, W / 2, 905);
  c.font = '700 44px ' + PLEX; const a = 'Cracked the vault in ', b = fmt(finalSecs), wa = c.measureText(a).width, wb = c.measureText(b).width;
  c.textAlign = 'left'; c.fillText(a, W / 2 - (wa + wb) / 2, 963); c.fillStyle = RED; c.fillText(b, W / 2 - (wa + wb) / 2 + wa, 963);
  c.textAlign = 'center'; c.fillStyle = RED; c.font = '700 30px ' + MONO; c.fillText('RANK: ' + rankOf(finalSecs).toUpperCase(), W / 2, 1010);
  if (badgeList.length) {
    const pad = 16, gap = 12; let bs = 24, total;
    do { bs -= 2; c.font = '700 ' + bs + 'px ' + MONO; total = badgeList.reduce((p, t) => p + c.measureText(t.toUpperCase()).width + pad * 2, 0) + gap * (badgeList.length - 1); } while (total > W - 140 && bs > 14);
    let x = W / 2 - total / 2;
    badgeList.forEach(t => { const w = c.measureText(t.toUpperCase()).width + pad * 2; c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(x, 1030, w, 40); c.fillStyle = INK; c.fillText(t.toUpperCase(), x + w / 2, 1058); x += w + gap; });
  }
  c.fillStyle = '#4A4436'; let ls = 28; const seen = school ? 'Representing ' + school + ' · last seen at Sault College' : 'Last seen at Sault College';
  do { c.font = '400 ' + ls + 'px ' + MONO; ls -= 2; } while (c.measureText(seen).width > W - 140 && ls > 16);
  c.fillText(seen, W / 2, 1114);
  // footer: program + QR code to the program page
  const FY = 1150, FH = H - 42 - FY; c.fillStyle = INK; c.fillRect(42, FY, W - 84, FH);
  c.textAlign = 'left'; c.fillStyle = PAPER; c.font = '400 46px ' + ANTON; c.fillText('THINK YOU COULD CATCH THEM?', 76, FY + 62);
  c.font = '700 28px ' + PLEX; c.fillText('Computer Networking & Cyber Security', 76, FY + 104);
  c.fillStyle = '#B9AE92'; c.font = '400 22px ' + MONO; c.fillText('saultcollege.ca · scan for IT programs', 76, FY + 138);
  try {
    const q = window.qrcode(0, 'M'); q.addData(PROGRAM_URL); q.make();
    const n = q.getModuleCount(), size = FH - 28, qx = W - 42 - 14 - size, qy = FY + 14, cell = (size - 12) / n;
    c.fillStyle = '#fff'; c.fillRect(qx, qy, size, size); c.fillStyle = INK;
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(qx + 6 + k * cell, qy + 6 + r * cell, Math.ceil(cell), Math.ceil(cell));
  } catch (e) {}
  return cv;
}
async function makePoster() {
  $('posterBtn').disabled = true; $('posterBtn').textContent = 'Making your poster…'; $('posterMsg').textContent = '';
  try { await buildPoster(); }
  catch (e) {
    console.warn('Poster failed:', e);
    $('posterOut').hidden = false; $('posterMsg').className = 'msg bad'; $('posterMsg').textContent = 'Couldn’t make the poster on this device. Try again, or reload the page.';
    $('posterBtn').textContent = posterUrl ? 'Remake poster' : 'Make my poster'; $('posterBtn').disabled = false;
  }
}
async function buildPoster() {
  await posterFonts();
  const cv = drawPoster();
  posterBlob = await new Promise((ok, no) => cv.toBlob(b => b ? ok(b) : no(new Error('toBlob returned nothing')), 'image/jpeg', .9));
  if (posterUrl) URL.revokeObjectURL(posterUrl);
  posterUrl = URL.createObjectURL(posterBlob);
  $('posterImg').src = posterUrl; $('posterImg').alt = 'WANTED poster: ' + posterName() + ', cracked the vault in ' + fmt(finalSecs) + ', last seen at Sault College.';
  $('caption').value = caption();
  $('noPhotoBtn').hidden = !posterPhoto;
  $('shareBtn').hidden = !(navigator.canShare && navigator.canShare({ files: [posterFile()] }));
  $('posterOut').hidden = false; $('posterBtn').textContent = 'Remake poster'; $('posterBtn').disabled = false;
}
const posterFile = () => new File([posterBlob || new Blob()], 'wanted-' + posterName().replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.jpg', { type: 'image/jpeg' });
function usePhoto(input) {
  const f = input.files && input.files[0]; input.value = ''; if (!f) return;
  const url = URL.createObjectURL(f), img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); posterPhoto = img; makePoster(); };
  img.onerror = () => { URL.revokeObjectURL(url); $('posterMsg').className = 'msg bad'; $('posterMsg').textContent = 'Couldn’t open that photo. Try another.'; };
  img.src = url;
}
function posterReset() {
  posterPhoto = null; posterBlob = null; if (posterUrl) URL.revokeObjectURL(posterUrl); posterUrl = '';
  $('posterImg').removeAttribute('src'); $('posterOut').hidden = true; $('posterBtn').textContent = 'Make my poster'; $('posterBtn').disabled = false; $('posterMsg').textContent = '';
  caseNo = String(1000 + Math.floor(Math.random() * 9000));
}
$('posterBtn').addEventListener('click', makePoster);
$('selfieBtn').addEventListener('click', () => $('selfieIn').click());
$('photoBtn').addEventListener('click', () => $('photoIn').click());
$('selfieIn').addEventListener('change', e => usePhoto(e.target));
$('photoIn').addEventListener('change', e => usePhoto(e.target));
$('noPhotoBtn').addEventListener('click', () => { posterPhoto = null; makePoster(); });
$('dlBtn').addEventListener('click', () => { const a = document.createElement('a'); a.href = posterUrl; a.download = posterFile().name; document.body.appendChild(a); a.click(); a.remove(); });
$('shareBtn').addEventListener('click', async () => {
  try { await navigator.share({ files: [posterFile()], title: 'WANTED: ' + posterName(), text: caption() }); }
  catch (e) { if (e.name !== 'AbortError') { $('posterMsg').className = 'msg bad'; $('posterMsg').textContent = 'Sharing didn’t work. Use Download instead.'; } }
});
$('copyBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(caption()); } catch (e) { $('caption').select(); document.execCommand('copy'); }
  $('posterMsg').className = 'msg good'; $('posterMsg').textContent = 'Copied. Paste it into your post.';
});

/* ---------- reset + booth tablet idle (index.html?kiosk) ---------- */
function resetStages() {
  newCipher(); newPerson(); newLog(); newCode();
  $('shift').value = 0; renderCipher(); ['a1', 'a2'].forEach(id => $(id).value = '');
  ['m1', 'm2', 'm3', 'm4', 'm5', 'm5c'].forEach(id => $(id).textContent = '');
  [1, 2, 3, '4c'].forEach(n => { $('h' + n).hidden = true; document.querySelector('[data-hint="' + n + '"]').disabled = false; });
  buildLog(); mi = 0; flagsFound = 0; phishRight = 0; hunting = false; clearTimeout(huntT); entry = ''; renderSlots(); $('door').classList.remove('open');
}
function reset() { liveStop(); posterReset(); if (!gameOpen) { stage = 0; $('hud').hidden = true; running = false; clearInterval(ticking); show('offline'); return; } bLive = false; clearInterval(bTick); if (KIOSK) { $('codeIn').value = ''; school = ''; drawSchools(); } running = false; clearInterval(ticking); stage = 0; $('hud').hidden = true; $('clock').textContent = '0:00'; resetStages(); show('intro'); }
$('againBtn').addEventListener('click', reset);
let idle = null;
function armIdle() { if (!KIOSK) return; clearTimeout(idle); if (stage > 0) idle = setTimeout(reset, stage === 7 ? 60000 : 180000); }
['pointerdown', 'keydown', 'input'].forEach(ev => document.addEventListener(ev, armIdle, { passive: true }));

newCipher(); newPerson(); newLog(); newCode(); renderCipher(); buildLog();

/* ---------- staff on/off switch (board.html) ---------- */
// While the game is off, the start screen becomes a program showcase.
// Anyone mid-game can still finish. If Firebase can't be reached, the
// game stays open (it also works offline).
let gameOpen = true;
function applyGate(open) {
  gameOpen = open; document.documentElement.classList.remove('gate-wait');
  const on = screens.find(s => !s.hidden);
  if (!open && stage === 0) show('offline');
  else if (open && on && on.dataset.s === 'offline') show('intro');
}
setTimeout(() => document.documentElement.classList.remove('gate-wait'), 4000);
dbReady.then(db => { if (!db) return applyGate(true); db.watchGame(applyGate, () => applyGate(true)); }).catch(() => applyGate(true));
