'use strict';

/*
  RoomPulse: live polls and quizzes (simulation).

  There is no server, so everything is saved in this browser's localStorage.
  Tabs in the same browser see each other's changes through the "storage"
  event, which is how the host, attendee and big-screen views stay in sync.
*/

const KEY = 'roompulse:v1';
const PARTICIPANT_KEY = 'roompulse:participant';
const HOST_ORG_KEY = 'roompulse:hostOrg';
// Easy-to-read session code letters: no 0/O, 1/I/L.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SCREEN_BATCH_MS = 300;

// Fictional client organisations. Each carries its own branding.
const SEED_ORGS = [
  { id: 'org-northbridge', name: 'Northbridge Therapeutics', short: 'NT', primary: '#2E3A87', secondary: '#F2A93B' },
  { id: 'org-halden', name: 'Halden Health', short: 'HH', primary: '#0E6B5C', secondary: '#E9D8A6' }
];

let storageOK = true;
let memDB = null;
let lastJoinSig = null;
let screenTimer = null;

/* ---------- Small helpers ---------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function makeCode(db) {
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  } while (db.sessions.some(s => s.code === code));
  return code;
}
function cleanCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function formatDate(ms) {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

/* ---------- Saving and loading ---------- */

function seed() {
  const db = { orgs: SEED_ORGS.map(o => ({ ...o })), sessions: [] };
  db.sessions.push({
    id: uid('ses'),
    orgId: 'org-northbridge',
    code: makeCode(db),
    title: 'Spring brand workshop (demo)',
    createdAt: Date.now(),
    currentId: null,
    votes: {},
    activities: [
      { id: uid('act'), type: 'poll', question: 'Which launch theme should lead our next campaign?',
        options: ['Confidence', 'Simplicity', 'Partnership', 'Momentum'], multi: false, correct: [], status: 'draft' },
      { id: uid('act'), type: 'quiz', question: 'How many regions are in our (made-up) sales network?',
        options: ['Four', 'Six', 'Eight'], multi: false, correct: [1], status: 'draft' }
    ]
  });
  return db;
}

function load() {
  if (storageOK) {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { storageOK = false; }
    if (storageOK) {
      if (raw) {
        try { return JSON.parse(raw); } catch (e) { /* damaged data: start again */ }
      }
      const db = seed();
      save(db);
      return db;
    }
  }
  if (!memDB) memDB = seed();
  return memDB;
}

function save(db) {
  if (storageOK) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return; } catch (e) { storageOK = false; }
  }
  memDB = db;
}

// Change the saved data, then redraw this tab. Other tabs hear about it via "storage".
function update(fn) {
  const db = load();
  fn(db);
  save(db);
  render();
}

function readPref(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function writePref(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } }

// A random ID for this device, so an attendee can only answer each poll once.
function participantId() {
  let id = readPref(PARTICIPANT_KEY);
  if (!id) {
    id = uid('p');
    writePref(PARTICIPANT_KEY, id);
    if (!readPref(PARTICIPANT_KEY)) window.__rpPid = window.__rpPid || id;
  }
  return readPref(PARTICIPANT_KEY) || window.__rpPid;
}

function hostOrgId(db) {
  const saved = readPref(HOST_ORG_KEY);
  return db.orgs.some(o => o.id === saved) ? saved : db.orgs[0].id;
}

function findSession(db, code) {
  const c = cleanCode(code);
  return db.sessions.find(s => s.code === c) || null;
}
function orgOf(db, s) { return db.orgs.find(o => o.id === s.orgId) || null; }
function currentActivity(s) { return s.activities.find(a => a.id === s.currentId) || null; }

function tally(s, a) {
  const counts = a.options.map(() => 0);
  const votes = s.votes[a.id] || {};
  let n = 0;
  for (const pid in votes) {
    n++;
    votes[pid].forEach(i => { if (counts[i] != null) counts[i]++; });
  }
  return { counts, n };
}

