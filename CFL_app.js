// חוזה עם החיים (CFL) – צד לקוח

// ===================== Settings =====================
// Paste the Apps Script web app URL here (ends with /exec)
const API_URL = 'https://script.google.com/macros/s/AKfycbwC8VvcGZVy7fv5SRa_Kp7GJlGTPgkaQYVfV-unUmsnCvM0kvfH3e0QdC7fSVdwuwBE/exec';
const TOKEN_KEY = 'cfl_token';

const app = document.getElementById('app');
const logoutBtn = document.getElementById('logoutBtn');
let currentUser = null; // { name, email } after the home page loads

// ===================== Browser storage =====================
function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) { /* private mode etc. – the site still works, it just won't remember */ }
}
function load(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

// ===================== Talking to the server =====================
async function api(action, data) {
  const body = Object.assign({ action: action, token: load(TOKEN_KEY) }, data || {});
  let res;
  try {
    // text/plain keeps this a "simple" request, so the browser doesn't block the reply from Google
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    return { ok: false, message: 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.' };
  }
  let out;
  try { out = await res.json(); } catch (e) {
    return { ok: false, message: 'תקלה בשרת. נסו שוב מאוחר יותר.' };
  }
  if (out.auth === false) {
    // the saved login is no longer valid – back to the login screen
    store(TOKEN_KEY, null);
    showLogin({ message: out.message });
    return { ok: false, handled: true };
  }
  return out;
}

// ===================== Building the page =====================
function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function render(...nodes) {
  app.replaceChildren(...nodes);
  window.scrollTo(0, 0);
}

function msgBox(text, kind) {
  return el('div', { class: 'msg ' + (kind || 'error'), role: 'alert' }, text);
}

function field(label, input) {
  return el('label', { class: 'field' }, el('span', {}, label), input);
}

function linkBtn(text, onclick) {
  return el('button', { type: 'button', class: 'link-btn', onclick: onclick }, text);
}

function loadingView() {
  render(el('p', { class: 'loading' }, 'טוען…'));
}

function errorView(message, retry) {
  render(el('div', { class: 'card' }, msgBox(message),
    el('button', { type: 'button', class: 'btn secondary', onclick: retry }, 'נסו שוב')));
}

async function withBusy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'רגע…';
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = label; }
}

// ===================== Login / signup / forgot code =====================
function showLogin(opts) {
  opts = opts || {};
  currentUser = null;
  logoutBtn.hidden = true;
  const msg = el('div');
  if (opts.message) msg.append(msgBox(opts.message));
  if (opts.info) msg.append(msgBox(opts.info, 'info'));

  const email = el('input', { type: 'email', autocomplete: 'email', required: true, dir: 'ltr', value: opts.email || '' });
  const code = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', required: true, dir: 'ltr' });
  const btn = el('button', { type: 'submit', class: 'btn primary full' }, 'כניסה');

  const form = el('form', {
    class: 'card auth-card',
    onsubmit: async (e) => {
      e.preventDefault();
      msg.replaceChildren();
      await withBusy(btn, async () => {
        const r = await api('login', { email: email.value, code: code.value });
        if (!r.ok) { if (!r.handled) msg.append(msgBox(r.message)); return; }
        store(TOKEN_KEY, r.token);
        showHome();
      });
    }
  },
    el('h1', {}, 'כניסה'),
    el('p', { class: 'sub' }, 'הזינו את האימייל ואת הקוד שקיבלתם במייל.'),
    msg,
    field('אימייל', email),
    field('קוד כניסה (6 ספרות)', code),
    btn,
    el('div', { class: 'links' },
      linkBtn('הרשמה ראשונה', () => showSignup()),
      linkBtn('שכחתי את הקוד', () => showForgot(email.value)))
  );
  render(form);
}

function showSignup() {
  const msg = el('div');
  const name = el('input', { type: 'text', autocomplete: 'name', required: true, maxlength: '60' });
  const email = el('input', { type: 'email', autocomplete: 'email', required: true, dir: 'ltr' });
  const btn = el('button', { type: 'submit', class: 'btn primary full' }, 'שלחו לי קוד כניסה');

  render(el('form', {
    class: 'card auth-card',
    onsubmit: async (e) => {
      e.preventDefault();
      msg.replaceChildren();
      await withBusy(btn, async () => {
        const r = await api('signup', { name: name.value, email: email.value });
        if (!r.ok) { if (!r.handled) msg.append(msgBox(r.message)); return; }
        showLogin({ email: email.value.trim(), info: 'קוד הכניסה נשלח למייל שלך. בדקו גם בתיבת הספאם.' });
      });
    }
  },
    el('h1', {}, 'הרשמה'),
    el('p', { class: 'sub' }, 'נשלח אליך קוד כניסה במייל.'),
    msg,
    field('שם מלא', name),
    field('אימייל', email),
    btn,
    el('div', { class: 'links' }, linkBtn('כבר יש לי קוד', () => showLogin()))
  ));
}

