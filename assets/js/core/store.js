/* ==========================================================================
   core/store.js — שמירה מקומית בלבד. ארבעה מצבים, לפי מה שזמין:

   server  — קובץ data/pruta-data.json בתיקיית הפרויקט, דרך שרת ההרצה המקומי (run.py).
   folder  — אותו קובץ בתיקייה שנבחרה בדפדפן (File System Access API).
   local   — localStorage של הדפדפן במחשב הזה.
   memory  — כשאין אחסון זמין; יש להוריד גיבוי ידני.

   שום נתון לא נשלח לרשת. אין כאן אף בקשה לדומיין חיצוני.

   שלוש הבטחות, מעבר לכתיבה עצמה:
     · לשונית ישנה לא דורסת נתונים חדשים. לכל שמירה יש מספר גרסה (rev); השרת דוחה שמירה שנשענת
       על גרסה שכבר הוחלפה, ולשוניות פתוחות מתעדכנות זו מזו.
     · שמירה שנכשלה לא הולכת לאיבוד. אם חלון ההרצה נסגר באמצע, השינויים נשמרים זמנית בדפדפן
       ומשוחזרים בפעם הבאה שפרוטה עולה.
     · קובץ שלא ניתן לקרוא לא נדרס: במקרה כזה לא עוברים למצב server בכלל.
   ========================================================================== */
window.P = window.P || {};

