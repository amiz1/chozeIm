// חוזה עם החיים (CFL) – חיבור עמוד שאלון לאתר
// Each questionnaire page loads this file. It checks the login, tells the page whether the
// questionnaire is open or already sent, and sends the answers to the server.
(function () {
  const TOKEN_KEY = 'cfl_token';
  const EMAIL_KEY = 'cfl_email';
  const NEVER = new Promise(() => {}); // used after we redirect away, so the page stops waiting

  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) {
    try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { }
  }

  async function api(action, data) {
    const body = Object.assign({ action: action, token: load(TOKEN_KEY) }, data || {});
    let res;
    try {
      res = await fetch(CFL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      return { ok: false, message: 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.' };
    }
    try { return await res.json(); } catch (e) {
      return { ok: false, message: 'תקלה בשרת. נסו שוב מאוחר יותר.' };
    }
  }

  function goHome() { location.href = 'index.html'; }

  // Replaces the page with a short message and a way back (used when the page can't be used)
  function fatal(message) {
    document.body.innerHTML = '';
    const box = document.createElement('div');
    box.style.cssText = 'max-width:520px;margin:80px auto;padding:24px;text-align:center;direction:rtl;font-family:Arial,sans-serif;font-size:18px;color:#2B2B2B';
    const p = document.createElement('p');
    p.textContent = message;
    const a = document.createElement('a');
    a.href = 'index.html';
    a.textContent = 'חזרה לשאלונים';
    a.style.cssText = 'color:#5E6A41;font-weight:700';
    box.append(p, a);
    document.body.append(box);
  }

  async function logout() {
    await api('logout');
    store(TOKEN_KEY, null);
    store(EMAIL_KEY, null);
    goHome();
  }

  // Thin bar at the top of every questionnaire page: "back to main page", who is logged in, "logout"
  function addBar(name) {
    if (document.getElementById('cflBar')) return;
    const linkCss = 'color:#5E6A41;font-weight:500;text-decoration:none;background:none;border:0;padding:0;cursor:pointer;font-size:15px';
    const bar = document.createElement('div');
    bar.id = 'cflBar';
    bar.className = 'noprint';
    bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;max-width:860px;margin:0 auto;padding:12px 20px;font-size:15px;color:#6E6A5F;direction:rtl';
    const home = document.createElement('a');
    home.href = 'index.html';
    home.textContent = 'חזרה לעמוד הראשי';
    home.style.cssText = linkCss;
    const side = document.createElement('span');
    side.style.cssText = 'display:flex;gap:18px;align-items:center';
    const who = document.createElement('span');
    who.textContent = name || '';
    const out = document.createElement('button');
    out.type = 'button';
    out.textContent = 'יציאה';
    out.style.cssText = linkCss;
    out.addEventListener('click', logout);
    side.append(who, out);
    bar.append(home, side);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  const CFL = {
    name: '',
    email: load(EMAIL_KEY) || '',

    /** Browser storage key for this user's draft of a questionnaire (the home page uses the same key). */
    draftKey(id) { return 'cfl_draft_' + CFL.email + '_' + id; },

    /** Call once when the page opens. Resolves with { status: 'open' | 'submitted', saved, submittedAt, name }. */
    async start(id) {
      if (CFL_API_URL.indexOf('PASTE_') === 0) { fatal('האתר עדיין לא חובר לשרת (CFL_config.js).'); return NEVER; }
      if (!load(TOKEN_KEY)) { goHome(); return NEVER; }
      const r = await api('getTool', { id: id });
      if (r.auth === false) { store(TOKEN_KEY, null); goHome(); return NEVER; }
      if (!r.ok) { fatal(r.message); return NEVER; }
      CFL.name = r.name || '';
      if (r.email && r.email !== CFL.email) { CFL.email = r.email; store(EMAIL_KEY, r.email); }
      addBar(CFL.name);
      return r;
    },

    /** Sends the answers. state = raw answers (to show the results again later),
     *  summary = the text for HR, fields = extra display columns. Resolves with { ok, message }. */
    async submit(id, state, summary, fields) {
      const r = await api('submitTool', { id: id, state: state, summary: summary, fields: fields || {} });
      if (r.auth === false) { store(TOKEN_KEY, null); goHome(); return NEVER; }
      if (r.ok) store(CFL.draftKey(id), null);
      return r;
    },

    /** Grey box shown at the top of the results once the questionnaire was sent. */
    sentNote(submittedAt) {
      const n = document.createElement('div');
      n.className = 'cfl-sent noprint';
      n.style.cssText = 'background:#F4F5EF;border-right:4px solid #5E6A41;padding:12px 16px;margin:18px 0;font-size:16px;direction:rtl';
      const b = document.createElement('b');
      b.textContent = 'התשובות נשלחו' + (submittedAt ? ' (' + submittedAt + ')' : '') + '. ';
      n.append(b, document.createTextNode('זה העמוד שלך לצפייה בלבד. תודה!'));
      return n;
    }
  };

  window.CFL = CFL;
})();
