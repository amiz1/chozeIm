// חוזה עם החיים (CFL) – צד לקוח

// The server address is set in CFL_config.js
const TOKEN_KEY = 'cfl_token';
const EMAIL_KEY = 'cfl_email';

const app = document.getElementById('app');
const logoutBtn = document.getElementById('logoutBtn');
const homeBtn = document.getElementById('homeBtn');
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
    res = await fetch(CFL_API_URL, {
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
  app.replaceChildren(...nodes.filter(n => n !== null && n !== undefined));
  app.dataset.view = ''; // which screen is showing (set by the home page, so a late refresh doesn't draw over another screen)
  homeBtn.hidden = logoutBtn.hidden; // signed in: a way back home from any screen (the home page hides it again)
  window.scrollTo(0, 0);
}

// ===================== Remembering the last answers from the server (makes the site feel fast) =====================
// The home page is drawn at once from the last visit and refreshed in the background. Questionnaire pages are
// loaded ahead while you're on the home page. Everything is tied to the current login.
const HOME_CACHE = 'cfl_home';
const TOOL_CACHE = 'cfl_tool_'; // + id, in this tab only (sessionStorage), read by CFL_bridge.js
function cacheGet(key) {
  try {
    const o = JSON.parse(localStorage.getItem(key) || 'null');
    return o && o.token === load(TOKEN_KEY) ? o.r : null;
  } catch (e) { return null; }
}
function cachePut(key, r, session) {
  try { (session ? sessionStorage : localStorage).setItem(key, JSON.stringify({ token: load(TOKEN_KEY), at: Date.now(), r: r })); } catch (e) { }
}
function clearToolCaches() {
  try { Object.keys(sessionStorage).filter(k => k.indexOf(TOOL_CACHE) === 0).forEach(k => sessionStorage.removeItem(k)); } catch (e) { }
}
function clearCaches() {
  store(HOME_CACHE, null);
  clearToolCaches();
}
async function prefetchTools(r) {
  const ids = r.questionnaires.filter(q => q.type === 'tool').map(q => q.id);
  if (!ids.length) return;
  const x = await api('tools', { ids: ids });
  if (x.ok) ids.forEach(id => { if (x.tools[id] && x.tools[id].ok) cachePut(TOOL_CACHE + id, x.tools[id], true); });
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
  homeBtn.hidden = true;
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

// Two radio buttons: בלשון נקבה / בלשון זכר
function genderPicker() {
  const opt = (value, label) => el('label', { class: 'option' },
    el('input', { type: 'radio', name: 'gender', value: value }), el('span', {}, label));
  const box = el('div', { class: 'options two', role: 'radiogroup' }, opt('f', 'בלשון נקבה'), opt('m', 'בלשון זכר'));
  return { box, value: () => { const c = box.querySelector('input:checked'); return c ? c.value : ''; } };
}

function showSignup() {
  const msg = el('div');
  const name = el('input', { type: 'text', autocomplete: 'name', required: true, maxlength: '60' });
  const email = el('input', { type: 'email', autocomplete: 'email', required: true, dir: 'ltr' });
  const gender = genderPicker();
  const btn = el('button', { type: 'submit', class: 'btn primary full' }, 'שלחו לי קוד כניסה');

  render(el('form', {
    class: 'card auth-card',
    onsubmit: async (e) => {
      e.preventDefault();
      msg.replaceChildren();
      if (!gender.value()) { msg.append(msgBox('יש לבחור איך נוח לך שנפנה אלייך')); return; }
      await withBusy(btn, async () => {
        const r = await api('signup', { name: name.value, email: email.value, gender: gender.value() });
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
    el('div', { class: 'field' }, el('span', {}, 'איך נוח לך שנפנה אלייך?'), gender.box),
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
  clearCaches();
  await api('logout');
  store(TOKEN_KEY, null);
  store(EMAIL_KEY, null);
  showLogin();
}
logoutBtn.addEventListener('click', logout);
homeBtn.addEventListener('click', () => showHome());

// ===================== Home page =====================
function draftKey(id) {
  return 'cfl_draft_' + (currentUser ? currentUser.email : '') + '_' + id;
}

let homeSeq = 0;
async function showHome(notice) {
  const seq = ++homeSeq;
  clearToolCaches(); // pages loaded ahead earlier may be out of date; they are loaded again below
  const cached = cacheGet(HOME_CACHE);
  if (cached) drawHome(cached, notice);
  else { loadingView(); app.dataset.view = 'home'; homeBtn.hidden = true; }
  const r = await api('home');
  if (seq !== homeSeq || app.dataset.view !== 'home') return; // another screen was opened meanwhile
  if (!r.ok) { if (!r.handled && !cached) errorView(r.message, () => showHome()); return; }
  cachePut(HOME_CACHE, r);
  prefetchTools(r);
  if (cached && JSON.stringify(cached) === JSON.stringify(r)) return; // nothing changed
  if (app.querySelector('button:disabled')) return; // an upload is running; keep the screen as it is
  drawHome(r, notice, !!cached);
}

function drawHome(r, notice, keepScroll) {
  const y = window.scrollY;
  currentUser = { name: r.name, email: r.email };
  store(EMAIL_KEY, r.email); // questionnaire pages use it to keep each user's draft separate
  logoutBtn.hidden = false;

  // The privacy policy is approved once (and again if it changes) before anything else
  if (r.privacyNeeded) { showPrivacyApproval(r); app.dataset.view = 'home'; homeBtn.hidden = true; return; }
  // Signed up before 'לשון פניה' existed: ask once, then every questionnaire uses it
  if (!r.gender) { showGenderQuestion(r.name); app.dataset.view = 'home'; homeBtn.hidden = true; return; }

  const cards = r.questionnaires.map(q => {
    let badge, action = null;
    const isTool = q.type === 'tool';
    if (q.status === 'submitted' && q.readOnly) {
      badge = el('span', { class: 'badge submitted' }, 'נשלח · לצפייה בלבד');
      action = el('button', { type: 'button', class: 'btn secondary small', onclick: () => openPage(q.page) }, 'צפייה');
    } else if (q.status === 'submitted') {
      badge = el('span', { class: 'badge submitted' }, 'נשלח');
      action = el('button', { type: 'button', class: 'btn secondary small',
        onclick: () => isTool ? openPage(q.page) : showAnswers(q.id) }, isTool ? 'צפייה בתוצאות' : 'צפייה בתשובות');
    } else if (q.status === 'open') {
      badge = el('span', { class: 'badge open' }, 'פתוח למילוי');
      const hasDraft = !!load(draftKey(q.id));
      action = el('button', { type: 'button', class: 'btn primary small',
        onclick: () => isTool ? openPage(q.page) : showQuestionnaire(q.id) },
        hasDraft ? 'המשך מילוי' : 'למילוי');
    } else {
      badge = el('span', { class: 'badge locked' }, 'ייפתח בהמשך');
    }
    return el('div', { class: 'q-card ' + q.status + (q.readOnly ? ' readonly' : '') },
      el('div', { class: 'q-text' }, el('div', { class: 'q-title' }, el('h3', {}, q.title), badge),
        q.description ? el('p', {}, q.description) : null),
      action ? el('div', { class: 'actions' }, action) : null);
  });

  render(
    notice ? msgBox(notice, 'success') : null,
    el('h1', {}, 'שלום, ' + r.name),
    cvCard(r.cv),
    feedbackCard(r.feedback),
    el('h2', { class: 'section-title' }, 'השאלונים שלך'),
    cards.length ? el('div', { class: 'q-list' }, cards)
      : el('p', { class: 'muted' }, 'עדיין אין שאלונים פתוחים. שאלונים חדשים ייפתחו לאורך התהליך.'),
    cards.length ? el('p', { class: 'muted small' }, 'שאלונים נוספים ייפתחו לאורך התהליך.') : null
  );
  app.dataset.view = 'home';
  homeBtn.hidden = true; // already home
  if (keepScroll) window.scrollTo(0, y);
}

// ===================== Feedback from the יועצים =====================
// Each feedback a יועץ sent by mail is kept here too, to reread any time.
const fmtDay = at => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(at || '')); return m ? (+m[3]) + '.' + (+m[2]) + '.' + m[1] : String(at || ''); };
function feedbackCard(list) {
  if (!list || !list.length) return null;
  return el('div', { class: 'card fb-card' },
    el('h2', { class: 'fb-title' }, list.length > 1 ? 'משובים מהיועצים' : 'משוב מהיועצים'),
    el('div', { class: 'fb-list' }, list.map((f, i) => el('button', { type: 'button', class: 'fb-item', onclick: () => showFeedback(f.id) },
      el('span', {}, (i === 0 ? 'המשוב האחרון' : 'משוב') + ' · ' + fmtDay(f.at)), el('span', { class: 'fb-open' }, 'לקריאה ←')))));
}
// the text as written: "## " lines are headings, **x** is bold, blank lines split paragraphs (no HTML from the text)
function feedbackBody(text) {
  return el('div', { class: 'fb-body' }, String(text).replace(/\r/g, '').split(/\n{2,}/).map(b => {
    const lines = b.split('\n');
    const inline = s => s.split(/\*\*(.+?)\*\*/g).map((part, k) => k % 2 ? el('b', {}, part) : part);
    if (/^#{1,3} /.test(lines[0])) return el('div', {}, el('h3', {}, lines[0].replace(/^#{1,3} /, '')), lines.length > 1 ? el('p', {}, ...lines.slice(1).flatMap((l, k) => k ? [el('br'), ...inline(l)] : inline(l))) : null);
    return el('p', {}, ...lines.flatMap((l, k) => k ? [el('br'), ...inline(l)] : inline(l)));
  }));
}
async function showFeedback(id) {
  loadingView();
  app.dataset.view = 'feedback';
  homeBtn.hidden = false;
  const r = await api('myFeedback');
  if (!r.ok) { if (!r.handled) errorView(r.message, () => showHome()); return; }
  const f = (r.feedback || []).filter(x => x.id === id)[0] || (r.feedback || [])[0];
  if (!f) { errorView('המשוב לא נמצא.', () => showHome()); return; }
  render(
    el('div', { class: 'back' }, linkBtn('→ חזרה לעמוד הראשי', () => showHome())),
    el('h1', {}, 'משוב'),
    el('p', { class: 'sub' }, 'נשלח ב-' + fmtDay(f.at)),
    el('div', { class: 'card' }, feedbackBody(f.text))
  );
  window.scrollTo(0, 0);
}

// ===================== CV (קורות חיים) =====================
const CV_MAX = 5 * 1024 * 1024;
const CV_EXT = ['pdf', 'doc', 'docx'];

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function cvCard(cv) {
  const status = el('p', { class: 'cv-status' });
  const NOTE = 'PDF או Word, עד 5MB. נשמר באופן פרטי, ורק היועצים יכולים לצפות בו.';
  const msg = el('div');
  const paint = (c) => {
    status.replaceChildren(c
      ? el('span', {}, 'הקובץ שהועלה: ', el('bdi', {}, el('b', {}, c.name)), ' · ' + c.uploadedAt)
      : NOTE);
    btn.textContent = c ? 'החלפת הקובץ' : 'העלאת קורות חיים';
  };
  const input = el('input', {
    type: 'file', class: 'cv-input', 'aria-label': 'בחירת קובץ קורות חיים',
    accept: '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  const btn = el('button', { type: 'button', class: 'btn primary small', onclick: () => input.click() });
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    msg.replaceChildren();
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (CV_EXT.indexOf(ext) === -1) { msg.append(msgBox('אפשר להעלות קובץ PDF או Word בלבד.')); return; }
    if (f.size > CV_MAX) { msg.append(msgBox('הקובץ גדול מ-5MB. נסו לשמור אותו כ-PDF קטן יותר.')); return; }
    let r;
    await withBusy(btn, async () => {
      btn.textContent = 'מעלה…';
      let data;
      try { data = await readBase64(f); } catch (e) { r = { ok: false, message: 'לא הצלחנו לקרוא את הקובץ.' }; return; }
      r = await api('cvUpload', { name: f.name, data: data });
    });
    if (!r || !r.ok) { if (r && !r.handled) msg.append(msgBox(r.message)); return; }
    paint(r.cv);
    msg.append(msgBox('הקובץ נשמר. תודה!', 'success'));
  });
  paint(cv);
  return el('div', { class: 'card cv-card' },
    el('div', { class: 'cv-row' },
      el('div', { class: 'q-text' }, el('h3', {}, 'קורות חיים'), status),
      el('div', { class: 'actions' }, btn)),
    msg, input);
}

// A questionnaire with its own page (like עוגני קריירה)
function openPage(page) {
  location.href = page;
}

function showPrivacyApproval(r) {
  const w = (f, m, x) => r.gender === 'f' ? f : r.gender === 'm' ? m : x;
  const msg = el('div');
  const box = el('input', { type: 'checkbox', id: 'pv_ok' });
  const btn = el('button', { type: 'submit', class: 'btn primary', disabled: true }, 'אישור והמשך');
  box.addEventListener('change', () => { btn.disabled = !box.checked; });
  render(
    el('h1', {}, 'שלום, ' + r.name),
    el('form', {
      class: 'card privacy-approval',
      onsubmit: async (e) => {
        e.preventDefault();
        msg.replaceChildren();
        if (!box.checked) { msg.append(msgBox('יש לסמן את תיבת האישור')); return; }
        await withBusy(btn, async () => {
          const res = await api('acceptPrivacy', { agree: true });
          if (!res.ok) { if (!res.handled) msg.append(msgBox(res.message)); return; }
          store(HOME_CACHE, null);
          showHome();
        });
      }
    },
      el('h2', {}, 'לפני שמתחילים: פרטיות'),
      el('p', {}, 'כדי ללוות ' + w('אותך', 'אותך', 'אותך') + ' בתהליך, נשמור את מה ש' + w('תכתבי', 'תכתוב', 'תכתבו') + ' באתר. בקצרה:'),
      el('ul', { class: 'privacy-points' },
        el('li', {}, 'התשובות לשאלונים, וקורות החיים אם ' + w('תעלי', 'תעלה', 'תעלו') + ' אותם, נשמרים ב-Google Sheets וב-Google Drive של מפעילי האתר.'),
        el('li', {}, 'רק היועצים שבמערכת יכולים לראות אותם. המידע לא נמכר ולא מועבר לאף אחד אחר.'),
        el('li', {}, 'היועצים עשויים להיעזר ב-Claude (בינה מלאכותית של Anthropic) כדי לחשוב על התהליך ולנסח משוב. ההחלטות נשארות אצלם.'),
        el('li', {}, 'המייל משמש לקוד הכניסה, להודעות על שאלונים חדשים ולתזכורות, ולמשוב מהיועצים. בלי פרסום.'),
        el('li', {}, 'אפשר לבקש בכל זמן לעיין במידע, לתקן או למחוק אותו: chozeimhachyim@gmail.com.')),
      el('p', {}, el('a', { href: 'CFL_privacy.html', target: '_blank', rel: 'noopener' }, 'למדיניות הפרטיות המלאה')),
      el('label', { class: 'check privacy-check', for: 'pv_ok' }, box,
        ' ' + w('קראתי את מדיניות הפרטיות, ואני מסכימה', 'קראתי את מדיניות הפרטיות, ואני מסכים', 'קראתי את מדיניות הפרטיות, ואני מסכים/ה') + ' שהמידע שלי יישמר וישמש את היועצים בתהליך.'),
      msg, el('div', { style: 'margin-top:16px' }, btn))
  );
}

function showGenderQuestion(name) {
  const msg = el('div');
  const gender = genderPicker();
  const btn = el('button', { type: 'submit', class: 'btn primary' }, 'המשך');
  render(
    el('h1', {}, 'שלום, ' + name),
    el('form', {
      class: 'card',
      onsubmit: async (e) => {
        e.preventDefault();
        msg.replaceChildren();
        if (!gender.value()) { msg.append(msgBox('יש לבחור אחת מהאפשרויות')); return; }
        await withBusy(btn, async () => {
          const r = await api('setGender', { gender: gender.value() });
          if (!r.ok) { if (!r.handled) msg.append(msgBox(r.message)); return; }
          store(HOME_CACHE, null); // the saved home page is from before the choice
          showHome();
        });
      }
    },
      el('h2', {}, 'לפני שמתחילים: איך נוח לך שנפנה אלייך?'),
      el('p', { class: 'sub' }, 'כל השאלונים ינוסחו בהתאם.'),
      msg, gender.box, el('div', { style: 'margin-top:16px' }, btn))
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
if (CFL_API_URL.indexOf('PASTE_') === 0) {
  render(msgBox('האתר עדיין לא חובר לשרת: יש להדביק את כתובת ה-Web App בקובץ CFL_config.js.'));
} else if (load(TOKEN_KEY)) {
  showHome();
} else {
  showLogin();
  // wake the server up while the person types, so the first answer comes faster
  try { fetch(CFL_API_URL, { mode: 'no-cors' }).catch(() => { }); } catch (e) { }
}