P.store = (function () {
  'use strict';

  const FILE = 'pruta-data.json';
  const LS_KEY = 'pruta.state.v3';
  const UNSAVED_KEY = 'pruta.unsaved';
  const IDB_DB = 'pepper-handles';
  // שמות הקבצים מגרסאות קודמות של הפרויקט — נקראים פעם אחת, כדי שנתונים קיימים לא יאבדו
  const LEGACY_FILE = 'pepper-data.json';
  const LEGACY_LS_KEY = 'pepper.state.v2';

  let mode = 'memory';          // 'server' | 'folder' | 'local' | 'memory'
  let dirHandle = null;
  let memory = null;
  let saveTimer = null;
  let lastSaved = null;
  let rev = 0;                  // הגרסה האחרונה של הנתונים שהלשונית הזו ראתה
  let problem = null;           // null | 'offline' (השמירה נכשלה) | 'stale' (הנתונים השתנו במקום אחר)
  let restored = false;         // בטעינה שוחזרו שינויים שלא הספיקו להישמר
  let notice = null;            // הודעה חד-פעמית מהשרת (למשל: קובץ הנתונים היה פגום)
  let channel = null;

  const listeners = [], externals = [];
  const onChange = (fn) => listeners.push(fn);
  /** fn(data): הנתונים עודכנו בלשונית אחרת, והלשונית הזו צריכה להציג אותם */
  const onExternal = (fn) => externals.push(fn);
  const emit = () => listeners.forEach((fn) => fn(describe()));

  function describe() {
    return {
      mode: mode,
      label: {
        server: 'נשמר בתיקיית הפרויקט (data/' + FILE + ')',
        folder: 'נשמר בתיקייה שבחרתם (' + FILE + ')',
        local: 'נשמר בדפדפן במחשב הזה',
        memory: 'לא נשמר — הורידו גיבוי לפני סגירה'
      }[mode],
      canPickFolder: typeof window.showDirectoryPicker === 'function',
      lastSaved: lastSaved,
      problem: problem,
      restored: restored,
      notice: notice
    };
  }

  /* ---------- שמירת מצביע לתיקייה בין הפעלות ---------- */
  function idb(action, value) {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      let req;
      try { req = indexedDB.open(IDB_DB, 1); } catch (e) { return resolve(null); }
      req.onupgradeneeded = () => req.result.createObjectStore('h');
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction('h', action === 'get' ? 'readonly' : 'readwrite');
          const st = tx.objectStore('h');
          const r = action === 'get' ? st.get('dir') : st.put(value, 'dir');
          r.onsuccess = () => resolve(action === 'get' ? r.result : true);
          r.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      };
    });
  }

  /* ---------- קריאה/כתיבה מול שרת ההרצה המקומי ---------- */
  async function serverGet() {
    // בפתיחה ישירה של הקובץ מהדיסק אין שרת — לא מנסים בכלל, כדי לא ללכלך את המסוף
    if (location.protocol === 'file:') throw new Error('no server');
    const res = await fetch('api/state', { cache: 'no-store' });
    if (!res.ok) throw new Error('server ' + res.status);
    if (!(res.headers.get('content-type') || '').includes('json')) throw new Error('not json');
    return res.json();
  }
  async function serverPut(data) {
    const res = await fetch('api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign({}, data, { rev: rev }))
    });
    if (res.status === 409) { const e = new Error('stale'); e.code = 'stale'; throw e; }
    if (!res.ok) throw new Error('server ' + res.status);
    const out = await res.json().catch(() => ({}));
    if (out && typeof out.rev === 'number') rev = out.rev;
  }

  /* ---------- עותק ביטחון בדפדפן, לשינויים שלא הגיעו לקובץ ---------- */
  function keepUnsaved(payload) {
    try { localStorage.setItem(UNSAVED_KEY, JSON.stringify({ baseRev: rev, at: new Date().toISOString(), data: payload })); return true; }
    catch (e) { return false; }                     // אין מקום: נשאר רק בזיכרון של הלשונית
  }
  function dropUnsaved() { try { localStorage.removeItem(UNSAVED_KEY); } catch (e) { /* אין אחסון */ } }
  function readUnsaved() {
    try { const u = JSON.parse(localStorage.getItem(UNSAVED_KEY) || 'null'); return u && typeof u === 'object' && u.data && typeof u.data === 'object' ? u : null; }
    catch (e) { return null; }
  }

  /* ---------- קריאה/כתיבה מול תיקייה שנבחרה בדפדפן ---------- */
  async function folderRead(handle) {
    const fh = await handle.getFileHandle(FILE, { create: false }).catch(() => null)
      || await handle.getFileHandle(LEGACY_FILE, { create: false }).catch(() => null);
    if (!fh) return {};
    const text = await (await fh.getFile()).text();
    return text.trim() ? JSON.parse(text) : {};
  }
  async function folderWrite(handle, data) {
    const fh = await handle.getFileHandle(FILE, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(data, null, 1));
    await w.close();
  }

  /* ---------- אתחול: מנסים מהחזק לחלש ---------- */
  async function init() {
    let data = null;
    try { data = await serverGet(); } catch (e) { /* אין שרת (או שהקובץ לא נקרא) — ממשיכים */ }
    if (data) {
      mode = 'server';
      rev = typeof data.rev === 'number' ? data.rev : 0;
      if (data.notice) { notice = data.notice; delete data.notice; }
      // שינויים מהפעם הקודמת שלא הגיעו לקובץ — רק אם הקובץ לא התקדם מאז
      const u = readUnsaved();
      if (u && u.baseRev === rev) { data = u.data; restored = true; } else if (u) dropUnsaved();
      listen();
      emit();
      return data;
    }

    const saved = await idb('get');
    if (saved && saved.queryPermission) {
      try {
        const perm = await saved.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          dirHandle = saved; mode = 'folder'; emit();
          return await folderRead(saved);
        }
      } catch (e) { /* ההרשאה פגה */ }
    }

    try {
      const raw = localStorage.getItem(LS_KEY) || localStorage.getItem(LEGACY_LS_KEY);
      localStorage.setItem('__p', '1'); localStorage.removeItem('__p');
      mode = 'local';
      listen();
      emit();
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      mode = 'memory'; emit();
      return {};
    }
  }

  /* ---------- כמה לשוניות פתוחות: מתעדכנות זו מזו ---------- */
  function listen() {
    if (mode === 'server') {
      try {
        channel = new BroadcastChannel('pruta');
        channel.onmessage = (e) => { if (e.data && e.data.rev > rev) pull(); };
      } catch (e) { channel = null; }
      // גם בלי BroadcastChannel (או משרת אחר על אותה תיקייה): בודקים כשחוזרים ללשונית
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
      window.addEventListener('focus', pull);
    } else if (mode === 'local') {
      window.addEventListener('storage', (e) => {
        if (e.key !== LS_KEY || !e.newValue || pending) return;
        try { const data = JSON.parse(e.newValue); externals.forEach((fn) => fn(data)); } catch (err) { /* ערך לא תקין — מתעלמים */ }
      });
    }
  }
  let pulling = false, lastPull = 0;
  /** מביא מהשרת את הנתונים אם לשונית אחרת שמרה גרסה חדשה יותר */
  async function pull() {
    if (mode !== 'server' || pulling || problem === 'stale' || Date.now() - lastPull < 800) return;
    pulling = true; lastPull = Date.now();
    try {
      const data = await serverGet();
      const theirs = typeof data.rev === 'number' ? data.rev : 0;
      if (theirs > rev) {
        if (pending || saving) { problem = 'stale'; emit(); }          // גם כאן יש שינוי שלא נשמר: לא מחליטים לבד
        else { rev = theirs; delete data.notice; externals.forEach((fn) => fn(data)); }
      }
    } catch (e) { /* השרת לא זמין כרגע; השמירה הבאה תגלה */ }
    pulling = false;
  }

  /** בחירת תיקייה ידנית (Chrome/Edge). מעביר את האחסון לקובץ בתוך התיקייה. */
  async function pickFolder() {
    if (typeof window.showDirectoryPicker !== 'function') {
      throw new Error('הדפדפן הזה לא תומך בבחירת תיקייה. הפעילו את run.py או השתמשו בגיבוי ידני.');
    }
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') throw new Error('לא ניתנה הרשאת כתיבה לתיקייה');
    dirHandle = handle; mode = 'folder';
    await idb('put', handle);
    emit();
    return handle;
  }

  let saving = 0, inflight = null;
  async function write(data) {
    const payload = Object.assign({ savedAt: new Date().toISOString(), version: 3 }, data);
    if (mode === 'server') {
      if (problem === 'stale') { const e = new Error('stale'); e.code = 'stale'; throw e; }      // לא כותבים מעל נתונים חדשים יותר
      saving++; inflight = payload;
      try {
        await serverPut(payload);
        dropUnsaved();
        if (problem) problem = null;
        if (channel) { try { channel.postMessage({ rev: rev }); } catch (e) { /* הערוץ נסגר */ } }
      } catch (e) {
        if (e.code === 'stale') { problem = 'stale'; emit(); throw e; }
        // השרת לא ענה (חלון ההרצה נסגר?) — שומרים עותק בדפדפן כדי שהשינוי לא יאבד
        keepUnsaved(payload);
        problem = 'offline';
        emit();
        const err = new Error('השמירה לתיקייה לא הצליחה — נראה שחלון ההרצה של פרוטה נסגר.');
        err.code = 'offline';
        throw err;
      } finally { saving--; inflight = null; }
    } else if (mode === 'folder' && dirHandle) await folderWrite(dirHandle, payload);
    else if (mode === 'local') {
      try { localStorage.setItem(LS_KEY, JSON.stringify(payload)); }
      catch (e) { mode = 'memory'; memory = payload; emit(); throw new Error('האחסון בדפדפן מלא. הורידו גיבוי ונקו נתונים ישנים.'); }
    } else memory = payload;
    lastSaved = new Date();
    restored = false;
    emit();
  }

  /** שמירה דחויה — אוספת שינויים רצופים לכתיבה אחת */
  let pending = null;
  function save(getData, delay) {
    clearTimeout(saveTimer);
    pending = getData;
    saveTimer = setTimeout(flush, delay == null ? 400 : delay);
  }
  /** כותב עכשיו את מה שמחכה לשמירה (אם יש) */
  function flush() {
    clearTimeout(saveTimer);
    if (!pending) return Promise.resolve();
    const get = pending; pending = null;
    // בעיות שמירה מול חלון ההרצה מדווחות פעם אחת דרך onChange (ראו main.js); כאן רק מה שלא מכוסה שם
    return write(get()).catch((e) => { if (P.kit && e.code !== 'offline' && e.code !== 'stale') P.kit.toast(e.message, { icon: 'alert', duration: 9000 }); });
  }
  // סגירת הלשונית או מעבר ממנה בתוך חלון ההשהיה: לא מאבדים את השינוי האחרון.
  // בקשה שיוצאת בזמן סגירה עלולה להתבטל, ולכן נשמר גם עותק בדפדפן; הוא נמחק כשהשמירה מאושרת.
  function leaving() {
    if (mode === 'server' && problem !== 'stale') {
      try {
        if (pending) keepUnsaved(Object.assign({ savedAt: new Date().toISOString(), version: 3 }, pending()));
        else if (inflight) keepUnsaved(inflight);
      } catch (e) { /* ממשיכים לשמירה עצמה */ }
    }
    flush();
  }
  window.addEventListener('pagehide', leaving);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leaving(); });

  async function clear() {
    if (mode === 'local') { try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LEGACY_LS_KEY); } catch (e) {} }
    if (mode === 'server') { dropUnsaved(); try { await serverPut({ version: 3, cleared: true }); if (channel) channel.postMessage({ rev: rev }); } catch (e) {} }
    if (mode === 'folder' && dirHandle) { try { await folderWrite(dirHandle, { version: 3, cleared: true }); } catch (e) {} }
    memory = null;
  }

  return { init, save, flush, write, clear, pickFolder, onChange, onExternal, describe, FILE: FILE };
})();
