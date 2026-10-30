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

  // The home page loads this page's data ahead (CFL_app.js); use it once if it's fresh and for this login
  function takeLoaded(id) {
    try {
      const k = 'cfl_tool_' + id;
      const o = JSON.parse(sessionStorage.getItem(k) || 'null');
      sessionStorage.removeItem(k);
      if (o && o.token === load(TOKEN_KEY) && Date.now() - o.at < 3 * 60000 && o.r && o.r.ok) return o.r;
    } catch (e) { }
    return null;
  }

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
    store('cfl_home', null);
    try { Object.keys(sessionStorage).filter(k => k.indexOf('cfl_tool_') === 0).forEach(k => sessionStorage.removeItem(k)); } catch (e) { }
    await api('logout');
    store(TOKEN_KEY, null);
    store(EMAIL_KEY, null);
    goHome();
  }

  // Thin bar at the top of every questionnaire page: "back to main page", who is logged in, "logout"
  function addBar(name) {
    if (document.getElementById('cflBar')) return;
    const linkCss = 'color:#5E6A41;font-weight:500;text-decoration:none;background:none;border:0;padding:0;cursor:pointer;font-size:15px';
    // a thin bar that stays at the top while scrolling: the way home is always one tap away
    const bar = document.createElement('div');
    bar.id = 'cflBar';
    bar.className = 'noprint';
    bar.style.cssText = 'position:sticky;top:0;z-index:9000;background:rgba(250,249,245,.96);border-bottom:1px solid #DCD7CA;direction:rtl;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)';
    const inner = document.createElement('div');
    inner.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;max-width:860px;margin:0 auto;padding:6px 20px;font-size:14px;color:#6E6A5F;line-height:1.4';
    const home = document.createElement('a');
    home.href = 'index.html';
    home.textContent = '→ לעמוד הראשי';
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
    inner.append(home, side);
    bar.append(inner);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  // ---------- wording by לשון פניה ----------
  // Turns "את/ה", "חשב/י", "מומחה/ית" etc. into the chosen form. Only the page's own text is changed,
  // never what the user typed (inputs and text areas are left alone).
  const FIN = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  function genderText(s, g) {
    if (g !== 'f' && g !== 'm') return s;
    s = String(s).replace(/את\/ה/g, g === 'f' ? 'את' : 'אתה');
    if (g === 'm') s = s.replace(/אלייך/g, 'אליך');
    return s.replace(/([א-ת]+)\/(ית|ה|י|ת)(?![א-ת])/g, (m, base, suf) => {
      if (g === 'm') return base;
      if (base.endsWith('ה') && (suf === 'י' || suf === 'ית')) return base.slice(0, -1) + suf;
      if (suf === 'ה' && base.length > 1 && base.endsWith('ו')) return base.slice(0, -1) + 'ה'; // לו/ה -> לה, עצמו/ה -> עצמה
      const last = base.slice(-1);
      return (FIN[last] ? base.slice(0, -1) + FIN[last] : base) + suf;
    });
  }
  function genderTree(root, g) {
    if (!root || (g !== 'f' && g !== 'm')) return;
    if (root.nodeType === 3) { if (root.nodeValue.indexOf('/') > -1) { const v = genderText(root.nodeValue, g); if (v !== root.nodeValue) root.nodeValue = v; } return; }
    if (root.nodeType !== 1 || root.closest('textarea,script,style')) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentNode && n.parentNode.closest('textarea,script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => { if (n.nodeValue.indexOf('/') > -1) { const v = genderText(n.nodeValue, g); if (v !== n.nodeValue) n.nodeValue = v; } });
    const withPh = root.matches && root.matches('[placeholder]') ? [root] : [];
    withPh.concat([...root.querySelectorAll('[placeholder]')]).forEach(e => {
      const v = genderText(e.getAttribute('placeholder'), g); if (v !== e.getAttribute('placeholder')) e.setAttribute('placeholder', v);
    });
  }
  let genderWatch = null;
  function applyGender(g) {
    if (g !== 'f' && g !== 'm') return;
    genderTree(document.body, g);
    if (genderWatch) return;
    genderWatch = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => genderTree(n.nodeType === 3 ? n : n, g))));
    genderWatch.observe(document.body, { childList: true, subtree: true });
  }

  // ---------- read-only view for the staff site ----------
  // The יועצים site shows this same page inside its own page and hands over the נועץ's saved answers with
  // postMessage. Only a parent page on the same site is accepted; nothing goes to the server.
  //   <page>#view          -> the summary screen ("סיכום לנועץ")
  //   <page>#view-answers  -> the questionnaire itself with the answers filled in ("תשובות הנועץ")
  //   <page>#view-analysis -> the page's analysis for the יועץ, where it has one (שאלון הכניסה)
  const VIEW = /(^|[#&])view(-answers|-analysis)?\b/.test(location.hash) && window.parent !== window;
  const VIEW_MODE = /(^|[#&])view-answers\b/.test(location.hash) ? 'answers'
    : /(^|[#&])view-analysis\b/.test(location.hash) ? 'analysis' : 'results';
  function waitForStaffPage() {
    return new Promise(resolve => {
      window.addEventListener('message', e => {
        if (e.source !== window.parent || e.origin !== location.origin) return;
        const d = e.data || {};
        if (d.type !== 'cfl-view') return;
        resolve({ ok: true, status: 'submitted', view: true, viewMode: VIEW_MODE, saved: d.state,
          submittedAt: d.submittedAt || '', updatedAt: d.updatedAt || '', name: d.name || '', gender: d.gender || '' });
      });
      window.parent.postMessage({ type: 'cfl-view-ready' }, location.origin);
    });
  }

  const CFL = {
    view: VIEW,
    gender: '',
    genderText: s => genderText(s, CFL.gender),
    name: '',
    email: load(EMAIL_KEY) || '',

    /** Browser storage key for this user's draft of a questionnaire (the home page uses the same key). */
    draftKey(id) { return 'cfl_draft_' + CFL.email + '_' + id; },

    /** Call once when the page opens. Resolves with { status: 'open' | 'submitted', saved, submittedAt, name }. */
    async start(id) {
      if (VIEW) {
        const info = await waitForStaffPage();
        CFL.name = info.name; CFL.gender = info.gender;
        document.documentElement.classList.add('cfl-view');
        applyGender(CFL.gender);
        return info;
      }
      if (CFL_API_URL.indexOf('PASTE_') === 0) { fatal('האתר עדיין לא חובר לשרת (CFL_config.js).'); return NEVER; }
      if (!load(TOKEN_KEY)) { goHome(); return NEVER; }
      const r = takeLoaded(id) || await api('getTool', { id: id });
      if (r.auth === false) { store(TOKEN_KEY, null); goHome(); return NEVER; }
      if (r.privacy) { goHome(); return NEVER; } // the privacy approval is on the home page
      if (!r.ok) { fatal(r.message); return NEVER; }
      CFL.name = r.name || '';
      CFL.gender = r.gender || '';
      if (r.email && r.email !== CFL.email) { CFL.email = r.email; store(EMAIL_KEY, r.email); }
      addBar(CFL.name);
      applyGender(CFL.gender);
      return r;
    },

    /** What this נועץ sent in other questionnaires (only their own): { id: { status, saved, … } }. */
    async mine(ids) {
      if (VIEW) return {};
      const r = await api('tools', { ids: ids });
      return r && r.ok ? r.tools || {} : {};
    },

    /** Sends the answers. state = raw answers (to show the results again later),
     *  summary = the text for HR, fields = extra display columns. Resolves with { ok, message }. */
    async submit(id, state, summary, fields) {
      const r = await api('submitTool', { id: id, state: state, summary: summary, fields: fields || {} });
      if (r.auth === false) { store(TOKEN_KEY, null); goHome(); return NEVER; }
      if (r.privacy) { goHome(); return NEVER; }
      if (r.ok) store(CFL.draftKey(id), null);
      return r;
    },

    /** Box at the top of the summary once the questionnaire was sent. unsent = there are edits not sent yet. */
    sentNote(submittedAt, updatedAt, unsent) {
      const n = document.createElement('div');
      n.className = 'cfl-sent noprint';
      if (VIEW) { n.hidden = true; return n; } // the יועצים page shows its own heading
      n.style.cssText = 'background:' + (unsent ? '#FBF6F2' : '#F4F5EF') + ';border-right:4px solid ' + (unsent ? '#9C6B4F' : '#5E6A41') +
        ';padding:12px 16px;margin:18px 0;font-size:16px;direction:rtl';
      const b = document.createElement('b');
      if (unsent) {
        b.textContent = 'יש שינויים שעוד לא נשלחו. ';
        n.append(b, document.createTextNode('כדי שיישמרו, לחצו על "שליחת העדכון".'));
      } else {
        const when = updatedAt && updatedAt !== submittedAt ? ' (עודכנו ' + updatedAt + ')' : (submittedAt ? ' (' + submittedAt + ')' : '');
        b.textContent = 'התשובות נשלחו' + when + '. ';
        n.append(b, document.createTextNode('אפשר לחזור לתשובות ולעדכן אותן בכל זמן, דרך "הסתכל בתשובות".'));
      }
      return n;
    },

    /** A questionnaire that was sent and then closed by a יועץ: a note + a switch between the summary and
     *  the answers (both read-only). onSummary / onAnswers draw each one. */
    readOnlyBar(onSummary, onAnswers) {
      const box = document.createElement('div');
      box.id = 'cflReadOnly';
      box.className = 'noprint';
      box.style.cssText = 'max-width:860px;margin:6px auto 0;padding:12px 20px;direction:rtl;font-size:15px;color:#6E6A5F;' +
        'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:#F4F5EF;border-right:4px solid #5E6A41';
      const note = document.createElement('span');
      note.textContent = 'השאלון סגור לעריכה. אפשר לצפות בסיכום ובתשובות.';
      const segs = document.createElement('span');
      segs.style.cssText = 'display:flex;gap:6px';
      const mk = (label, on, go) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = label; b.dataset.on = on ? '1' : '';
        const paint = () => { const o = b.dataset.on === '1'; b.style.cssText = 'font:inherit;font-size:14px;padding:6px 14px;cursor:pointer;border:1px solid #5E6A41;' + (o ? 'background:#5E6A41;color:#fff' : 'background:#fff;color:#5E6A41'); };
        b.addEventListener('click', () => { segs.querySelectorAll('button').forEach(x => { x.dataset.on = ''; }); b.dataset.on = '1'; segs.querySelectorAll('button').forEach(x => x._paint()); go(); window.scrollTo(0, 0); });
        b._paint = paint; paint();
        return b;
      };
      segs.append(mk('סיכום', true, onSummary), mk('התשובות שלי', false, onAnswers));
      box.append(note, segs);
      const bar = document.getElementById('cflBar');
      if (bar) bar.after(box); else document.body.insertBefore(box, document.body.firstChild);
      return box;
    },

    /** Replaces (or adds) the sent note at the top of a container. */
    showSentNote(container, submittedAt, updatedAt, unsent) {
      const old = container.querySelector('.cfl-sent');
      const n = CFL.sentNote(submittedAt, updatedAt, unsent);
      if (old) old.replaceWith(n); else container.insertBefore(n, container.firstChild);
    }
  };

  window.CFL = CFL;
})();