/* ---------- Branding and contrast ---------- */

function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex) {
  const w = [0.2126, 0.7152, 0.0722];
  return hexToRgb(hex).reduce((sum, v, i) => {
    v /= 255;
    return sum + w[i] * (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  }, 0);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
// Pick whichever of white or near-black text reads best on a colour.
function inkFor(bg) {
  return contrast(bg, '#ffffff') >= contrast(bg, '#1a1a2e') ? '#ffffff' : '#1a1a2e';
}

function applyTheme(org) {
  const root = document.documentElement.style;
  const props = ['--brand', '--brand-ink', '--brand-text', '--accent', '--accent-ink'];
  if (!org) { props.forEach(p => root.removeProperty(p)); return; }
  root.setProperty('--brand', org.primary);
  root.setProperty('--brand-ink', inkFor(org.primary));
  root.setProperty('--brand-text', contrast(org.primary, '#ffffff') >= 4.5 ? org.primary : '#1a1a2e');
  root.setProperty('--accent', org.secondary);
  root.setProperty('--accent-ink', inkFor(org.secondary));
}

// A simple drawn logo: initials on the organisation's colours.
function logo(org, size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" role="img" aria-label="${esc(org.name)} logo">
    <rect width="40" height="40" rx="10" fill="${esc(org.primary)}" stroke="${esc(inkFor(org.primary))}" stroke-opacity="0.4"/>
    <circle cx="31" cy="9" r="5" fill="${esc(org.secondary)}"/>
    <text x="19" y="27" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="800" font-size="15" fill="${esc(inkFor(org.primary))}">${esc(org.short)}</text>
  </svg>`;
}

/* ---------- Shared bits of page ---------- */

function joinUrl(code) {
  return location.origin + location.pathname + '#join/' + code;
}

function resultsHTML(s, a, onScreen) {
  const { counts, n } = tally(s, a);
  const showCorrect = a.type === 'quiz' && (!onScreen || a.status === 'closed');
  const rows = a.options.map((opt, i) => {
    const pct = n ? Math.round((counts[i] / n) * 100) : 0;
    const right = showCorrect && a.correct.includes(i);
    return `<li>
      <div class="bar-label">
        <span>${esc(opt)}${right ? ' <span class="tick">✓ Correct</span>' : ''}</span>
        <span class="bar-num">${pct}% <small>(${counts[i]})</small></span>
      </div>
      <div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${pct}%"></div></div>
    </li>`;
  }).join('');
  return `<p class="total">${plural(n, 'response', 'responses')}</p><ol class="bars">${rows}</ol>`;
}

function statusBadge(a) {
  const label = { draft: 'Not started', open: 'Voting open', closed: 'Closed' }[a.status];
  return `<span class="badge ${a.status}">${label}</span>`;
}

function notFound(what, back) {
  return { title: 'Not found', html: `<h1 tabindex="-1">${esc(what)}</h1><p><a href="${back}">Go back</a></p>` };
}

/* ---------- Home ---------- */

function homeView(db) {
  const demo = db.sessions[0];
  const demoCode = demo ? demo.code : '';
  return {
    title: 'Home',
    html: `
      <p class="eyebrow">Live polls and quizzes</p>
      <h1 tabindex="-1">Bring the room into the meeting</h1>
      <p class="lead">Hosts set up a poll or quiz, attendees answer on their phones, and the results appear live on the big screen.</p>

      <ul class="cards three">
        <li class="card"><h2>Host</h2><p>Create a session, add polls and quizzes, and run them live.</p><a class="btn" href="#host">Open host area</a></li>
        <li class="card"><h2>Join</h2><p>Enter a session code on your phone and answer anonymously.</p><a class="btn" href="#join${demoCode ? '/' + demoCode : ''}">Join a session</a></li>
        <li class="card"><h2>Big screen</h2><p>Show the current question and live results on the room screen.</p><a class="btn" href="#screen${demoCode ? '/' + demoCode : ''}">Open big screen</a></li>
      </ul>

      <h2>How to try it</h2>
      <div class="note">
        <p><strong>This is a simulation.</strong> There's no server, so everything is saved only in this browser on this device. Phones in the room can't join yet.</p>
        <ol>
          <li>Open the <strong>Host</strong>, <strong>Join</strong> and <strong>Big screen</strong> views in three tabs of the same browser.${demoCode ? ` The demo session code is <span class="code">${esc(demoCode)}</span>.` : ''}</li>
          <li>In the host tab, choose <strong>Open voting</strong> on a question.</li>
          <li>Answer in the join tab, or use <strong>Add 20 sample votes</strong> to fill the room, then watch the big screen update.</li>
        </ol>
      </div>`
  };
}

/* ---------- Host ---------- */

function hostHome(db) {
  const orgId = hostOrgId(db);
  const org = db.orgs.find(o => o.id === orgId);
  const sessions = db.sessions.filter(s => s.orgId === orgId).sort((a, b) => b.createdAt - a.createdAt);
  const orgOptions = db.orgs.map(o => `<option value="${esc(o.id)}"${o.id === orgId ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
  const list = sessions.length
    ? `<ul class="cards">${sessions.map(s => `
        <li class="card">
          <h3><a href="#host/${esc(s.code)}">${esc(s.title)}</a></h3>
          <p class="meta">${formatDate(s.createdAt)} · ${plural(s.activities.length, 'activity', 'activities')} · code <span class="code">${esc(s.code)}</span></p>
        </li>`).join('')}</ul>`
    : `<p>No sessions yet. Create your first one above.</p>`;

  return {
    org,
    title: 'Host',
    html: `
      <p class="eyebrow">Host area</p>
      <h1 tabindex="-1">Your sessions</h1>
      <label for="org-select">Organisation (pretend sign-in)</label>
      <select id="org-select">${orgOptions}</select>
      <p class="hint">Each organisation only sees its own sessions and branding.</p>

      <form id="new-session" class="card" style="margin-top:1.5rem">
        <h2 style="margin-top:0">Create a session</h2>
        <label for="session-title">Session name</label>
        <div class="inline-row">
          <input type="text" id="session-title" required maxlength="80" placeholder="For example, Q3 sales kick-off">
          <button class="btn" type="submit">Create</button>
        </div>
      </form>

      <h2>Past and current sessions</h2>
      ${list}`,
    after() {
      document.getElementById('org-select').addEventListener('change', e => {
        writePref(HOST_ORG_KEY, e.target.value);
        render();
      });
      document.getElementById('new-session').addEventListener('submit', e => {
        e.preventDefault();
        const title = document.getElementById('session-title').value.trim();
        if (!title) return;
        let code;
        update(d => {
          code = makeCode(d);
          d.sessions.push({ id: uid('ses'), orgId: hostOrgId(d), code, title, createdAt: Date.now(), currentId: null, votes: {}, activities: [] });
        });
        go('#host/' + code);
      });
    }
  };
}

function hostSession(db, code) {
  const s = findSession(db, code);
  if (!s || s.orgId !== hostOrgId(db)) return notFound('Session not found for this organisation', '#host');
  const org = orgOf(db, s);
  const acts = s.activities.length
    ? s.activities.map((a, i) => `
      <li class="card">
        <p class="meta">${i + 1}. ${a.type === 'quiz' ? 'Quiz' : 'Poll'}${a.multi ? ' · more than one answer allowed' : ''} · ${statusBadge(a)}${s.currentId === a.id ? ' · <strong>on the big screen</strong>' : ''}</p>
        <h3>${esc(a.question)}</h3>
        <div data-results="${esc(a.id)}">${resultsHTML(s, a, false)}</div>
        <div class="actions">
          ${a.status === 'open'
            ? `<button class="btn" data-action="close" data-id="${esc(a.id)}">Close voting</button>
               <button class="btn secondary" data-action="sample" data-id="${esc(a.id)}">Add 20 sample votes</button>`
            : `<button class="btn" data-action="open" data-id="${esc(a.id)}">${a.status === 'closed' ? 'Reopen voting' : 'Open voting'}</button>`}
          ${a.status === 'closed' && s.currentId !== a.id ? `<button class="btn secondary" data-action="show" data-id="${esc(a.id)}">Show results on big screen</button>` : ''}
          <button class="btn secondary" data-action="clear" data-id="${esc(a.id)}">Clear answers</button>
          <button class="btn danger" data-action="delete" data-id="${esc(a.id)}">Delete</button>
        </div>
      </li>`).join('')
    : '';

  return {
    org,
    title: s.title,
    html: `
      <p class="eyebrow"><a href="#host">Your sessions</a></p>
      <h1 tabindex="-1">${esc(s.title)}</h1>
      <div class="card">
        <p style="margin:0">Session code: <span class="code" style="font-size:1.6rem">${esc(s.code)}</span></p>
        <p class="meta">Join link: ${esc(joinUrl(s.code))}</p>
        <div class="actions">
          <a class="btn secondary" href="#screen/${esc(s.code)}" target="_blank" rel="noopener">Open big screen (new tab)</a>
          <a class="btn secondary" href="#join/${esc(s.code)}" target="_blank" rel="noopener">Open attendee view (new tab)</a>
        </div>
        <p class="hint">Simulation: these only work in tabs of this browser. A QR code will come once the app has a server phones can reach.</p>
      </div>

      <h2>Activities</h2>
      ${acts ? `<ul class="cards">${acts}</ul>` : '<p>No activities yet.</p>'}
      <div class="actions"><a class="btn" href="#host/${esc(s.code)}/new">Add a poll or quiz</a></div>`,
    after() {
      document.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => hostAction(s.code, btn.dataset.action, btn.dataset.id)));
    }
  };
}

function hostAction(code, action, aid) {
  if (action === 'delete' && !confirm('Delete this activity and its answers?')) return;
  if (action === 'clear' && !confirm('Clear all answers for this activity?')) return;
  update(db => {
    const s = findSession(db, code);
    const a = s && s.activities.find(x => x.id === aid);
    if (!a) return;
    if (action === 'open') {
      s.activities.forEach(x => { if (x.status === 'open') x.status = 'closed'; });
      a.status = 'open';
      s.currentId = a.id;
    } else if (action === 'close') {
      a.status = 'closed';
    } else if (action === 'show') {
      s.currentId = a.id;
    } else if (action === 'clear') {
      delete s.votes[a.id];
    } else if (action === 'delete') {
      s.activities = s.activities.filter(x => x.id !== a.id);
      delete s.votes[a.id];
      if (s.currentId === a.id) s.currentId = null;
    } else if (action === 'sample') {
      addSampleVotes(s, a, 20);
    }
  });
}

// Made-up votes from pretend attendees, so a busy room can be demonstrated.
function addSampleVotes(s, a, count) {
  const votes = s.votes[a.id] || (s.votes[a.id] = {});
  const weights = a.options.map(() => 0.5 + Math.random());
  const total = weights.reduce((x, y) => x + y, 0);
  for (let k = 0; k < count; k++) {
    let picks;
    if (a.multi) {
      picks = a.options.map((_, i) => i).filter(i => Math.random() < weights[i] / total * 1.6);
      if (!picks.length) picks = [Math.floor(Math.random() * a.options.length)];
    } else {
      let r = Math.random() * total;
      let i = 0;
      while (r > weights[i] && i < weights.length - 1) { r -= weights[i]; i++; }
      picks = [i];
    }
    votes[uid('sample')] = picks;
  }
}

function hostBuilder(db, code) {
  const s = findSession(db, code);
  if (!s || s.orgId !== hostOrgId(db)) return notFound('Session not found for this organisation', '#host');
  const optionRows = [0, 1, 2, 3, 4, 5].map(i => `
    <div class="inline-row" style="margin-bottom:0.5rem">
      <input type="text" name="option" id="opt-${i}" maxlength="80" aria-label="Answer ${i + 1}${i < 2 ? ' (required)' : ' (optional)'}" placeholder="Answer ${i + 1}${i < 2 ? '' : ' (optional)'}">
      <label class="check quiz-only"><input type="checkbox" name="correct" value="${i}"> Correct</label>
    </div>`).join('');

  return {
    org: orgOf(db, s),
    title: 'Add a poll or quiz',
    html: `
      <p class="eyebrow"><a href="#host/${esc(s.code)}">${esc(s.title)}</a></p>
      <h1 tabindex="-1">Add a poll or quiz</h1>
      <form id="builder" class="card" data-type="poll" novalidate>
        <fieldset style="margin-top:0">
          <legend>Type</legend>
          <label class="check"><input type="radio" name="type" value="poll" checked> Poll (no right answer)</label>
          <label class="check"><input type="radio" name="type" value="quiz"> Quiz (mark the correct answer)</label>
        </fieldset>
        <label for="question">Question</label>
        <textarea id="question" rows="2" maxlength="200" required></textarea>
        <fieldset>
          <legend>Answers</legend>
          <p class="hint" style="margin-bottom:0.75rem">Add between 2 and 6 answers.<span class="quiz-only"> Tick the correct one.</span></p>
          ${optionRows}
        </fieldset>
        <label class="check" style="margin-top:1rem"><input type="checkbox" id="multi"> Let attendees choose more than one answer</label>
        <p id="builder-error" class="error" role="alert"></p>
        <div class="actions">
          <button class="btn" type="submit">Save</button>
          <a class="btn secondary" href="#host/${esc(s.code)}">Cancel</a>
        </div>
      </form>`,
    after() {
      const form = document.getElementById('builder');
      form.addEventListener('change', () => { form.dataset.type = form.elements.type.value; });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const err = document.getElementById('builder-error');
        const type = form.elements.type.value;
        const question = document.getElementById('question').value.trim();
        const multi = document.getElementById('multi').checked;
        const raw = [...form.querySelectorAll('input[name="option"]')].map(inp => inp.value.trim());
        const ticked = new Set([...form.querySelectorAll('input[name="correct"]:checked')].map(c => Number(c.value)));
        const options = [];
        const correct = [];
        raw.forEach((text, i) => {
          if (!text) return;
          if (type === 'quiz' && ticked.has(i)) correct.push(options.length);
          options.push(text);
        });
        let problem = '';
        if (!question) problem = 'Please write a question.';
        else if (options.length < 2) problem = 'Please add at least two answers.';
        else if (type === 'quiz' && correct.length === 0) problem = 'Please tick the correct answer.';
        else if (type === 'quiz' && !multi && correct.length > 1) problem = 'Only one answer can be correct unless attendees can choose more than one.';
        if (problem) { err.textContent = problem; return; }
        update(d => {
          const ses = findSession(d, code);
          ses.activities.push({ id: uid('act'), type, question, options, multi, correct, status: 'draft' });
        });
        go('#host/' + s.code);
      });
    }
  };
}