function showForgot(prefill) {
  const msg = el('div');
  const email = el('input', { type: 'email', autocomplete: 'email', required: true, dir: 'ltr', value: prefill || '' });
  const btn = el('button', { type: 'submit', class: 'btn primary full' }, 'שלחו לי קוד חדש');

  render(el('form', {
    class: 'card auth-card',
    onsubmit: async (e) => {
      e.preventDefault();
      msg.replaceChildren();
      await withBusy(btn, async () => {
        const r = await api('resendCode', { email: email.value });
        if (!r.ok) { if (!r.handled) msg.append(msgBox(r.message)); return; }
        showLogin({ email: email.value.trim(), info: r.message });
      });
    }
  },
    el('h1', {}, 'קוד חדש'),
    el('p', { class: 'sub' }, 'נשלח קוד חדש לכתובת הרשומה. הקוד הקודם יפסיק לעבוד.'),
    msg,
    field('אימייל', email),
    btn,
    el('div', { class: 'links' }, linkBtn('חזרה לכניסה', () => showLogin()))
  ));
}

async function logout() {
  await api('logout');
  store(TOKEN_KEY, null);
  showLogin();
}
logoutBtn.addEventListener('click', logout);

// ===================== Home page =====================
function draftKey(id) {
  return 'cfl_draft_' + (currentUser ? currentUser.email : '') + '_' + id;
}

async function showHome(notice) {
  loadingView();
  const r = await api('home');
  if (!r.ok) { if (!r.handled) errorView(r.message, () => showHome()); return; }
  currentUser = { name: r.name, email: r.email };
  logoutBtn.hidden = false;

  const cards = r.questionnaires.map(q => {
    let badge, action = null;
    if (q.status === 'submitted') {
      badge = el('span', { class: 'badge submitted' }, 'נשלח');
      action = el('button', { type: 'button', class: 'btn secondary', onclick: () => showAnswers(q.id) }, 'צפייה בתשובות');
    } else if (q.status === 'open') {
      badge = el('span', { class: 'badge open' }, 'פתוח למילוי');
      const hasDraft = !!load(draftKey(q.id));
      action = el('button', { type: 'button', class: 'btn primary', onclick: () => showQuestionnaire(q.id) },
        hasDraft ? 'המשך מילוי' : 'למילוי');
    } else {
      badge = el('span', { class: 'badge locked' }, 'ייפתח בהמשך');
    }
    return el('div', { class: 'card q-card' + (q.status === 'locked' ? ' locked' : '') },
      el('div', {}, badge, el('h2', {}, q.title), q.description ? el('p', {}, q.description) : null),
      action ? el('div', { class: 'actions' }, action) : null);
  });

  render(
    notice ? msgBox(notice, 'success') : null,
    el('h1', {}, 'שלום, ' + r.name),
    el('p', { class: 'sub' }, 'אלה השאלונים שלך. שאלונים חדשים ייפתחו לאורך התהליך.'),
    el('div', { class: 'q-list' }, cards)
  );
}

// ===================== Filling a questionnaire =====================
function renderQuestion(item, value, index) {
  const name = 'q_' + item.id;
  const wrap = el('fieldset', { class: 'question', 'data-qid': item.id });
  wrap.append(el('legend', {}, (index + 1) + '. ' + item.label,
    item.required ? el('span', { class: 'req', title: 'שאלת חובה' }, ' *') : null));
  if (item.help) wrap.append(el('p', { class: 'help' }, item.help));

  if (item.type === 'text') {
    wrap.append(el('input', { type: 'text', name: name, maxlength: '500', value: value || '' }));
  } else if (item.type === 'textarea') {
    const t = el('textarea', { name: name, rows: '4', maxlength: '5000' });
    t.value = value || '';
    wrap.append(t);
  } else if (item.type === 'radio' || item.type === 'yesno') {
    const opts = item.type === 'yesno' ? ['כן', 'לא'] : item.options;
    wrap.append(el('div', { class: 'options' }, opts.map(o =>
      el('label', { class: 'option' },
        el('input', { type: 'radio', name: name, value: o, checked: value === o }),
        el('span', {}, o)))));
  } else if (item.type === 'checkbox') {
    const chosen = Array.isArray(value) ? value : [];
    wrap.append(el('div', { class: 'options' }, item.options.map(o =>
      el('label', { class: 'option' },
        el('input', { type: 'checkbox', name: name, value: o, checked: chosen.includes(o) }),
        el('span', {}, o)))));
  } else if (item.type === 'scale') {
    const nums = [];
    for (let n = item.min; n <= item.max; n++) nums.push(n);
    wrap.append(el('div', { class: 'scale' },
      item.minLabel ? el('span', { class: 'scale-end' }, item.minLabel) : null,
      el('div', { class: 'scale-nums' }, nums.map(n =>
        el('label', { class: 'scale-opt' },
          el('input', { type: 'radio', name: name, value: String(n), checked: String(value) === String(n), 'aria-label': String(n) }),
          el('span', {}, String(n))))),
      item.maxLabel ? el('span', { class: 'scale-end' }, item.maxLabel) : null));
  }
  wrap.append(el('p', { class: 'q-error' }));
  return wrap;
}

