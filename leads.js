import { initDb } from './db.js?v=20261023c';

const $ = id => document.getElementById(id);
let db = null, leads = [];
function msg(t, kind) { $('lMsg').className = 'msg ' + (kind || 'info'); $('lMsg').textContent = t || ''; }

/* ---------- summary ---------- */
function events() {
  const by = new Map();
  leads.forEach(l => { const e = by.get(l.event) || { n: 0, days: new Set() }; e.n++; e.days.add(l.day); by.set(l.event, e); });
  return [...by.entries()].sort((a, b) => [...b[1].days].sort().pop().localeCompare([...a[1].days].sort().pop()));
}
function render() {
  const ev = events();
  $('lTotal').textContent = leads.length; $('lEvents').textContent = ev.length;
  const body = $('lByEvent'); body.textContent = '';
  const pick = $('lPick'), keep = pick.value; pick.length = 1;
  ev.forEach(([name, e]) => {
    const days = [...e.days].sort(), tr = document.createElement('tr');
    [name, days[0] + (days.length > 1 ? ' to ' + days[days.length - 1] : ''), e.n].forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
    body.appendChild(tr);
    const o = document.createElement('option'); o.value = name; o.textContent = name + ' (' + e.n + ')'; pick.appendChild(o);
  });
  if (!ev.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 3; td.textContent = 'No sign-ups yet.'; tr.appendChild(td); body.appendChild(tr); }
  pick.value = ev.some(([n]) => n === keep) ? keep : '';
}
async function load() {
  msg('Loading…');
  try { leads = await db.listLeads(); leads.sort((a, b) => a.at - b.at); render(); msg(''); }
  catch (e) { leads = []; render(); msg('This account can’t read sign-ups. Add its User UID to isStaff() in firestore.rules and publish the rules (README, step 4).', 'bad'); }
}

/* ---------- CSV ---------- */
// Visitors typed these values, so a leading = + - @ is neutralised to stop
// spreadsheet formulas running when the file is opened.
const cell = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
const pad = n => String(n).padStart(2, '0');
$('lDownload').addEventListener('click', () => {
  const ev = $('lPick').value, rows = leads.filter(l => !ev || l.event === ev);
  if (!rows.length) { msg('Nothing to download yet.'); return; }
  const out = [['Date', 'Time', 'Event', 'School', 'First name', 'Email', 'Mobile', 'I am', 'Consent given']];
  rows.forEach(l => {
    const d = new Date(l.at || Date.now());
    out.push([l.day, l.at ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : '', l.event, l.school || '', l.name, l.kind === 'email' ? l.contact : '', l.kind === 'phone' ? l.contact : '', l.who || '', l.consent]);
  });
  const csv = '﻿' + out.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'operation-vault-leads-' + (ev ? ev.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' : '') + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  msg('Downloaded ' + rows.length + ' sign-up' + (rows.length === 1 ? '' : 's') + '.', 'good');
});

/* ---------- sign-in ---------- */
$('signInForm').addEventListener('submit', async e => {
  e.preventDefault(); msg('Signing in…');
  try { await db.signIn($('lEmail').value.trim(), $('lPw').value); $('lPw').value = ''; }
  catch (err) { msg('Sign-in failed. Check the email and password.', 'bad'); }
});
$('lRefresh').addEventListener('click', load);
$('lOut').addEventListener('click', () => db.signOut());

(async () => {
  db = await initDb();
  if (!db) { msg('Not connected: add your Firebase settings to config.js (see README).', 'bad'); return; }
  db.onAuth(u => {
    $('signInForm').hidden = !!u; $('leadsView').hidden = !u;
    if (u) load(); else { leads = []; msg(''); $('lEmail').focus(); }
  });
})();