/* ---------- Attendee (phone) ---------- */

function joinSig(db, code) {
  const s = findSession(db, code);
  if (!s) return 'none';
  const a = currentActivity(s);
  const mine = a && s.votes[a.id] && s.votes[a.id][participantId()];
  return [a ? a.id : '-', a ? a.status : '-', mine ? 'voted' : 'not'].join('|');
}

function joinForm(view, heading, error) {
  return `
    <p class="eyebrow">${view === 'join' ? 'Join a session' : 'Big screen'}</p>
    <h1 tabindex="-1">${heading}</h1>
    <form id="code-form" class="${view === 'screen' ? 'screen-form' : ''}">
      <label for="code-input">Session code</label>
      <input type="text" id="code-input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8" required aria-describedby="code-error">
      <p id="code-error" class="error" role="alert">${error ? esc(error) : ''}</p>
      <button class="btn big" type="submit">${view === 'join' ? 'Join' : 'Show session'}</button>
    </form>`;
}
function bindCodeForm(view) {
  document.getElementById('code-form').addEventListener('submit', e => {
    e.preventDefault();
    const code = cleanCode(document.getElementById('code-input').value);
    if (!findSession(load(), code)) {
      document.getElementById('code-error').textContent = "We couldn't find that code. Please check it and try again.";
      return;
    }
    go('#' + view + '/' + code);
  });
}

