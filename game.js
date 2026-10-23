import { initDb, dayKey, fmt } from './db.js?v=20261023b';

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
  const typed = cleanName($('codeIn').value);
  if (typed && !isAppropriate(typed)) { $('m0').hidden = false; $('m0').className = 'msg bad'; $('m0').textContent = 'That name can’t go on the big screen. Please pick another.'; bad($('codeIn')); return; }
  $('m0').hidden = true;
  const name = typed || codename();
  $('hudName').textContent = name;
  audio(); liveStart(name);
  t0 = performance.now(); penalty = 0; running = true; stage = 1;
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
function liveSet(n) { dbReady.then(db => { if (db && liveId) return db.setLive(liveId, liveName, n, dayKey()); }).catch(() => {}); }
function liveStart(name) {
  liveStop(); liveName = name;
  dbReady.then(db => { if (!db) return; liveId = db.newLiveId(); liveSet(1); liveBeat = setInterval(() => { if (running) liveSet(stage); }, 45000); });
}
function liveStop() {
  clearInterval(liveBeat); clearTimeout(liveEnd);
  const id = liveId; liveId = null;
  if (id) dbReady.then(db => db && db.dropLive(id)).catch(() => {});
}
function liveDone() { liveSet(6); clearInterval(liveBeat); clearTimeout(liveEnd); liveEnd = setTimeout(liveStop, 30000); }
addEventListener('pagehide', liveStop);

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
// Question bank. Each game picks MAIL_PER_GAME messages at random, always
// with at least one phish and one legit. Add or edit entries freely.
// Lakehead Logistics' real domain is lakeheadlogistics.ca. All names,
// companies, numbers and sites here are made up.
const MAIL_PER_GAME = 3;
const MAIL_BANK = [
  // ----- phishing -----
  { ph: true, from: 'SMS · +1 (705) 555-0142', body: 'Lakehead Credit Union: your account is LOCKED. Verify within 1 hour: <span class="lk">lakehead-cu-secure.co/login</span>', why: 'Urgent lock-out plus a link to a look-alike domain.' },
  { ph: true, from: 'Dana Morgan, CEO <dana.lakehead.ceo@outlook.com>', body: 'Need you to wire $4,800 to a new vendor today. I’m in meetings, keep this between us. Bank details attached.', why: 'A "CEO" on a personal account, secrecy and a money transfer.' },
  { ph: true, from: 'IT Support <it-support@lakeheadlogistlcs.ca>', body: 'Your password expires today. Keep your current password here to avoid losing access: <span class="lk">lakeheadlogistlcs.ca/keep-password</span>', why: 'Look closely: "logistlcs" uses an L instead of an i. Real IT never asks you to type your password into a link.' },
  { ph: true, from: 'SMS · +1 (249) 555-0198', body: 'NorthPost: your parcel is on hold due to an unpaid $1.99 customs fee. Pay now: <span class="lk">northpost-redelivery.info</span>', why: 'A tiny fee is bait to steal card numbers, and the link isn’t the courier’s site.' },
  { ph: true, from: 'Payroll <payroll@lakeheadlogistics.ca.hr-portal.net>', body: 'Your pay stub is ready. Sign in to view it before Friday: <span class="lk">lakeheadlogistics.ca.hr-portal.net</span>', why: 'The real domain is the last part before the first slash: hr-portal.net, not lakeheadlogistics.ca.' },
  { ph: true, from: 'Canada Benefits Office <refunds@cra-refund-online.com>', body: 'You are owed a tax refund of $612.40. Click to accept by Interac e-Transfer within 24 hours: <span class="lk">cra-refund-online.com/claim</span>', why: 'Government agencies don’t send refunds through an email link, and the deadline is there to rush you.' },
  { ph: true, from: 'Jordan Reyes <jordan.reyes.work@gmail.com>', body: 'Hey, I lost my phone. Can you text me the 6-digit code you’re about to receive? I need it to get back into my account.', why: 'Nobody legit asks for your MFA or verification code. That code is the key to your account.' },
  { ph: true, from: 'StreamBox <billing@streambox-accounts.support>', body: 'Your payment failed and your account will be closed today. Update your card: <span class="lk">streambox-accounts.support/update</span>', why: 'Threat of closing your account, plus a link to a strange domain asking for card details.' },
  { ph: true, from: 'Shared Files <no-reply@docshare-secure.net>', body: 'Mike Chen shared "Q4 Salaries - CONFIDENTIAL.xlsx" with you. Sign in with your work email and password to open it.', why: 'A juicy file name to make you curious, and a login page outside the company.' },
  { ph: true, from: 'Help Desk <helpdesk@lakeheadlogistics.ca>', body: 'Hi, this is Sam from IT. We’re upgrading your laptop tonight. Reply with your username and password so we can set it up.', why: 'Even from a real address (accounts get hacked), no IT team ever needs your password.' },
  { ph: true, from: 'SMS · +1 (705) 555-0177', body: 'Congrats! You’ve been selected for a $500 Gift Card from SooMart. Claim before midnight: <span class="lk">soomart-winner.club</span>', why: 'A prize you never entered for, a deadline and an odd link.' },
  { ph: true, from: 'Accounts Payable <ap@lakehead-logistics.ca>', body: 'Our banking details have changed. Please send all future invoice payments to the new account below, effective today.', why: 'Note the extra hyphen: lakehead-logistics.ca isn’t the real domain. Changed bank details should always be confirmed by phone.' },

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
  stage = n + 1; pips(); liveSet(stage); show('reward'); $('rwNext').focus();
}
$('rwNext').addEventListener('click', () => {
  if (stage === 2) { show('s2'); $('a2').focus(); }
  else if (stage === 3) show('s3');
  else if (stage === 4) { MAIL = pickMail(); mi = 0; renderMail(); $('m4').textContent = ''; show('s4'); }
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
    vaultBusy = true; running = false; liveDone(); finalSecs = Math.round(elapsed()); clearInterval(ticking); $('clock').textContent = fmt(finalSecs);
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
  posted = false; $('saveMsg').textContent = ''; $('nameIn').value = liveName; $('saveBtn').disabled = false;
  posterReset(); leadReset(); $('wantedCard').hidden = KIOSK;
  const db = await dbReady;
  $('saveDirect').hidden = !db; $('saveOff').hidden = !!db;
  $('leadOn').hidden = !db; $('leadOff').hidden = !!db;
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

/* ---------- wanted poster ---------- */
// Drawn on the player's own phone. The photo never leaves the device.
const PROGRAM_URL = 'https://www.saultcollege.ca/programs/information-technology-studies/computer-networking-and-cyber-security';
let posterPhoto = null, posterBlob = null, posterUrl = '', caseNo = '';
const posterName = () => { const n = cleanName($('nameIn').value); return n && isAppropriate(n) ? n : liveName || 'Unknown hacker'; };
const caption = () => 'I cracked the vault in ' + fmt(finalSecs) + ' at the Sault College Cyber Security booth. Think you can catch me? ' + PROGRAM_URL;
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
  const PX = 150, PY = 330, PW = 780, PH = 500, BX = 290, BW = 500;
  c.fillStyle = '#D6CAAB'; c.fillRect(PX, PY, PW, PH);
  c.strokeStyle = 'rgba(27,26,23,.45)'; c.fillStyle = 'rgba(27,26,23,.65)'; c.lineWidth = 2; c.font = '700 18px ' + MONO;
  for (let i = 0; i <= 10; i++) {
    const y = PY + 42 + i * 44, inch = 78 - i * 3, lab = Math.floor(inch / 12) + '′' + (inch % 12) + '″';
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
    c.beginPath(); c.ellipse(W / 2, PY + PH + 40, 220, 230, 0, Math.PI, 0); c.fill();
    c.beginPath(); c.arc(W / 2, PY + 190, 100, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#D6CAAB'; c.textAlign = 'center'; c.font = '400 130px ' + ANTON; c.fillText('?', W / 2, PY + 238);
  }
  c.strokeStyle = INK; c.lineWidth = 6; c.strokeRect(PX, PY, PW, PH);
  // booking placard
  c.fillStyle = INK; c.fillRect(W / 2 - 230, PY + PH - 40, 460, 66);
  c.fillStyle = PAPER; c.textAlign = 'center'; c.font = '700 26px ' + MONO; c.fillText('CASE OV-' + caseNo + ' · ' + dayKey(), W / 2, PY + PH + 3);
  // name, time, last seen
  const nm = posterName().toUpperCase(); let fs = 130;
  c.fillStyle = INK; do { c.font = '400 ' + fs + 'px ' + ANTON; fs -= 4; } while (c.measureText(nm).width > W - 160 && fs > 48);
  c.fillText(nm, W / 2, 1000);
  c.font = '700 46px ' + PLEX; const a = 'Cracked the vault in ', b = fmt(finalSecs), wa = c.measureText(a).width, wb = c.measureText(b).width;
  c.textAlign = 'left'; c.fillText(a, W / 2 - (wa + wb) / 2, 1066); c.fillStyle = RED; c.fillText(b, W / 2 - (wa + wb) / 2 + wa, 1066);
  c.textAlign = 'center'; c.fillStyle = '#4A4436'; c.font = '400 30px ' + MONO; c.fillText('Last seen at Sault College', W / 2, 1114);
  // footer: program + QR code to the program page
  const FY = 1150, FH = H - 42 - FY; c.fillStyle = INK; c.fillRect(42, FY, W - 84, FH);
  c.textAlign = 'left'; c.fillStyle = PAPER; c.font = '400 46px ' + ANTON; c.fillText('THINK YOU COULD CATCH THEM?', 76, FY + 62);
  c.font = '700 28px ' + PLEX; c.fillText('Computer Networking & Cyber Security', 76, FY + 104);
  c.fillStyle = '#B9AE92'; c.font = '400 22px ' + MONO; c.fillText('saultcollege.ca · scan for the program', 76, FY + 138);
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

/* ---------- send me program info ---------- */
// Saved to Firestore "leads". Visitors can add one but can't read any back;
// staff export them from leads.html.
const CONSENT = 'Send me program info. Sault College can email or text me about this program and its events. I can unsubscribe at any time.';
function parseContact(s) {
  s = (s || '').trim();
  if (s.includes('@')) return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s) && s.length <= 100 ? { contact: s.toLowerCase(), kind: 'email' } : null;
  let d = s.replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  if (d.length === 10) return { contact: d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6), kind: 'phone' };
  return d.length >= 11 && d.length <= 15 && s.trim().startsWith('+') ? { contact: '+' + d, kind: 'phone' } : null;
}
function leadReset() {
  $('leadOpt').checked = false; $('leadOpt').disabled = false; $('leadForm').hidden = true;
  $('leadName').value = ''; $('leadContact').value = ''; $('leadWho').value = ''; $('leadMsg').textContent = ''; $('leadSend').disabled = false;
}
$('leadOpt').addEventListener('change', () => { $('leadForm').hidden = !$('leadOpt').checked; $('leadMsg').textContent = ''; if ($('leadOpt').checked) $('leadName').focus(); });
$('leadSend').addEventListener('click', async () => {
  const m = $('leadMsg'), name = $('leadName').value.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40), c = parseContact($('leadContact').value);
  if (!name) { m.className = 'msg bad'; m.textContent = 'Add your first name.'; $('leadName').focus(); return; }
  if (!c) { m.className = 'msg bad'; m.textContent = 'Enter an email address or a 10-digit mobile number.'; $('leadContact').focus(); return; }
  const db = await dbReady; if (!db) { m.className = 'msg bad'; m.textContent = 'Can’t connect right now. Ask the booth staff for program info.'; return; }
  const lead = { name, contact: c.contact, kind: c.kind, event: String((window.OV_CONFIG && window.OV_CONFIG.event) || 'Booth').slice(0, 80), day: dayKey(), consent: CONSENT };
  if ($('leadWho').value) lead.who = $('leadWho').value;
  $('leadSend').disabled = true; m.className = 'msg info'; m.textContent = 'Sending…';
  try {
    await db.addLead(lead);
    $('leadForm').hidden = true; $('leadOpt').disabled = true; $('leadName').value = ''; $('leadContact').value = ''; $('leadWho').value = '';
    m.className = 'msg good'; m.textContent = 'Thanks, ' + name + '. Watch for program info from Sault College.';
  } catch (e) { $('leadSend').disabled = false; m.className = 'msg bad'; m.textContent = 'Couldn’t send that. Check the connection and try again.'; }
});

/* ---------- reset + booth tablet idle (index.html?kiosk) ---------- */
function resetStages() {
  $('shift').value = 0; renderCipher(); ['a1', 'a2'].forEach(id => $(id).value = '');
  ['m1', 'm2', 'm3', 'm4', 'm5'].forEach(id => $(id).textContent = '');
  [1, 2, 3].forEach(n => { $('h' + n).hidden = true; document.querySelector('[data-hint="' + n + '"]').disabled = false; });
  buildLog(); mi = 0; entry = ''; renderSlots(); $('door').classList.remove('open');
}
function reset() { liveStop(); posterReset(); leadReset(); if (KIOSK) $('codeIn').value = ''; running = false; clearInterval(ticking); stage = 0; $('hud').hidden = true; $('clock').textContent = '0:00'; resetStages(); show('intro'); }
$('againBtn').addEventListener('click', reset);
let idle = null;
function armIdle() { if (!KIOSK) return; clearTimeout(idle); if (stage > 0) idle = setTimeout(reset, stage === 6 ? 60000 : 180000); }
['pointerdown', 'keydown', 'input'].forEach(ev => document.addEventListener(ev, armIdle, { passive: true }));

renderCipher(); buildLog();