function collectAnswers(form, questions) {
  const answers = {};
  for (const item of questions) {
    const name = 'q_' + item.id;
    if (item.type === 'text' || item.type === 'textarea') {
      answers[item.id] = form.querySelector('[name="' + name + '"]').value;
    } else if (item.type === 'checkbox') {
      answers[item.id] = [...form.querySelectorAll('input[name="' + name + '"]:checked')].map(i => i.value);
    } else {
      const picked = form.querySelector('input[name="' + name + '"]:checked');
      answers[item.id] = picked ? picked.value : '';
    }
  }
  return answers;
}

function isEmpty(v) {
  return Array.isArray(v) ? v.length === 0 : String(v || '').trim() === '';
}

async function showQuestionnaire(id) {
  loadingView();
  const r = await api('getQuestionnaire', { id: id });
  if (!r.ok) { if (!r.handled) errorView(r.message, () => showHome()); return; }
  const q = r.questionnaire;
  const key = draftKey(id);

  let draft = {};
  try { draft = JSON.parse(load(key) || '{}'); } catch (e) { draft = {}; }

  const msg = el('div');
  const submitBtn = el('button', { type: 'submit', class: 'btn primary' }, 'שליחה');
  const form = el('form', { class: 'card', novalidate: true },
    q.questions.map((item, i) => renderQuestion(item, draft[item.id], i)),
    msg,
    el('div', { class: 'form-footer' }, submitBtn,
      el('span', { class: 'draft-note' }, 'התשובות נשמרות בדפדפן הזה עד השליחה.')));

  // Save a draft in this browser on every change
  form.addEventListener('input', () => store(key, JSON.stringify(collectAnswers(form, q.questions))));
  form.addEventListener('change', () => store(key, JSON.stringify(collectAnswers(form, q.questions))));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.replaceChildren();
    const answers = collectAnswers(form, q.questions);

    // Check required questions before sending
    let firstBad = null;
    for (const item of q.questions) {
      const box = form.querySelector('[data-qid="' + item.id + '"]');
      const bad = item.required && isEmpty(answers[item.id]);
      box.classList.toggle('invalid', bad);
      box.querySelector('.q-error').textContent = bad ? 'זו שאלת חובה' : '';
      if (bad && !firstBad) firstBad = box;
    }
    if (firstBad) {
      firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!confirm('לאחר השליחה לא ניתן יהיה לשנות את התשובות. לשלוח?')) return;

    await withBusy(submitBtn, async () => {
      const res = await api('submit', { id: id, answers: answers });
      if (!res.ok) { if (!res.handled) msg.append(msgBox(res.message)); return; }
      store(key, null);
      showHome('השאלון "' + q.title + '" נשלח בהצלחה. תודה!');
    });
  });

  render(
    el('div', { class: 'back' }, linkBtn('→ חזרה לשאלונים', () => showHome())),
    el('h1', {}, q.title),
    q.description ? el('p', { class: 'sub' }, q.description) : null,
    form
  );
}

// ===================== Viewing sent answers =====================
async function showAnswers(id) {
  loadingView();
  const r = await api('getAnswers', { id: id });
  if (!r.ok) { if (!r.handled) errorView(r.message, () => showHome()); return; }
  const q = r.questionnaire;

  render(
    el('div', { class: 'back' }, linkBtn('→ חזרה לשאלונים', () => showHome())),
    el('h1', {}, q.title),
    el('p', { class: 'sub' }, 'נשלח ב-' + r.submittedAt + '. אלה התשובות ששלחת (לצפייה בלבד).'),
    el('div', { class: 'card' }, q.questions.map((item, i) => {
      const v = r.answers[item.id];
      return el('div', { class: 'answer' },
        el('div', { class: 'a-label' }, (i + 1) + '. ' + item.label),
        el('div', { class: 'a-value' }, v === '' || v === undefined ? '—' : v));
    }))
  );
}

// ===================== Start =====================
if (API_URL.indexOf('PASTE_') === 0) {
  render(msgBox('האתר עדיין לא חובר לשרת: יש להדביק את כתובת ה-Web App בקובץ CFL_app.js.'));
} else if (load(TOKEN_KEY)) {
  showHome();
} else {
  showLogin();
}
