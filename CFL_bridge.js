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
          submittedAt: d.submittedAt || '', updatedAt: d.updatedAt || '', name: d.name || '', gender: d.gender || '',
          response: d.response || '', responseAt: d.responseAt || '' });
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
          msg.style.color = '#6E6A5F'; msg.textContent = 'זה לוקח בערך חצי דקה. אפשר להישאר בעמוד.';
          let r;
          try { r = await send(); } catch (e) { r = { ok: false }; }
          busy = false;
          if (r && r.ok) { close(r); return; }
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
      else if (state === 'writing') p('כותב את השיקוף האישי… זה לוקח בערך חצי דקה.').className = 'm';
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
