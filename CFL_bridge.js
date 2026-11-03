// חוזה עם החיים (CFL) – חיבור עמוד שאלון לאתר
// Each questionnaire page loads this file. It checks the login, tells the page whether the
// questionnaire is open or already sent, and sends the answers to the server.
(function () {
  const TOKEN_KEY = 'cfl_token';
  const EMAIL_KEY = 'cfl_email';
  // the logo's pen signing its circles (the same drawing is in CFL_app.js)
  const PEN_SVG = '<svg class="cfl-pen" viewBox="0 0 100 100" width="96" height="96" role="img" aria-label="רגע…" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cflPenG" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="#5E6A41"/><stop offset="0.65" stop-color="#9C9467"/><stop offset="1" stop-color="#E3D6B4"/></linearGradient></defs><style>.cfl-pen .r{fill:none;stroke:url(#cflPenG);stroke-linecap:round;stroke-dasharray:0 100;opacity:0;animation:cflPenR 3.6s ease-in-out infinite}.cfl-pen .r1{stroke-width:6.5}.cfl-pen .r2{stroke-width:5.5;animation-name:cflPenR2}.cfl-pen .r3{stroke-width:4.5;animation-name:cflPenR3}.cfl-pen .s{fill:none;stroke:#7A5236;stroke-width:1.4;stroke-linecap:round;stroke-dasharray:0 100;opacity:0;animation:cflPenS 3.6s linear infinite}.cfl-pen .p{opacity:0;animation:cflPenP 3.6s linear infinite}@keyframes cflPenR{0%{opacity:1;stroke-dasharray:0 100}24%{stroke-dasharray:75 100}86%{opacity:1;stroke-dasharray:75 100}100%{opacity:0;stroke-dasharray:75 100}}@keyframes cflPenR2{0%,9%{opacity:0;stroke-dasharray:0 100}10%{opacity:1}33%{stroke-dasharray:75 100}86%{opacity:1;stroke-dasharray:75 100}100%{opacity:0;stroke-dasharray:75 100}}@keyframes cflPenR3{0%,19%{opacity:0;stroke-dasharray:0 100}20%{opacity:1}42%{stroke-dasharray:75 100}86%{opacity:1;stroke-dasharray:75 100}100%{opacity:0;stroke-dasharray:75 100}}@keyframes cflPenS{0%,39%{opacity:0;stroke-dasharray:0 100}40%{opacity:1}72%{stroke-dasharray:100 100}86%{opacity:1;stroke-dasharray:100 100}100%{opacity:0;stroke-dasharray:100 100}}@keyframes cflPenP{0%,33%{opacity:0}40%{opacity:1}86%{opacity:1}100%{opacity:0}}@media (prefers-reduced-motion:reduce){.cfl-pen .r,.cfl-pen .s,.cfl-pen .p{animation:none;opacity:1;stroke-dasharray:75 100}.cfl-pen .s{stroke-dasharray:100 100}}</style><circle class="r r1" cx="50" cy="50" r="43" pathLength="100" transform="rotate(35 50 50)"/><circle class="r r2" cx="51.5" cy="52" r="32" pathLength="100" transform="rotate(35 51.5 52)"/><circle class="r r3" cx="53" cy="54" r="21" pathLength="100" transform="rotate(35 53 54)"/><path class="s" pathLength="100" d="M41 69 c2.5 -3 4.5 1.5 7 -1 s4.5 -4.5 7 -1.5 s4.5 3 8 -2.5"/><g class="p"><g transform="rotate(45) scale(1.35)"><path d="M-1.6 -6.5 L0 0 L1.6 -6.5 Z" fill="#7A5236"/><rect x="-2.1" y="-24" width="4.2" height="17" rx="2" fill="none" stroke="#7A5236" stroke-width="1.2"/><line x1="-2.1" y1="-10" x2="2.1" y2="-10" stroke="#7A5236" stroke-width="1"/></g><animateMotion dur="3.6s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;0.4;0.72;1" path="M41 69 c2.5 -3 4.5 1.5 7 -1 s4.5 -4.5 7 -1.5 s4.5 3 8 -2.5"/></g></svg>';
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
          submittedAt: d.submittedAt || '', updatedAt: d.updatedAt || '', name: d.name || '', gender: d.gender || '',
          response: d.response || '', responseAt: d.responseAt || '', summary: d.summary || '' });
      });
      window.parent.postMessage({ type: 'cfl-view-ready' }, location.origin);
    });
  }

  // ---------- a sent questionnaire, seen read-only (by the נועץ, or on the יועצים site) ----------
  // 1. Questions left unanswered are shaded (also questions added to the page after the sending).
  // 2. On the יועצים site: the text summary saved at the sending is compared with the one the page makes now from
  //    the same answers. Lines that are no longer made are answers the page can't show any more (it changed since):
  //    a warning, and a button that shows just those lines. (Not for the נועץ: the summary has parts meant for the
  //    יועץ only, and is never sent to the נועץ's browser.)
  function sentWatch(info) {
    shadeStart();
    // on the summary view (where the page draws everything the summary is made of), after it drew the answers
    if (VIEW && VIEW_MODE === 'results' && info.summary) setTimeout(() => lostCheck(info.summary), 1500);
  }
  function shadeEmpty() {
    const mark = (el, on) => { if (el && el.classList.contains('cfl-empty') !== on) el.classList.toggle('cfl-empty', on); };
    document.querySelectorAll('input[type=text], input:not([type]), input[type=number], input[type=email], input[type=tel], textarea, select').forEach(x => {
      if (x.closest('#cflReadOnly, #cflBar, .cfl-response, .cfl-lost, #cflSendBox, #cflFinal') || x.type === 'hidden') return;
      mark(x, !String(x.value || '').trim());
    });
    // choices: native radios by name, and the pages' own choice buttons (role=radio/checkbox) by their parent
    const groups = new Map();
    document.querySelectorAll('input[type=radio][name]').forEach(r => { const k = 'n:' + r.name; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    document.querySelectorAll('[role=radio][aria-checked]').forEach(r => { const k = r.parentElement; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    groups.forEach(list => {
      const none = !list.some(r => r.checked || r.getAttribute('aria-checked') === 'true');
      let box = list[0].parentElement; // the smallest box holding the whole group
      while (box && box !== document.body && !list.every(r => box.contains(r))) box = box.parentElement;
      if (box && box !== document.body) mark(box, none);
    });
  }
  let shadeOn = false;
  function shadeStart() {
    if (shadeOn) return; shadeOn = true;
    const css = document.createElement('style');
    css.textContent = '.cfl-empty{background-color:#EFEDE6!important;background-image:repeating-linear-gradient(135deg,rgba(0,0,0,.035) 0 6px,transparent 6px 12px)!important;outline:1px dashed #C9C4B5;outline-offset:2px}' +
      '.cfl-lost{max-width:860px;margin:10px auto 0;padding:12px 18px;direction:rtl;font-family:"Heebo",Arial,sans-serif;font-size:15px;line-height:1.6;background:#FBF6F2;border-right:4px solid #9C6B4F;color:#2B2B28;box-sizing:border-box}' +
      '.cfl-lost button{font:inherit;font-size:14px;margin-inline-start:8px;padding:4px 12px;cursor:pointer;border:1px solid #9C6B4F;background:#fff;color:#9C6B4F}' +
      '.cfl-lost pre{white-space:pre-wrap;font:inherit;margin:10px 0 0;padding:10px 12px;background:#fff;border:1px solid #E5D9CF}' +
      '@media print{.cfl-lost button{display:none}}';
    document.head.appendChild(css);
    let t = null;
    const run = () => { clearTimeout(t); t = setTimeout(shadeEmpty, 120); };
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
    run();
  }
  // the summary lines saved at the sending that the page doesn't make any more
  const lineOf = l => genderText(String(l), CFL.gender).replace(/\s+/g, ' ').trim(); // "חש/ה" and "חשה" are the same line
  function lostLines(saved, now) {
    const have = new Set(String(now || '').split('\n').map(lineOf));
    // (the name line is skipped: a name corrected later is not a change in the questionnaire)
    return String(saved || '').replace(/\r/g, '').split('\n').filter(l => { const x = lineOf(l); return x && !/^[\s\-–•·.:*←]*$/.test(x) && !/^שם:/.test(x) && !have.has(x); });
  }
  function summaryNow() {
    try {
      if (typeof window.CFL_SUMMARY === 'function') return String(window.CFL_SUMMARY() || '');
      if (window.CWL_CFG && typeof window.CWL_CFG.summary === 'function') return String(window.CWL_CFG.summary() || '');
    } catch (e) { }
    return null; // this page can't say: no check
  }
  function lostCheck(saved) {
    const now = summaryNow();
    if (now === null || document.querySelector('.cfl-lost')) return;
    const lost = lostLines(saved, now);
    if (!lost.length) return;
    const box = document.createElement('div');
    box.className = 'cfl-lost noprint';
    {
      const b = document.createElement('b'); b.textContent = 'השאלון השתנה מאז ששלחו אותו. ';
      const t = document.createTextNode(lost.length === 1 ? 'שורה אחת ממה שנשלח לא מופיעה בעמוד.' : lost.length + ' שורות ממה שנשלח לא מופיעות בעמוד.');
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'הצגת מה שחסר';
      const pre = document.createElement('pre'); pre.hidden = true; pre.textContent = lost.join('\n');
      btn.onclick = () => { pre.hidden = !pre.hidden; btn.textContent = pre.hidden ? 'הצגת מה שחסר' : 'הסתרה'; };
      box.append(b, t, btn, pre);
    }
    const top = document.getElementById('cflReadOnly') || document.getElementById('cflBar');
    if (top) top.after(box); else document.body.insertBefore(box, document.body.firstChild);
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
        sentWatch(info);
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
      if (r.status === 'submitted' && r.readOnly) sentWatch(r);
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

    /** The logo's pen signing its circles (an animated drawing), for while the נועץ waits. size in px. */
    pen(size) {
      const t = document.createElement('template'); t.innerHTML = PEN_SVG;
      const svg = t.content.firstChild;
      if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
      return svg;
    },

    /** While the answers are sent and the שיקוף is written (about half a minute): the pen draws, and a line says
     *  what is happening now; it changes as time passes, so it is clear the site is working. { node, stop() } */
    writingView() {
      const w = document.createElement('div'); w.id = 'cflWriting';
      w.style.cssText = 'text-align:center;padding:4px 0 6px;direction:rtl';
      const h = document.createElement('h3'); h.textContent = 'השיקוף האישי שלך נכתב עכשיו'; h.style.cssText = 'margin:4px 0 4px;font-size:21px;color:#2B2B28';
      const step = document.createElement('p'); step.className = 'cfl-step'; step.setAttribute('aria-live', 'polite');
      step.style.cssText = 'margin:0 0 6px;color:#5E6A41;font-weight:500;min-height:1.6em';
      const n = document.createElement('p'); n.textContent = 'זה לוקח בערך חצי דקה. אפשר להישאר בעמוד, השיקוף יופיע כאן.'; n.style.cssText = 'margin:0;color:#6E6A5F;font-size:15px';
      w.append(this.pen(110), h, step, n);
      step.textContent = 'שולחים את התשובות…';
      const timers = [[2500, 'קוראים את מה שכתבתם…'], [9000, 'כותבים את השיקוף האישי…'], [24000, 'עוד כמה שניות…'], [45000, 'לוקח קצת יותר מהרגיל. עוד רגע.']]
        .map(([t, text]) => setTimeout(() => { step.textContent = text; }, t));
      return { node: w, stop: () => timers.forEach(clearTimeout) };
    },

    /** Final sending with a warning first. send() does the sending and resolves with the server's answer.
     *  Resolves with that answer once it was sent (ok), or null when the נועץ stepped back. */
    finalSend(send) {
      return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.id = 'cflFinal';
        wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
        wrap.style.cssText = 'position:fixed;inset:0;background:rgba(20,20,15,.55);display:flex;align-items:flex-start;justify-content:center;z-index:9999;overflow:auto;padding:60px 14px;direction:rtl';
        const bx = document.createElement('div');
        bx.style.cssText = 'background:#fff;color:#2B2B28;max-width:480px;width:100%;border-top:5px solid #5E6A41;padding:22px 20px;font-family:"Heebo",Arial,sans-serif;font-size:17px;line-height:1.6;text-align:right';
        const h = document.createElement('h3'); h.textContent = 'שליחה סופית'; h.style.cssText = 'margin:0 0 8px;font-size:22px';
        const p1 = document.createElement('p'); p1.textContent = 'התשובות יגיעו רק אליי, ותקבלו מיד שיקוף אישי על מה שעלה בהן.'; p1.style.margin = '0 0 10px';
        const p2 = document.createElement('p'); p2.style.margin = '0 0 14px';
        const w = document.createElement('b'); w.textContent = 'אחרי השליחה לא יהיה אפשר לשנות את התשובות.'; w.style.color = '#9C6B4F';
        p2.append(w, document.createTextNode(' כדאי לעבור עליהן לפני שליחה.'));
        const btn = (label, primary) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
          b.style.cssText = 'display:block;width:100%;font:inherit;font-weight:700;padding:12px 16px;margin:0 0 8px;cursor:pointer;border:1px solid ' + (primary ? '#2B2B2B;background:#2B2B2B;color:#FAF9F5' : '#5E6A41;background:#fff;color:#5E6A41'); return b; };
        const go = btn('שליחה וקבלת השיקוף', true), back = btn('עוד רגע, אני רוצה לבדוק', false);
        const msg = document.createElement('p'); msg.setAttribute('aria-live', 'polite'); msg.style.cssText = 'margin:0;color:#9C6B4F;font-weight:500;min-height:1.2em';
        bx.append(h, p1, p2, go, back, msg); wrap.appendChild(bx); document.body.appendChild(wrap);
        let busy = false;
        const close = v => { wrap.remove(); resolve(v); };
        back.onclick = () => { if (!busy) close(null); };
        wrap.addEventListener('click', e => { if (e.target === wrap && !busy) close(null); });
        go.onclick = async () => {
          busy = true; go.disabled = back.disabled = true; go.textContent = 'שולח וכותב את השיקוף האישי…';
          [h, p1, p2, go, back].forEach(x => { x.dataset.d = x.style.display; x.style.display = 'none'; }); msg.textContent = '';
          const writing = this.writingView(); bx.insertBefore(writing.node, msg);
          let r;
          try { r = await send(); } catch (e) { r = { ok: false }; }
          writing.stop();
          busy = false;
          if (r && r.ok) { close(r); return; }
          writing.node.remove(); [h, p1, p2, go, back].forEach(x => { x.style.display = x.dataset.d || ''; });
          go.disabled = back.disabled = false; go.textContent = 'שליחה וקבלת השיקוף';
          msg.style.color = '#9C6B4F'; msg.textContent = (r && r.message) || 'השליחה לא הצליחה. נסו שוב.';
        };
        go.focus();
      });
    },

    /** The personal response (Claude's שיקוף) as a card. state: 'wait' (before sending), 'writing', 'later'
     *  (sent, not written yet), 'none' (יועצים site, nothing written), or the text itself. Fills el (made if missing). */
    responseCard(el, state, at) {
      if (!el) { el = document.createElement('div'); el.className = 'cfl-response'; }
      el.textContent = '';
      el.dataset.state = /^(wait|writing|later|none)$/.test(state) ? state : 'text';
      const h = document.createElement('h3');
      h.textContent = VIEW ? 'השיקוף האישי שהנועץ/ת קיבל/ה' : 'השיקוף האישי שלך';
      if (VIEW) h.textContent = genderText(h.textContent, CFL.gender);
      el.appendChild(h);
      const p = t => { const x = document.createElement('p'); x.textContent = t; el.appendChild(x); return x; };
      if (state === 'wait') p('אחרי שתשלחו את התשובות, ייכתב כאן שיקוף אישי על מה שעלה בהן.').className = 'm';
      else if (state === 'writing') { el.appendChild(this.pen(80)); p('כותב את השיקוף האישי… זה לוקח בערך חצי דקה.').className = 'm'; }
      else if (state === 'later') p('התשובות נשלחו. השיקוף האישי עוד לא מוכן. הוא יופיע כאן כשתחזרו לעמוד, בעוד כמה דקות.').className = 'm';
      else if (state === 'none') p('השיקוף האישי עוד לא נכתב.').className = 'm';
      else {
        // paragraphs by empty lines; lines that start with "• " are a list
        String(state || '').replace(/\r/g, '').split(/\n\s*\n/).forEach(block => {
          const lines = block.split('\n').map(s => s.trim()).filter(Boolean);
          if (!lines.length) return;
          let ul = null;
          lines.forEach(line => {
            const m = line.match(/^[•\-*]\s*(.+)$/);
            if (m) { if (!ul) { ul = document.createElement('ul'); el.appendChild(ul); } const li = document.createElement('li'); li.textContent = m[1]; ul.appendChild(li); }
            else { ul = null; p(line); }
          });
        });
        if (at) { const s = document.createElement('p'); s.className = 'at'; s.textContent = 'נכתב ' + at; el.appendChild(s); }
      }
      if (!document.getElementById('cflResponseCss')) {
        const css = document.createElement('style');
        css.id = 'cflResponseCss';
        css.textContent = '.cfl-response{direction:rtl;text-align:right;background:#fff;color:#2B2B28;border:1px solid #DCD8CC;border-top:5px solid #B08A3E;border-radius:8px;padding:20px 22px;margin:22px 0;font-family:"Heebo",Arial,sans-serif;font-size:18px;line-height:1.7}' +
          '.cfl-response h3{margin:0 0 10px;font-size:21px;color:#2B2B28}.cfl-response p{margin:0 0 12px}.cfl-response ul{margin:0 0 12px;padding-right:22px}.cfl-response li{margin:0 0 6px}' +
          '.cfl-response p.m{color:#6E6A5F;font-size:16px}.cfl-response p.at{color:#8A867B;font-size:13px;margin:6px 0 0}';
        document.head.appendChild(css);
      }
      return el;
    },

    /** Box at the top of the summary once the questionnaire was sent. unsent = there are edits not sent yet. */
    sentNote(submittedAt, updatedAt, unsent, locked) {
      const n = document.createElement('div');
      n.className = 'cfl-sent noprint';
      if (VIEW) { n.hidden = true; return n; } // the יועצים page shows its own heading
      n.style.cssText = 'background:' + (unsent ? '#FBF6F2' : '#F4F5EF') + ';border-right:4px solid ' + (unsent ? '#9C6B4F' : '#5E6A41') +
        ';padding:12px 16px;margin:18px 0;font-size:16px;direction:rtl';
      const b = document.createElement('b');
      if (unsent) {
        b.textContent = 'יש שינויים שעוד לא נשלחו. ';
        n.append(b, document.createTextNode('כדי שיישמרו, שלחו שוב. גם השליחה הזו סופית.'));
      } else {
        const when = updatedAt && updatedAt !== submittedAt ? ' (עודכנו ' + updatedAt + ')' : (submittedAt ? ' (' + submittedAt + ')' : '');
        b.textContent = 'התשובות נשלחו' + when + '. ';
        n.append(b, document.createTextNode(locked ? 'השאלון סגור לעריכה.' : 'השאלון נפתח שוב: אפשר לעדכן את התשובות דרך "הסתכל בתשובות" ולשלוח שוב. גם השליחה הזו סופית.'));
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
    showSentNote(container, submittedAt, updatedAt, unsent, locked) {
      const old = container.querySelector('.cfl-sent');
      const n = CFL.sentNote(submittedAt, updatedAt, unsent, locked);
      if (old) old.replaceWith(n); else container.insertBefore(n, container.firstChild);
    }
  };

  window.CFL = CFL;
})();
