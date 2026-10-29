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
//     blank: ['v']                   // optional: parts that have a value before anything is answered (a default choice)
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
  function lsMeaningful(v) {
    try {
      const o = JSON.parse(v);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return meaningful(o);
      const c = Object.assign({}, o); IGNORE.forEach(k => { delete c[k]; });
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
          (PAGE.ignore || []).forEach(x => { delete v[x]; });
        }
        v = sort(v);
      } catch (e) { }
      ls[k] = v;
    });
    return JSON.stringify(sort({ ls: ls, f: st.f || {} }));
  }

  // ---------- sending ----------
  let note = null;
  function showNote(unsent) {
    if (!SENT) return;
    const n = document.createElement('div');
    n.className = 'cfl-cwl-note' + (unsent ? ' unsent' : '');
    const b = document.createElement('b');
    if (unsent) {
      b.textContent = 'יש שינויים שעוד לא נשלחו. ';
      n.append(b, document.createTextNode('כדי שיישמרו, שלחו שוב בסוף השאלון ("שליחת התשובות").'));
    } else {
      const when = SENT.upd && SENT.upd !== SENT.at ? ' (עודכנו ' + SENT.upd + ')' : (SENT.at ? ' (' + SENT.at + ')' : '');
      b.textContent = 'התשובות נשלחו' + when + '. ';
      n.append(b, document.createTextNode('אפשר לשנות אותן כאן ולשלוח שוב בכל זמן.'));
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
    }
    el.innerHTML = '<div class="bx' + (kind ? ' ' + kind : '') + '">' + html + '</div>';
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    return el;
  }
  async function open() {
    if (LOCKED || !INFO) return;
    const st = collect();
    if (isEmpty(st)) { box('<h3>עוד אין תשובות לשלוח</h3><p>ענו על השאלות, ואז שלחו.</p><button type="button" class="b" data-x>סגירה</button>'); bindClose(); return; }
    const again = !!SENT;
    if (again && canon(st) === SENT.json) { box('<h3>אין שינויים</h3><p>התשובות כבר נשלחו כפי שהן.</p><button type="button" class="b" data-x>סגירה</button>'); bindClose(); return; }
    box('<h3>' + (again ? 'שליחת העדכון' : 'שליחת התשובות') + '</h3><p>' +
      (again ? 'התשובות המעודכנות יחליפו את מה שנשלח קודם.' : 'התשובות יישמרו ויגיעו ליועצים. אפשר יהיה לחזור אליהן ולעדכן אותן גם אחר כך.') +
      '</p><button type="button" class="b pr" id="cflGo">' + (again ? 'שליחת העדכון' : 'שליחה') + '</button><button type="button" class="b" data-x>ביטול</button><p class="m" id="cflMsg" aria-live="polite"></p>');
    bindClose();
    document.getElementById('cflGo').onclick = async function () {
      this.disabled = true; this.textContent = 'שולח…';
      let summary = '';
      try { summary = (window.CWL_CFG && window.CWL_CFG.summary) ? String(window.CWL_CFG.summary() || '') : ''; } catch (e) { summary = ''; }
      const r = await CFL.submit(ID, st, summary, {});
      if (!r.ok) {
        this.disabled = false; this.textContent = again ? 'שליחת העדכון' : 'שליחה';
        document.getElementById('cflMsg').textContent = r.message || 'השליחה לא הצליחה. נסו שוב.';
        return;
      }
      SENT = { json: canon(st), at: r.submittedAt || (SENT && SENT.at) || '', upd: r.updatedAt || '' };
      showNote(false);
      box('<h3>' + (again ? 'העדכון נשמר. תודה!' : 'התשובות נשלחו. תודה!') + '</h3><p>אפשר לחזור לשאלון ולעדכן אותו בכל זמן.</p>' +
        '<button type="button" class="b pr" id="cflHome">חזרה לעמוד הראשי</button><button type="button" class="b" data-x>להישאר בשאלון</button>', 'ok');
      bindClose();
      document.getElementById('cflHome').onclick = () => { location.href = 'index.html'; };
    };
  }
  function bindClose() { document.querySelectorAll('#cflSendBox [data-x]').forEach(b => b.onclick = () => document.getElementById('cflSendBox').remove()); }
  window.CWLReturn = {
    open: open,
    button: label => '<button type="button" class="cwl-send" onclick="CWLReturn.open()">' + (label || 'שליחת התשובות') + '</button>'
  };

  // ---------- read-only (sent, then closed by a יועץ; or the יועצים site) ----------
  function lock() {
    LOCKED = true;
    document.documentElement.classList.add('cfl-locked');
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
  @media print{#cflSendBox,.cfl-cwl-note{display:none!important}}`;
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
        if (info.viewMode !== 'answers') showResults();
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
          return;
        }
        showNote(canon(collect()) !== SENT.json);
        const recheck = () => setTimeout(() => showNote(canon(collect()) !== SENT.json), 30); // after the page saved
        ['input', 'change', 'click'].forEach(ev => document.addEventListener(ev, recheck));
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