function joinView(db, code) {
  if (!code) {
    lastJoinSig = null;
    return { title: 'Join', html: joinForm('join', 'Enter your code'), after: () => bindCodeForm('join') };
  }
  const s = findSession(db, code);
  if (!s) {
    lastJoinSig = null;
    return { title: 'Join', html: joinForm('join', 'Enter your code', "We couldn't find that code. Please check it and try again."), after: () => bindCodeForm('join') };
  }
  lastJoinSig = joinSig(db, code);
  const org = orgOf(db, s);
  const a = currentActivity(s);
  const pid = participantId();
  const mine = a && s.votes[a.id] ? s.votes[a.id][pid] : null;
  const top = `<p class="eyebrow">${esc(s.title)}</p>`;
  const anon = `<p class="hint">Your answers are anonymous. We don't ask for your name or any personal details.</p>`;

  let body;
  if (!a || a.status === 'draft') {
    body = `<h1 tabindex="-1">You're in</h1><p class="status-big">Waiting for the host to start the next question…</p>${anon}`;
  } else if (a.status === 'open' && !mine) {
    const inputType = a.multi ? 'checkbox' : 'radio';
    body = `
      <form id="answer-form">
        <h1 tabindex="-1" id="q">${esc(a.question)}</h1>
        <fieldset aria-labelledby="q">
          <p class="hint">${a.multi ? 'Choose all that apply.' : 'Choose one answer.'}</p>
          <div class="choices">
            ${a.options.map((o, i) => `<label class="choice"><input type="${inputType}" name="answer" value="${i}"> ${esc(o)}</label>`).join('')}
          </div>
        </fieldset>
        <p id="answer-error" class="error" role="alert"></p>
        <button class="btn big" type="submit">Send answer</button>
      </form>${anon}`;
  } else {
    const chosen = mine ? mine.map(i => esc(a.options[i])).join(', ') : '';
    let outcome = '';
    if (a.status === 'closed' && a.type === 'quiz') {
      const right = mine && mine.length === a.correct.length && mine.every(i => a.correct.includes(i));
      const answer = a.correct.map(i => esc(a.options[i])).join(', ');
      outcome = mine
        ? (right ? `<p class="status-big">✓ You got it right!</p>` : `<p class="status-big">Not this time. The correct answer was <strong>${answer}</strong>.</p>`)
        : `<p class="status-big">The correct answer was <strong>${answer}</strong>.</p>`;
    } else if (a.status === 'closed') {
      outcome = `<p class="status-big">Voting has closed. Look at the big screen for the results.</p>`;
    } else {
      outcome = `<p class="status-big">Thanks, your answer is in. Watch the big screen for results.</p>`;
    }
    body = `
      <h1 tabindex="-1">${esc(a.question)}</h1>
      ${mine ? `<p class="result-mine">You chose: ${chosen}</p>` : `<p>You didn't answer this one.</p>`}
      ${outcome}`;
  }

  return {
    org,
    title: 'Join · ' + s.title,
    html: top + body,
    after() {
      const form = document.getElementById('answer-form');
      if (!form) return;
      form.addEventListener('submit', e => {
        e.preventDefault();
        const picks = [...form.querySelectorAll('input[name="answer"]:checked')].map(c => Number(c.value));
        if (!picks.length) { document.getElementById('answer-error').textContent = 'Please choose an answer first.'; return; }
        update(d => {
          const ses = findSession(d, code);
          const act = ses && currentActivity(ses);
          if (!act || act.id !== a.id || act.status !== 'open') return;
          const votes = ses.votes[act.id] || (ses.votes[act.id] = {});
          if (votes[pid]) return; // one answer per device
          votes[pid] = picks;
        });
        focusHeading();
      });
    }
  };
}

/* ---------- Big screen ---------- */

function screenView(db, code) {
  if (!code) return { title: 'Big screen', html: joinForm('screen', 'Which session?'), after: () => bindCodeForm('screen') };
  const s = findSession(db, code);
  if (!s) return { title: 'Big screen', html: joinForm('screen', 'Which session?', "We couldn't find that code."), after: () => bindCodeForm('screen') };
  const org = orgOf(db, s);
  const a = currentActivity(s);
  const shortUrl = (location.host || 'this site') + '/#join';
  const header = `
    <div class="screen-join">
      <span>${org ? logo(org, 48) : ''} ${esc(s.title)}</span>
      <span>Join at ${esc(shortUrl)} · code <span class="code">${esc(s.code)}</span></span>
    </div>`;
  const body = (!a)
    ? `<h1 class="screen-waiting" tabindex="-1">Get your phones ready<span class="code">${esc(s.code)}</span></h1>`
    : `<h1 class="screen-question" tabindex="-1">${esc(a.question)}</h1>
       ${a.status === 'closed' ? '<p class="total">Voting has closed</p>' : ''}
       ${resultsHTML(s, a, true)}`;
  return { org, title: 'Big screen · ' + s.title, html: `<div class="screen">${header}${body}</div>` };
}

/* ---------- Page switching ---------- */

function route() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

function go(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

function focusHeading() {
  const h = document.querySelector('#app h1');
  if (h) h.focus();
}

function render() {
  const [view, code, sub] = route();
  const db = load();
  let out;
  if (view === 'host') out = code ? (sub === 'new' ? hostBuilder(db, code) : hostSession(db, code)) : hostHome(db);
  else if (view === 'join') out = joinView(db, code);
  else if (view === 'screen') out = screenView(db, code);
  else out = homeView(db);

  document.body.dataset.view = ['host', 'join', 'screen'].includes(view) ? view : 'home';
  applyTheme(out.org || null);
  document.getElementById('orgbadge').innerHTML = out.org ? `${logo(out.org, 28)}<span>${esc(out.org.name)}</span>` : '';
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.dataset.nav === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = out.title + ' · RoomPulse';

  const warning = storageOK ? '' : `<p class="note">Your browser isn't letting this site save anything, so changes will be lost when you close the page.</p>`;
  document.getElementById('app').innerHTML = warning + out.html;
  if (out.after) out.after();
}

// Another tab changed the saved data: refresh what this tab shows.
window.addEventListener('storage', e => {
  if (e.key !== KEY) return;
  const [view, code, sub] = route();
  if (view === 'screen') {
    // Batch big-screen updates instead of redrawing on every vote.
    if (!screenTimer) screenTimer = setTimeout(() => { screenTimer = null; render(); }, SCREEN_BATCH_MS);
  } else if (view === 'join' && code) {
    if (joinSig(load(), code) !== lastJoinSig) render();
  } else if (view === 'host' && code && !sub) {
    const s = findSession(load(), code);
    if (!s) return;
    document.querySelectorAll('[data-results]').forEach(el => {
      const a = s.activities.find(x => x.id === el.dataset.results);
      if (a) el.innerHTML = resultsHTML(s, a, false);
    });
  }
});

window.addEventListener('hashchange', () => { render(); focusHeading(); });
render();
