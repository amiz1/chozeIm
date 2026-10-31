// חוזה עם החיים (CFL) – חיבור שאלוני ה"קובץ הבודד" לאתר
// The questionnaires Nurit wrote as single files all end the same way: a button "שליחת התשובות אליי"
// that calls CWLReturn.open(). This file takes the place of that sending module (which is removed from
// each page): the same button now saves the answers in the Sheet, through CFL_bridge.js.
//
// Each page sets, before loading this file:
//   window.CFL_PAGE = {
//     id: 'courage',                 // the questionnaire id (CFL_Questions.gs)
//     keys: ['cwl-courage'],         // what the page itself keeps in the browser (it reloads from these)
//     results: function () { … },    // optional: shows the page's own results screen
//     staffView: function () { … },  // optional: extra parts shown only on the יועצים site
//     fields: false,                  // optional: don't copy the fields (only for pages whose own copy is complete)
//     flush: function () { … },      // optional: makes the page save to the browser right now
//     ignore: ['stage'],             // optional: parts of the page's saved copy that aren't answers (which screen is open)
//     lockSel: '.tally button',      // optional: more answer buttons to disable in read-only mode
//     answers: function () { … },    // optional: the יועצים "answers" view opens here (instead of the page's first screen)
//     blank: ['v'],                  // optional: parts that have a value before anything is answered (a default choice)
//                                    //   (ignore/blank may name an inner part: 's.step')
//     onReady: function (info) { … },// optional: runs once the page can be filled in (not in read-only views)
//     reflectSel: '#mirror, #read',  // optional: the page's own reflection, hidden (Claude's personal response replaces it)
//     responseAt: '#out > h2',       // optional: the response card goes before this (else right after the send button's box)
//     responseAfter: '.bar',         // optional: where the card goes while there is no send button (a read-only view)
//     lockCss: '.chip{…}'            // optional: CSS for read-only mode (answers that aren't buttons or fields)
//   }
// and keeps its own  window.CWL_CFG = { summary: () => '…' }  (the text for the יועץ).
//
// What is saved: what the page keeps in the browser under its keys, plus every field on the page (pages
// that keep their answers only in the form). To show saved answers, they're put back where the page keeps
// them and the page is reloaded once, so it restores them its own way.
(function () {
  const PAGE = window.CFL_PAGE || {};
  const ID = PAGE.id;
  let INFO = null;          // what CFL.start answered
  let SENT = null;          // { json, at, upd } of the last sent version
  let LOCKED = false;

  // ---------- the answers: what the page keeps in the browser + every field ----------
  const KEYS = Array.isArray(PAGE.keys) ? PAGE.keys : [];
  // not answers: which screen is open, a save time, the name; and the page's own (ignore) and defaults (blank)
  const IGNORE = ['i', 'page', 'step', 't', 'name'].concat(Array.isArray(PAGE.ignore) ? PAGE.ignore : [], Array.isArray(PAGE.blank) ? PAGE.blank : []);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } };
  function pageKept() {
    const o = {};
    KEYS.forEach(k => { const v = lsGet(k); if (v !== null) o[k] = v; });
    return o;
  }
  function fieldKey(el, i) {
    const t = (el.type || '').toLowerCase();
    if ((t === 'radio' || t === 'checkbox') && el.name) return el.name + '=' + el.value;
    return el.id ? '#' + el.id : el.name ? '@' + el.name + (t === 'checkbox' ? '=' + el.value : '') : '%' + i;
  }
  function fields() {
    return Array.from(document.querySelectorAll('input, textarea, select')).filter(el =>
      !el.closest('#cflBar, #cflReadOnly, .cfl-send-box') && !/^(hidden|button|submit|file|password)$/i.test(el.type || ''));
  }
  function snapshot() {
    const out = {};
    fields().forEach((el, i) => {
      const t = (el.type || '').toLowerCase();
      if (t === 'radio' || t === 'checkbox') { if (el.checked) out[fieldKey(el, i)] = true; }
      else if (String(el.value || '').trim()) out[fieldKey(el, i)] = String(el.value).slice(0, 20000);
    });
    return out;
  }
  // Every field is copied too: several pages keep only the selections in the browser, not what was written.
  // (A page whose own saved copy is complete and large can set fields: false.)
  const USE_FIELDS = PAGE.fields !== false;
  function flush() { // pages that save a moment after each change: save now
    try { if (typeof PAGE.flush === 'function') PAGE.flush(); } catch (e) { }
  }
  function collect() { flush(); return { v: 2, ls: pageKept(), f: USE_FIELDS ? snapshot() : {} }; }
  // removes a part named 'a' or 'a.b' from a saved copy
  function drop(o, path) {
    const p = String(path).split('.');
    for (let i = 0; i < p.length - 1; i++) { o = o && typeof o === 'object' ? o[p[i]] : null; }
    if (o && typeof o === 'object' && !Array.isArray(o)) delete o[p[p.length - 1]];
  }
  function lsMeaningful(v) {
    try {
      const o = JSON.parse(v);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return meaningful(o);
      const c = JSON.parse(JSON.stringify(o)); IGNORE.forEach(k => drop(c, k));
      return meaningful(c);
    }
    catch (e) { return !!String(v || '').trim(); }
  }
  function isEmpty(st) {
    const ls = st.ls || {};
    return !Object.keys(ls).some(k => lsMeaningful(ls[k])) && !Object.keys(st.f || {}).length;
  }
  function meaningful(v) {
    if (v === null || v === undefined || v === '' || v === false) return false;
    if (Array.isArray(v)) return v.some(meaningful);
    if (typeof v === 'object') return Object.keys(v).some(k => meaningful(v[k]));
    return typeof v !== 'number' || v !== 0;
  }
  // Puts saved answers back. Returns true when the page is being reloaded to pick them up.
  const FLAG = 'cfl_cwl_restored_' + ID;
  let justRestored = false; // this load is the reload that restore() asked for (read once, then cleared)
  try { justRestored = sessionStorage.getItem(FLAG) === '1'; sessionStorage.removeItem(FLAG); } catch (e) { }
  function restore(st) {
    if (!st) return false;
    const ls = st.ls || {};
    const differs = KEYS.some(k => (ls[k] === undefined ? null : ls[k]) !== lsGet(k));
    if (differs && !justRestored) {
      KEYS.forEach(k => lsSet(k, ls[k] === undefined ? null : ls[k]));
      try { sessionStorage.setItem(FLAG, '1'); } catch (e) { }
      location.reload();
      return true;
    }
    const f = st.f || {};
    if (!Object.keys(f).length) return false; // no copy of the fields was saved: the page restored itself
    fields().forEach((el, i) => {
      const k = fieldKey(el, i), t = (el.type || '').toLowerCase();
      if (t === 'radio' || t === 'checkbox') {
        const want = !!f[k];
        if (el.checked !== want) { el.checked = want; el.dispatchEvent(new Event('change', { bubbles: true })); }
      } else if (k in f && el.value !== f[k]) {
        el.value = f[k];
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    return false;
  }
  // canonical form, to tell whether there are changes that weren't sent yet
  function canon(st) {
    const sort = v => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
      ? Object.keys(v).sort().reduce((o, k) => { if (k !== 'i') o[k] = sort(v[k]); return o; }, {}) : v;
    const ls = {};
    Object.keys(st.ls || {}).sort().forEach(k => {
      let v = st.ls[k];
      try { // a save time or the open screen isn't a change
        v = JSON.parse(v);
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if (typeof v.t === 'number') delete v.t;
          (PAGE.ignore || []).forEach(x => drop(v, x));
        }
        v = sort(v);
      } catch (e) { }
      ls[k] = v;
    });
    return JSON.stringify(sort({ ls: ls, f: st.f || {} }));
  }

  // ---------- sending (final) and the personal response ----------
  // From 31.10 sending is final: the answers go once, and Claude writes a personal response (שיקוף) that is shown
  // in place of the page's own reflection (PAGE.reflectSel is hidden). A יועץ can reopen the questionnaire for a new sending.
  let note = null;
  function showNote(unsent) {
    if (!SENT) return;
    const n = document.createElement('div');
    n.className = 'cfl-cwl-note' + (unsent ? ' unsent' : '');
    const b = document.createElement('b');
    if (unsent) {
      b.textContent = 'יש שינויים שעוד לא נשלחו. ';
      n.append(b, document.createTextNode('כדי שיישמרו, שלחו בסוף השאלון. גם השליחה הזו סופית.'));
    } else {
      const when = SENT.upd && SENT.upd !== SENT.at ? ' (עודכנו ' + SENT.upd + ')' : (SENT.at ? ' (' + SENT.at + ')' : '');
      b.textContent = 'התשובות נשלחו' + when + '. ';
      n.append(b, document.createTextNode(LOCKED ? 'השאלון סגור לעריכה.' : 'השאלון נפתח שוב: אפשר לשנות ולשלוח שוב, ותקבלו שיקוף חדש. גם השליחה הזו סופית.'));
    }
    if (note) note.replaceWith(n);
    else { const bar = document.getElementById('cflBar'); if (bar) bar.after(n); else document.body.prepend(n); }
    note = n;
  }
  function box(html, kind) {
    let el = document.getElementById('cflSendBox');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cflSendBox';
      el.className = 'cfl-send-box';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      document.body.appendChild(el);
      el.addEventListener('click', e => { if (e.target === el && !el.dataset.busy) el.remove(); });
    }
    el.innerHTML = '<div class="bx' + (kind ? ' ' + kind : '') + '">' + html + '</div>';
    return el;
  }
  // the response card: before PAGE.responseAt, else right after the send button's box
  let CARD = null, TOP = false; // TOP: read-only views show it at the top, under the bar (pages of screens may not show the send screen)
  function placeCard() {
    if (!CARD || document.body.contains(CARD)) return;
    if (TOP) {
      CARD.classList.add('top');
      const rb = document.getElementById('cflReadOnly');
      if (rb) rb.after(CARD); else document.body.insertBefore(CARD, document.body.firstChild);
      return;
    }
    const at = PAGE.responseAt && document.querySelector(PAGE.responseAt);
    if (at) { at.before(CARD); return; }
    const b = document.querySelector('.cwl-send');
    if (b) { (b.parentElement || b).after(CARD); return; }
    const after = PAGE.responseAfter && document.querySelector(PAGE.responseAfter);
    if (after) after.after(CARD);
  }
  function showCard(state, at) {
    CARD = CFL.responseCard(CARD, state, at);
    CARD.id = 'cflResponse';
    placeCard();
    return CARD;
  }
  async function open() {
    if (LOCKED || !INFO) return;
    const st = collect();
    if (isEmpty(st)) { box('<h3>עוד אין תשובות לשלוח</h3><p>ענו על השאלות, ואז שלחו.</p><button type="button" class="b" data-x>סגירה</button>'); bindClose(); return; }
    const again = !!SENT;
    if (again && canon(st) === SENT.json) { box('<h3>אין שינויים</h3><p>התשובות כבר נשלחו כפי שהן.</p><button type="button" class="b" data-x>סגירה</button>'); bindClose(); return; }
    box('<h3>שליחה סופית</h3><p>התשובות יגיעו רק אליי, ותקבלו מיד שיקוף אישי על מה שעלה בהן.</p>' +
      '<p><b>אחרי השליחה לא יהיה אפשר לשנות את התשובות.</b> כדאי לעבור עליהן לפני שליחה.</p>' +
      '<button type="button" class="b pr" id="cflGo">שליחה וקבלת השיקוף</button><button type="button" class="b" data-x>עוד רגע, אני רוצה לבדוק</button><p class="m" id="cflMsg" aria-live="polite"></p>');
    bindClose();
    document.getElementById('cflGo').onclick = async function () {
      const wrap = document.getElementById('cflSendBox');
      wrap.dataset.busy = '1';
      this.disabled = true; this.textContent = 'שולח וכותב את השיקוף האישי…';
      wrap.querySelectorAll('[data-x]').forEach(x => { x.disabled = true; });
      document.getElementById('cflMsg').textContent = 'זה לוקח בערך חצי דקה. אפשר להישאר בעמוד.';
      let summary = '';
      try { summary = (window.CWL_CFG && window.CWL_CFG.summary) ? String(window.CWL_CFG.summary() || '') : ''; } catch (e) { summary = ''; }
      const r = await CFL.submit(ID, st, summary, {});
      delete wrap.dataset.busy;
      if (!r.ok) {
        this.disabled = false; this.textContent = 'שליחה וקבלת השיקוף';
        wrap.querySelectorAll('[data-x]').forEach(x => { x.disabled = false; });
        document.getElementById('cflMsg').textContent = r.message || 'השליחה לא הצליחה. נסו שוב.';
        return;
      }
      wrap.remove();
      SENT = { json: canon(st), at: r.submittedAt || (SENT && SENT.at) || '', upd: r.updatedAt || '' };
      lock();
      showNote(false);
      sendText();
      const c = showCard(r.response ? r.response : 'later', r.responseAt || '');
      if (!document.body.contains(c)) { TOP = true; placeCard(); } // sent from a screen without the send button
      try { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
    };
  }
  function sendText() {
    const s = LOCKED ? 'התשובות נשלחו אליי, ונסתכל עליהן יחד בפגישה שלנו.'
      : 'כשתסיימו, שלחו את התשובות וקבלו שיקוף אישי. התשובות יגיעו רק אליי, ונסתכל עליהן יחד בפגישה שלנו. השליחה סופית: אחריה אי אפשר לשנות את התשובות.';
    document.querySelectorAll('.cfl-send-p').forEach(p => { if (p.textContent !== s) p.textContent = s; });
  }
  // the text above the send button asked to press it: now it says the sending is final and brings a שיקוף
  function wireSend() {
    const seen = new WeakSet();
    const wire = () => {
      document.querySelectorAll('.cwl-send').forEach(b => {
        const bx = b.parentElement || b;
        if (seen.has(bx)) return;
        seen.add(bx);
        if (b.textContent !== 'שליחה וקבלת שיקוף אישי') b.textContent = 'שליחה וקבלת שיקוף אישי';
        bx.querySelectorAll('p').forEach(p => {
          if (/נשאר רק לשלוח|כדי לשלוח לי|נשלחות אליי מעצמן/.test(p.textContent)) p.classList.add('cfl-send-p');
        });
      });
      sendText();
      placeCard();
    };
    wire();
    new MutationObserver(wire).observe(document.body, { childList: true, subtree: true });
  }

  function bindClose() { document.querySelectorAll('#cflSendBox [data-x]').forEach(b => b.onclick = () => document.getElementById('cflSendBox').remove()); }
  window.CWLReturn = {
    open: open,
    button: label => '<button type="button" class="cwl-send" onclick="CWLReturn.open()">' + (label || 'שליחה וקבלת שיקוף אישי') + '</button>'
  };

  // ---------- read-only (sent, then closed by a יועץ; or the יועצים site) ----------
  function lock() {
    LOCKED = true;
    document.documentElement.classList.add('cfl-locked');
    if (PAGE.lockCss) { const st = document.createElement('style'); st.textContent = PAGE.lockCss; document.head.appendChild(st); }
    const off = () => {
      fields().forEach(el => { el.disabled = true; });
      // answer buttons (toggles) can't be pressed; moving between screens still works
      document.querySelectorAll('button[aria-pressed], button[data-v], .cwl-send, #reset, #addAb, #addG, [id^=add]' + (PAGE.lockSel ? ', ' + PAGE.lockSel : '')).forEach(b => { b.disabled = true; });
    };
    off();
    new MutationObserver(off).observe(document.body, { childList: true, subtree: true }); // pages that redraw themselves
  }
  // the יועצים site: what the page saves while it's being looked at isn't kept in this browser
  function keepNothing() {
    try {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (this === window.localStorage && (KEYS.indexOf(k) !== -1 || k === NAME_KEY)) return;
        return set.apply(this, arguments);
      };
    } catch (e) { }
  }
  function showResults() { try { if (typeof PAGE.results === 'function') PAGE.results(); } catch (e) { } }

  // ---------- look ----------
  const css = document.createElement('style');
  css.textContent = `
  #cflSendBox{position:fixed;inset:0;background:rgba(20,20,15,.55);display:flex;align-items:flex-start;justify-content:center;z-index:9999;overflow:auto;padding:60px 14px;direction:rtl}
  #cflSendBox .bx{background:#fff;color:#2B2B28;max-width:480px;width:100%;border-top:5px solid #5E6A41;padding:22px 20px;font-family:"Heebo",Arial,sans-serif;font-size:17px;line-height:1.6}
  #cflSendBox .bx.ok{border-top-color:#B08A3E}
  #cflSendBox h3{margin:0 0 8px;font-size:22px;color:#2B2B28}
  #cflSendBox p{margin:0 0 14px}
  #cflSendBox .b{display:block;width:100%;font:inherit;font-weight:700;padding:12px 16px;margin:0 0 8px;cursor:pointer;border:1px solid #5E6A41;background:#fff;color:#5E6A41}
  #cflSendBox .b.pr{background:#2B2B2B;border-color:#2B2B2B;color:#FAF9F5}
  #cflSendBox .b:disabled{opacity:.6}
  #cflSendBox .m{color:#9C6B4F;font-weight:500;min-height:1.2em}
  .cfl-cwl-note{max-width:820px;margin:14px auto;background:#F4F5EF;border-right:4px solid #5E6A41;padding:12px 16px;font-size:16px;direction:rtl;font-family:"Heebo",Arial,sans-serif}
  .cfl-cwl-note.unsent{background:#FBF6F2;border-right-color:#9C6B4F}
  .cfl-locked .cwl-send{display:none!important}
  #cflSendBox .bx p b{color:#9C6B4F}
  :where(.cwl-send){font:inherit;font-size:17px;font-weight:700;padding:12px 22px;border:1px solid #2B2B2B;background:#2B2B2B;color:#FAF9F5;cursor:pointer;border-radius:2px}
  :where(.cwl-send):hover{background:#44443F}
  .cfl-response.top{max-width:860px;margin:16px auto 6px;box-sizing:border-box}
  @media print{#cflSendBox,.cfl-cwl-note{display:none!important}}`;
  // the page's own reflection is replaced by the personal response
  if (PAGE.reflectSel) css.textContent += String(PAGE.reflectSel).split(',').map(s => s.trim()).filter(Boolean).map(s => s + '{display:none!important}').join('');
  document.head.appendChild(css);

  // ---------- start ----------
  function fillName(name) {
    if (!name) return;
    ['cwlStartName', 'nm', 'who', 'name'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.tagName === 'INPUT' && !el.value) { el.value = name; el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    try { if (typeof S !== 'undefined' && S && typeof S === 'object' && 'name' in S && !S.name) S.name = name; } catch (e) { }
  }

  // The browser keeps one person's drafts: when someone else signs in here, the previous drafts are cleared
  const OWNER = 'cfl_cwl_owner';
  const NAME_KEY = 'cwl-return-name'; // the name some pages keep for the next questionnaire
  function ownDrafts() { // returns true when the page is reloaded without the previous person's drafts
    const me = (CFL.email || '').toLowerCase();
    const was = lsGet(OWNER);
    if (me && was && was !== me) {
      let all = [];
      try { all = JSON.parse(lsGet('cfl_cwl_keys') || '[]'); } catch (e) { }
      const had = all.concat(KEYS).some(k => lsGet(k) !== null);
      all.concat(KEYS, [NAME_KEY]).forEach(k => lsSet(k, null));
      lsSet('cfl_cwl_keys', null);
      lsSet(OWNER, me);
      if (had) { location.reload(); return true; } // this page already showed them: start it again, empty
    }
    if (me) lsSet(OWNER, me);
    let all = [];
    try { all = JSON.parse(lsGet('cfl_cwl_keys') || '[]'); } catch (e) { }
    KEYS.forEach(k => { if (all.indexOf(k) === -1) all.push(k); });
    lsSet('cfl_cwl_keys', JSON.stringify(all));
  }

  function start() {
    if (!ID || !window.CFL) return;
    CFL.start(ID).then(info => {
      INFO = info;
      if (info.view) {
        // the יועצים site: show the saved answers, then take them out of this browser again
        if (restore(info.saved)) return;
        KEYS.forEach(k => lsSet(k, null));
        keepNothing();
        lock();
        if (typeof PAGE.staffView === 'function') { try { PAGE.staffView(); } catch (e) { } }
        if (info.viewMode !== 'answers') { showResults(); TOP = true; showCard(info.response || 'none', info.responseAt || ''); wireSend(); }
        else if (typeof PAGE.answers === 'function') { try { PAGE.answers(); } catch (e) { } }
        return;
      }
      if (ownDrafts()) return;
      const sent = info.status === 'submitted' && info.saved;
      // what's on the page now (a draft in this browser) wins; an empty page gets the sent answers
      if (sent && isEmpty(collect()) && restore(info.saved)) return;
      fillName(CFL.name); // after: the name alone isn't an answer, but some pages save it right away
      if (sent) {
        SENT = { json: canon(Object.assign({ ls: {}, f: {} }, info.saved)), at: info.submittedAt || '', upd: info.updatedAt || '' };
        if (info.readOnly) {
          lock();
          showResults();
          CFL.readOnlyBar(showResults, () => { window.scrollTo(0, 0); });
          TOP = true;
          showCard(info.response || 'later', info.responseAt || '');
          wireSend();
          return;
        }
        showNote(canon(collect()) !== SENT.json);
        const recheck = () => setTimeout(() => showNote(canon(collect()) !== SENT.json), 30); // after the page saved
        ['input', 'change', 'click'].forEach(ev => document.addEventListener(ev, recheck));
      }
      if (typeof PAGE.onReady === 'function') { try { PAGE.onReady(info); } catch (e) { } }
      showCard('wait');
      wireSend();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
