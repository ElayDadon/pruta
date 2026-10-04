/* ==========================================================================
   lib/zip.js — קורא ארכיוני ZIP בדפדפן, ללא ספריות חיצוניות.
   משתמש ב-DecompressionStream המובנה (Chrome 80+, Edge, Firefox 113+, Safari 16.4+).
   קובץ xlsx הוא ZIP של קובצי XML, ולכן זה כל מה שצריך כדי לקרוא אותו מקומית.
   ========================================================================== */
window.P = window.P || {};

P.zip = (function () {
  'use strict';

  function supported() { return typeof DecompressionStream === 'function'; }

  /*
   * תקרה לגודל של קובץ אחד אחרי פריסה. דוח תנועות של שנים שוקל מגה-בייטים בודדים;
   * ארכיון זעיר שנפרס לג'יגה-בייטים ("פצצת ZIP") נעצר כאן במקום לתקוע את הדפדפן.
   */
  const MAX_ENTRY = 300 * 1024 * 1024;

  async function inflateRaw(bytes) {
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_ENTRY) { try { await reader.cancel(); } catch (e) { /* כבר נסגר */ } throw new Error('הקובץ גדול מדי לקריאה'); }
      chunks.push(value);
    }
    const out = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) { out.set(c, at); at += c.length; }
    return out;
  }

  /** @returns {{has:(n:string)=>boolean, names:()=>string[], get:(n:string)=>Promise<Uint8Array|null>}} */
  async function open(arrayBuffer) {
    if (!supported()) throw new Error('הדפדפן הזה לא תומך בפענוח ZIP. נסו Chrome, Edge או Firefox עדכניים.');
    const u8 = new Uint8Array(arrayBuffer);
    const dv = new DataView(arrayBuffer);

    // סוף הספרייה המרכזית
    let eocd = -1;
    const back = Math.min(u8.length, 66000);
    for (let i = u8.length - 22; i >= u8.length - back && i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('הקובץ אינו ארכיון xlsx תקין');

    let count = dv.getUint16(eocd + 10, true);
    let cdOff = dv.getUint32(eocd + 16, true);

    if (cdOff === 0xffffffff || count === 0xffff) {           // ZIP64
      for (let i = eocd - 20; i >= 0; i--) {
        if (dv.getUint32(i, true) !== 0x07064b50) continue;
        const z64 = Number(dv.getBigUint64(i + 8, true));
        if (dv.getUint32(z64, true) === 0x06064b50) {
          count = Number(dv.getBigUint64(z64 + 32, true));
          cdOff = Number(dv.getBigUint64(z64 + 48, true));
        }
        break;
      }
    }

    const dec = new TextDecoder('utf-8');
    const entries = new Map();
    let p = cdOff;
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      let comp = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const cmtLen = dv.getUint16(p + 32, true);
      let local = dv.getUint32(p + 42, true);
      // יש מייצאים (בעיקר ב-Windows) שכותבים נתיבים עם לוכסן הפוך, או עם לוכסן בהתחלה
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/').replace(/^\/+/, '');

      if (comp === 0xffffffff || local === 0xffffffff) {       // שדה ZIP64 נוסף
        let q = p + 46 + nameLen; const end = q + extraLen;
        while (q + 4 <= end) {
          const id = dv.getUint16(q, true), sz = dv.getUint16(q + 2, true);
          if (id === 0x0001) {
            let r = q + 4;
            if (dv.getUint32(p + 24, true) === 0xffffffff) r += 8;       // uncompressed
            if (comp === 0xffffffff) { comp = Number(dv.getBigUint64(r, true)); r += 8; }
            if (local === 0xffffffff) local = Number(dv.getBigUint64(r, true));
            break;
          }
          q += 4 + sz;
        }
      }
      entries.set(name, { method, comp, local });
      p += 46 + nameLen + extraLen + cmtLen;
    }

    return {
      names: () => Array.from(entries.keys()),
      has: (n) => entries.has(n),
      async get(n) {
        const e = entries.get(n);
        if (!e) return null;
        if (!(e.local >= 0 && e.local + 30 <= u8.length) || dv.getUint32(e.local, true) !== 0x04034b50) throw new Error('רשומה פגומה בארכיון');
        const nl = dv.getUint16(e.local + 26, true), xl = dv.getUint16(e.local + 28, true);
        const start = e.local + 30 + nl + xl;
        if (!(e.comp >= 0 && start + e.comp <= u8.length)) throw new Error('רשומה פגומה בארכיון');
        const raw = u8.subarray(start, start + e.comp);
        if (e.method === 0) { if (raw.length > MAX_ENTRY) throw new Error('הקובץ גדול מדי לקריאה'); return raw; }
        if (e.method === 8) return inflateRaw(raw);
        throw new Error('שיטת דחיסה לא נתמכת בארכיון (' + e.method + ')');
      }
    };
  }

  return { open, supported };
})();
