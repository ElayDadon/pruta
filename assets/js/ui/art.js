/* ==========================================================================
   ui/art.js — האיורים של "פרוטה"
   ---------------------------------------------------------------------------
   1. איור לכל קטגוריה — דו-גוני, נצבע אוטומטית בצבע של הקטגוריה.
   2. גיליוש — דפוסי הקווים העדינים של שטרות כסף והמחאות. נוצרים מתמטית
      (חותמות עגולות ורצועות גלים), ולכן לכל חודש יש "חותם" משלו.
   3. אווטר לבית עסק — אות ראשונה בצבע הקטגוריה.
   4. המטבע (סמל המוצר), ואיורים קטנים: שלושת השלבים, "הכל מסודר", מצב ריק.
   הכל SVG שנבנה בדפדפן: חד בכל גודל, בלי קבצים חיצוניים ובלי אינטרנט.
   ========================================================================== */
window.P = window.P || {};

P.art = (function () {
  'use strict';

  /* ======================================================================
     1. איורי קטגוריות (רשת 48)
     a = צבע מלא · b = בהיר · c = כהה · w = לבן · k* = קווים
     ====================================================================== */
  const ILL = P.dict({
    cart:
      '<circle class="b" cx="17" cy="13.5" r="5.5"/><rect class="b" x="22.5" y="5.5" width="6" height="13" rx="2.2"/><circle class="b" cx="33.5" cy="14" r="4.6"/>' +
      '<path class="kc" d="M4.5 9.5h4.4l2.7 7.3"/>' +
      '<path class="a" d="M10.4 16.6h31l-3.7 14.6a2.4 2.4 0 0 1-2.3 1.8H16.3a2.4 2.4 0 0 1-2.3-1.8z"/>' +
      '<path class="kw5" d="M19 21v7.5M25.7 21v7.5M32.4 21v7.5"/>' +
      '<circle class="c" cx="17.5" cy="39" r="3.3"/><circle class="c" cx="33.2" cy="39" r="3.3"/>',
    cup:
      '<ellipse class="b" cx="23" cy="40" rx="17" ry="3.6"/>' +
      '<path class="kb" d="M16.5 4.5c-2 2.4 2 4.2 0 7.2M23 4.5c-2 2.4 2 4.2 0 7.2M29.5 4.5c-2 2.4 2 4.2 0 7.2"/>' +
      '<path class="ka" d="M34.2 20.4h2.4a4.7 4.7 0 0 1 0 9.4h-2.4"/>' +
      '<path class="a" d="M9.6 15.6h25V26a10.6 10.6 0 0 1-10.6 10.6h-3.8A10.6 10.6 0 0 1 9.6 26z"/>' +
      '<ellipse class="c" cx="22.1" cy="16.4" rx="11.2" ry="2.3"/>' +
      '<path class="kw5" d="M14.2 21.5v5.4"/>',
    car:
      '<path class="b" d="M12 22.5l3.3-8.2a3.2 3.2 0 0 1 3-2h11.4a3.2 3.2 0 0 1 3 2l3.3 8.2z"/>' +
      '<path class="w5" d="M16.7 21.5l2.3-6.2h4.4v6.2zM25.6 21.5v-6.2H30l2.3 6.2z"/>' +
      '<rect class="c" x="9" y="31.5" width="6.6" height="8.5" rx="2.3"/><rect class="c" x="32.4" y="31.5" width="6.6" height="8.5" rx="2.3"/>' +
      '<rect class="a" x="5.5" y="21.4" width="37" height="13.2" rx="5.2"/>' +
      '<circle class="w" cx="11.8" cy="28" r="2.5"/><circle class="w" cx="36.2" cy="28" r="2.5"/>' +
      '<rect class="c" x="18.8" y="26.6" width="10.4" height="3.2" rx="1.6"/>',
    bag:
      '<path class="a" d="M9.4 16h29.2l-1.9 23.3a3 3 0 0 1-3 2.7H14.3a3 3 0 0 1-3-2.7z"/>' +
      '<path class="kc" d="M17.4 20.6v-7.2a6.6 6.6 0 0 1 13.2 0v7.2"/>' +
      '<circle class="c" cx="17.4" cy="20.6" r="1.9"/><circle class="c" cx="30.6" cy="20.6" r="1.9"/>' +
      '<path class="kw5" d="M14.6 25.5v10.5"/>' +
      '<g transform="rotate(-14 30 32)"><rect class="w" x="25.5" y="28.6" width="9.4" height="6.6" rx="1.7"/><circle class="b" cx="28" cy="31.9" r="1.1"/></g>',
    ticket:
      '<g transform="rotate(-14 24 24)">' +
      '<path class="b" d="M11 11h32v5.8a3.9 3.9 0 0 0 0 7.8V30H11v-5.4a3.9 3.9 0 0 0 0-7.8z"/>' +
      '<path class="a" d="M5.5 15.5h34v6.2a3.8 3.8 0 0 0 0 7.6v6.2h-34v-6.2a3.8 3.8 0 0 0 0-7.6z"/>' +
      '<path class="kw5" d="M29.2 18v15" stroke-dasharray="2.2 2.8"/>' +
      '<path class="w" d="M17.2 19.4l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z"/>' +
      '</g>',
    suitcase:
      '<path class="kc" d="M18 15.5v-3.7a2.6 2.6 0 0 1 2.6-2.6h6.8a2.6 2.6 0 0 1 2.6 2.6v3.7"/>' +
      '<circle class="c" cx="12.5" cy="41.8" r="2.4"/><circle class="c" cx="35.5" cy="41.8" r="2.4"/>' +
      '<rect class="a" x="6.5" y="14.5" width="35" height="25.5" rx="5.4"/>' +
      '<rect class="c" x="14" y="14.5" width="3.4" height="25.5"/><rect class="c" x="30.6" y="14.5" width="3.4" height="25.5"/>' +
      '<circle class="w" cx="24" cy="27.2" r="4.4"/><path class="kb" d="M21 27.2h6M24 24.2c1.5 2 1.5 4 0 6"/>',
    phone:
      '<path class="kb" d="M38.6 17.6a9 9 0 0 1 0 12.8M42 14a14 14 0 0 1 0 20"/>' +
      '<rect class="a" x="11.5" y="4.5" width="23.5" height="39" rx="5.6"/>' +
      '<rect class="w" x="14.4" y="9" width="17.7" height="28.6" rx="2.6"/>' +
      '<path class="a" d="M21 18.2v10.6a1 1 0 0 0 1.5.9l8-5.3a1 1 0 0 0 0-1.7l-8-5.3a1 1 0 0 0-1.5.8z"/>' +
      '<rect class="w5" x="20.3" y="6.1" width="6" height="1.5" rx=".75"/><rect class="w5" x="19.3" y="39.7" width="8" height="1.7" rx=".85"/>',
    bulb:
      '<circle class="b" cx="24" cy="19" r="16"/>' +
      '<path class="a" d="M24 6.5a11.3 11.3 0 0 0-6.6 20.5c1 .8 1.7 2 1.7 3.3v1.4h9.8v-1.4c0-1.3.7-2.5 1.7-3.3A11.3 11.3 0 0 0 24 6.5z"/>' +
      '<rect class="c" x="18.8" y="33" width="10.4" height="3.2" rx="1.6"/><rect class="c" x="20.3" y="37.6" width="7.4" height="3.2" rx="1.6"/>' +
      '<path class="w" d="M25.8 11.5 20.4 20h4.2l-2.2 7.3 6-9.3h-4.4z"/>',
    pill:
      '<path class="c" d="M35 4.5h4v4h4v4h-4v4h-4v-4h-4v-4h4z"/>' +
      '<g transform="rotate(-38 23 26)">' +
      '<path class="a" d="M14.5 18.5H23v15h-8.5a7.5 7.5 0 0 1 0-15z"/>' +
      '<path class="b" d="M23 18.5h8.5a7.5 7.5 0 0 1 0 15H23z"/>' +
      '<path class="kw5" d="M12.2 23.3h6"/></g>',
    dumbbell:
      '<g transform="rotate(-32 24 24)">' +
      '<rect class="c" x="10" y="22.3" width="28" height="3.4" rx="1.7"/>' +
      '<rect class="a" x="5.6" y="13.5" width="6" height="21" rx="2.3"/><rect class="b" x="11.6" y="16.8" width="4" height="14.4" rx="1.7"/>' +
      '<rect class="a" x="36.4" y="13.5" width="6" height="21" rx="2.3"/><rect class="b" x="32.4" y="16.8" width="4" height="14.4" rx="1.7"/>' +
      '</g>',
    cap:
      '<path class="c" d="M12 21.5v8.8c0 3.3 5.4 6 12 6s12-2.7 12-6v-8.8L24 27z"/>' +
      '<path class="a" d="M24 9 44 18 24 27 4 18z"/>' +
      '<path class="kw5" d="M24 13.2 35.5 18.4"/>' +
      '<path class="kc" d="M40 19.6v9.4" stroke-width="2"/><circle class="b" cx="40" cy="31.4" r="2.5"/>',
    shield:
      '<path class="a" d="M24 4.5 39.5 10v11.8c0 9.6-6.5 16.9-15.5 20.4-9-3.5-15.5-10.8-15.5-20.4V10z"/>' +
      '<path class="w2" d="M24 4.5 39.5 10v11.8c0 9.6-6.5 16.9-15.5 20.4z"/>' +
      '<path class="kw" d="M17 23.5 22 28.5 31.5 18.5" stroke-width="3.4"/>',
    house:
      '<rect class="c" x="31" y="8" width="4.6" height="9.5" rx="1.2"/>' +
      '<rect class="b" x="10" y="19" width="28" height="22.5" rx="2.6"/>' +
      '<path class="a" d="M5.3 21.2 24 6.3l18.7 14.9a1.9 1.9 0 0 1-1.2 3.4H6.5a1.9 1.9 0 0 1-1.2-3.4z"/>' +
      '<rect class="a" x="20" y="29.5" width="8" height="12" rx="1.6"/>' +
      '<rect class="w" x="12.6" y="28.6" width="5" height="5" rx="1.2"/><rect class="w" x="30.4" y="28.6" width="5" height="5" rx="1.2"/>',
    cash:
      '<rect class="b" x="5" y="11.5" width="33" height="20.5" rx="3.3" transform="rotate(-9 21.5 21.75)"/>' +
      '<rect class="a" x="8.5" y="17" width="35" height="21.5" rx="3.4"/>' +
      '<circle class="w" cx="26" cy="27.75" r="6"/>' +
      '<path class="ka" d="M23.4 30.8v-5.6h2.8a1.6 1.6 0 0 1 1.6 1.6v2.2M28.6 24.7v5.6h-2.8a1.6 1.6 0 0 1-1.6-1.6v-2.2" stroke-width="1.6"/>' +
      '<circle class="w5" cx="13.6" cy="22" r="1.8"/><circle class="w5" cx="38.4" cy="33.5" r="1.8"/>',
    receipt:
      '<path class="a" d="M10.5 5.5h27v35l-3.375-2.4-3.375 2.4-3.375-2.4-3.375 2.4-3.375-2.4-3.375 2.4-3.375-2.4-3.375 2.4z"/>' +
      '<path class="kw5" d="M16 12.5h16M16 18.5h16M16 24.5h9"/>' +
      '<circle class="c" cx="31.2" cy="29.6" r="5.6"/><path class="kw" d="m28.7 29.7 1.8 1.8 3.2-3.5" stroke-width="2"/>',
    paw:
      '<path class="a" d="M24 24.5c-5.3 0-10.5 6-10.5 10.2 0 3 2.5 4.8 5.3 4 2-.6 3.3-1 5.2-1s3.2.4 5.2 1c2.8.8 5.3-1 5.3-4 0-4.2-5.2-10.2-10.5-10.2z"/>' +
      '<ellipse class="a" cx="13.5" cy="19.5" rx="3.4" ry="4.4" transform="rotate(-22 13.5 19.5)"/>' +
      '<ellipse class="a" cx="20" cy="12.3" rx="3.5" ry="4.7"/><ellipse class="a" cx="28" cy="12.3" rx="3.5" ry="4.7"/>' +
      '<ellipse class="a" cx="34.5" cy="19.5" rx="3.4" ry="4.4" transform="rotate(22 34.5 19.5)"/>' +
      '<path class="kw5" d="M19.8 30.6c1.1-1.5 2.4-2.3 3.8-2.5"/>',
    gift:
      '<rect class="a" x="9" y="21.5" width="30" height="20" rx="2.6"/>' +
      '<rect class="c" x="7" y="15" width="34" height="7.8" rx="2.2"/>' +
      '<rect class="w5" x="21.5" y="15" width="5" height="26.5"/>' +
      '<path class="a" d="M24 15c-1.8-5.6-10-7.4-10-2.8 0 3 6 2.8 10 2.8zM24 15c1.8-5.6 10-7.4 10-2.8 0 3-6 2.8-10 2.8z"/>',
    coins:
      '<rect class="c" x="7.5" y="33.6" width="22" height="5.6" rx="2.8"/><rect class="a" x="7.5" y="28.3" width="22" height="5.6" rx="2.8"/>' +
      '<rect class="c" x="7.5" y="23" width="22" height="5.6" rx="2.8"/><rect class="a" x="7.5" y="17.7" width="22" height="5.6" rx="2.8"/>' +
      '<path class="kw5" d="M11.5 20.5h6"/>' +
      '<circle class="b" cx="35.5" cy="14" r="8.6"/><path class="ka" d="M35.5 18.6V9.4M31.8 12.8l3.7-3.7 3.7 3.7"/>',
    card:
      '<rect class="b" x="4" y="10" width="31" height="21" rx="3.4" transform="rotate(-9 19.5 20.5)"/>' +
      '<rect class="a" x="9.5" y="16" width="34" height="22" rx="3.6"/>' +
      '<rect class="c" x="9.5" y="21" width="34" height="4.4"/>' +
      '<rect class="w" x="13.5" y="29" width="7" height="5" rx="1.2"/><rect class="w5" x="25" y="31" width="14" height="2" rx="1"/>',
    pending:
      '<circle class="b" cx="24" cy="24" r="17"/>' +
      '<circle class="ka" cx="24" cy="24" r="17" stroke-width="2.3" stroke-dasharray="4.5 4"/>' +
      '<path class="ka" d="M19.3 19.4a4.9 4.9 0 1 1 7.2 4.3c-1.4.7-2.5 1.7-2.5 3.3v.8" stroke-width="3.2"/>' +
      '<circle class="a" cx="24" cy="33.2" r="2.1"/>',
    tag:
      '<path class="a" d="M7 9.6v12.8a2.4 2.4 0 0 0 .7 1.7l16 16a2.4 2.4 0 0 0 3.4 0l12.6-12.6a2.4 2.4 0 0 0 0-3.4l-16-16A2.4 2.4 0 0 0 22 7.4H9.2A2.2 2.2 0 0 0 7 9.6z"/>' +
      '<circle class="w" cx="15" cy="15.5" r="3.1"/><path class="kw5" d="M21.5 25.5l6 6M25.5 21.5l6 6"/>'
  });

  const MAP = P.dict({
    'מזון ומכולת': 'cart', 'מסעדות וקפה': 'cup', 'תחבורה ודלק': 'car', 'קניות וביגוד': 'bag',
    'בילויים ופנאי': 'ticket', 'נסיעות וחופשות': 'suitcase', 'מנויים ודיגיטל': 'phone', 'חשבונות ותשתיות': 'bulb',
    'בריאות ותרופות': 'pill', 'ספורט וכושר': 'dumbbell', 'חינוך וילדים': 'cap', 'ביטוח ופיננסים': 'shield',
    'דיור ושכירות': 'house', 'העברות ומזומן': 'cash', 'מיסים ואגרות': 'receipt', 'חיות מחמד': 'paw',
    'מתנות ותרומות': 'gift', 'הכנסות': 'coins', 'חיובי אשראי': 'card', 'לא משויך': 'pending'
  });
  /** קטגוריה שהמשתמש יצר — ניחוש איור לפי מילים בשם */
  const GUESS = [
    [/(רכב|דלק|חני|תחבור|car|fuel|transport|parking)/i, 'car'], [/(אוכל|מזון|סופר|מכול|grocer|food)/i, 'cart'],
    [/(מסעד|קפה|בר|restaurant|cafe|coffee|dining)/i, 'cup'], [/(בית|דיור|שכיר|house|rent|home)/i, 'house'],
    [/(ילד|חינוך|לימוד|גן|school|kid|education)/i, 'cap'], [/(בריאות|רפוא|תרופ|health|pharm|medical)/i, 'pill'],
    [/(ספורט|כושר|sport|gym|fitness)/i, 'dumbbell'], [/(טיול|חופש|נסיע|טיס|travel|flight|hotel)/i, 'suitcase'],
    [/(מנוי|דיגיט|אפליק|subscri|digital|stream)/i, 'phone'], [/(חשבון|חשמל|מים|גז|util|bill)/i, 'bulb'],
    [/(ביטוח|insur)/i, 'shield'], [/(מתנ|תרומ|gift|donat)/i, 'gift'], [/(קניות|ביגוד|אופנה|shop|cloth)/i, 'bag'],
    [/(בילוי|פנאי|סרט|הופע|fun|entertain|movie)/i, 'ticket'], [/(הכנס|משכורת|income|salary)/i, 'coins'],
    [/(מס|אגר|tax|fee)/i, 'receipt'], [/(כלב|חתול|חיות|pet|dog|cat)/i, 'paw'], [/(אשראי|כרטיס|card|credit)/i, 'card'],
    [/(מזומן|העבר|cash|transfer)/i, 'cash']
  ];
  function artKey(cat) {
    if (MAP[cat]) return MAP[cat];
    for (const [re, k] of GUESS) if (re.test(cat || '')) return k;
    return 'tag';
  }
  function colorFor(cat) {
    if (P.cats && cat === P.cats.OTHER) return 'var(--mark)';
    if (P.cats && cat === P.cats.INCOME) return 'var(--pos)';
    return P.state && P.state.tintOf ? P.state.tintOf(cat) : 'var(--c-rest)';
  }
  function illSvg(key) { return '<svg class="ill" viewBox="0 0 48 48" aria-hidden="true">' + (ILL[key] || ILL.tag) + '</svg>'; }

  /** אריח איור של קטגוריה. size בפיקסלים */
  function tile(cat, size, color) {
    const node = document.createElement('span');
    node.className = 'ctile';
    node.style.setProperty('--c', color || colorFor(cat));
    if (size) node.style.setProperty('--s', size + 'px');
    node.innerHTML = illSvg(artKey(cat));
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  /* ======================================================================
     3. אווטר בית עסק
     ====================================================================== */
  function initials(label) {
    const words = String(label || '').replace(/[‎‏]/g, '').trim().split(/\s+/)
      .map((w) => w.replace(/[^A-Za-zא-ת]/g, '')).filter(Boolean);
    if (!words.length) return '₪';
    const w = words[0];
    if (/^[A-Za-z]/.test(w)) {
      const second = words[1] && /^[A-Za-z]/.test(words[1]) ? words[1][0] : '';
      return (w[0] + second).toUpperCase();
    }
    return w[0];
  }
  function avatar(label, cat, size) {
    const node = document.createElement('span');
    node.className = 'avatar';
    node.style.setProperty('--c', colorFor(cat));
    if (size) node.style.setProperty('--s', size + 'px');
    node.textContent = initials(label);
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  /* ======================================================================
     2. גיליוש
     ====================================================================== */
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let s = (typeof seed === 'number' ? seed : hashStr(String(seed))) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function polarPath(cx, cy, fnR, samples) {
    let d = '';
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const r = fnR(t);
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(t)).toFixed(1) + ' ' + (cy + r * Math.sin(t)).toFixed(1);
    }
    return d + 'Z';
  }
  function svgWrap(viewBox, inner, cls, extra) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', viewBox);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    if (cls) s.setAttribute('class', cls);
    if (extra) for (const k in extra) s.setAttribute(k, extra[k]);
    s.innerHTML = inner;
    return s;
  }

  /**
   * חותם עגול בסגנון שטר: שלוש טבעות, בכל אחת עשרות עקומות גליות
   * שמסובבות זו ביחס לזו — וכך נוצרת רשת הקווים המוכרת מהדפסת ביטחון.
   * opts: { seed, color, width, petals, quality: 'hi'|'lo', opacity }
   */
  function seal(opts) {
    const o = Object.assign({ seed: 1, color: 'currentColor', width: 0.42, opacity: 1, quality: 'hi' }, opts);
    const r = rng(o.seed);
    const p1 = o.petals || (8 + Math.floor(r() * 6));
    const p3 = Math.max(5, p1 - 3 - Math.floor(r() * 3));
    const hi = o.quality === 'hi';
    const rings = [
      { R: 78, A: 13, p: p1, B: 0.9, n: hi ? 26 : 12, s: hi ? 540 : 220, op: .95 },
      { R: 50, A: 9, p: p1, B: 0.6, n: hi ? 22 : 10, s: hi ? 380 : 180, op: .75 },
      { R: 27, A: 5, p: p3, B: 0, n: hi ? 14 : 8, s: hi ? 240 : 140, op: .6 }
    ];
    let inner = '';
    rings.forEach((g) => {
      let d = '';
      for (let k = 0; k < g.n; k++) {
        const ph = (k / g.n) * Math.PI * 2;
        d += polarPath(0, 0, (t) => g.R + g.A * Math.sin(g.p * t + ph) + g.B * Math.sin(2 * g.p * t - ph * 0.5), g.s);
      }
      inner += '<path d="' + d + '" fill="none" style="stroke:' + o.color + '" stroke-width="' + o.width + '" opacity="' + g.op + '"/>';
    });
    // הצבע ב-style ולא כמאפיין, כדי שיעבוד גם עם משתני CSS (var(--c))
    inner += '<circle r="96" fill="none" style="stroke:' + o.color + '" stroke-width="' + (o.width * 1.8) + '" opacity=".5"/>';
    inner += '<circle r="99" fill="none" style="stroke:' + o.color + '" stroke-width="' + o.width + '" opacity=".35" stroke-dasharray="1 2.4"/>';
    inner += '<circle r="11" fill="none" style="stroke:' + o.color + '" stroke-width="' + o.width * 1.4 + '" opacity=".7"/>';
    return svgWrap('-100 -100 200 200', inner, o.cls || '', { opacity: o.opacity });
  }

  /**
   * רצועת גיליוש אופקית: קווים גליים שמתפתלים זה סביב זה.
   * opts: { width, height, lines, color, seed, strokeWidth }
   */
  function band(opts) {
    const o = Object.assign({ width: 1200, height: 320, lines: 18, color: '#fff', seed: 7, strokeWidth: 0.7 }, opts);
    const r = rng(o.seed);
    const W = o.width, H = o.height;
    const l1 = W / (2.2 + r() * 1.2), l2 = W / (5 + r() * 3), l3 = W / (0.8 + r() * 0.5);
    const groups = [{ y: H * 0.34, A: H * 0.1, op: .9 }, { y: H * 0.74, A: H * 0.07, op: .55 }];
    let inner = '';
    groups.forEach((g, gi) => {
      let d = '';
      for (let k = 0; k < o.lines; k++) {
        const ph = (k / o.lines) * Math.PI * 2;
        for (let x = -10, i = 0; x <= W + 10; x += 8, i++) {
          const y = g.y + g.A * Math.sin((x / l1) * Math.PI * 2 + ph) + g.A * 0.45 * Math.sin((x / l2) * Math.PI * 2 - ph * 1.7 + gi) + g.A * 0.6 * Math.sin((x / l3) * Math.PI * 2 + gi * 2);
          d += (i ? 'L' : 'M') + x.toFixed(0) + ' ' + y.toFixed(1);
        }
      }
      inner += '<path d="' + d + '" fill="none" style="stroke:' + o.color + '" stroke-width="' + o.strokeWidth + '" opacity="' + g.op + '"/>';
    });
    return svgWrap('0 0 ' + W + ' ' + H, inner, o.cls || '', { preserveAspectRatio: 'xMidYMid slice' });
  }

  /* ======================================================================
     4. איורים קטנים: שלושת השלבים בעמוד הפתיחה, "הכל מסודר", מצב ריק, והמטבע
     ====================================================================== */
  function stepArt(kind) {
    const S = {
      export:
        '<rect x="14" y="6" width="36" height="52" rx="8" style="fill:var(--accent-tint)"/>' +
        '<rect x="20" y="16" width="24" height="26" rx="3" style="fill:var(--surface)"/>' +
        '<path d="M20 24.5h24M20 33h24M28 16v26M36 16v26" style="stroke:var(--c2)" stroke-width="1.6" opacity=".7"/>' +
        '<circle cx="46" cy="46" r="11" style="fill:var(--accent)"/><path d="M46 40.5v10M41.8 46.5 46 50.7l4.2-4.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
      drop:
        '<rect x="8" y="34" width="48" height="22" rx="8" style="fill:var(--accent-tint)"/>' +
        '<path d="M8 42h14l3 5h14l3-5h14" fill="none" style="stroke:var(--accent)" stroke-width="2.2" stroke-linejoin="round"/>' +
        '<g transform="rotate(-10 32 22)"><rect x="21" y="6" width="22" height="28" rx="4" style="fill:var(--surface);stroke:var(--accent)" stroke-width="2"/><path d="M26 15h12M26 20h12M26 25h7" style="stroke:var(--c2)" stroke-width="2" stroke-linecap="round"/></g>' +
        '<path d="M44 26v14l3.6-3.4 2.7 5.6 2.6-1.2-2.7-5.6 5-.2z" style="fill:var(--ink)"/>',
      see:
        '<rect x="6" y="8" width="52" height="48" rx="10" style="fill:var(--accent-tint)"/>' +
        '<g transform="translate(24 30) rotate(-90)"><circle r="10" fill="none" style="stroke:var(--c1)" stroke-width="7" stroke-dasharray="30 70"/><circle r="10" fill="none" style="stroke:var(--c2)" stroke-width="7" stroke-dasharray="18 70" stroke-dashoffset="-31"/><circle r="10" fill="none" style="stroke:var(--c3)" stroke-width="7" stroke-dasharray="11 70" stroke-dashoffset="-50"/></g>' +
        '<rect x="38" y="30" width="5" height="16" rx="2" style="fill:var(--c4)"/><rect x="45" y="22" width="5" height="24" rx="2" style="fill:var(--c5)"/>' +
        '<path d="M14 49h36" style="stroke:var(--ink-4)" stroke-width="2" stroke-linecap="round"/>'
    };
    return svgWrap('0 0 64 64', S[kind] || S.see, '');
  }

  /** איור "הכל מסודר": חותם עם וי וקונפטי */
  function doneArt(tone) {
    const c = tone === 'accent' ? 'var(--accent)' : 'var(--pos)';
    const conf = [[22, 36, 'var(--c3)', 0], [196, 46, 'var(--c4)', 30], [40, 120, 'var(--c1)', 60], [182, 118, 'var(--c2)', -20], [70, 18, 'var(--c5)', 15], [150, 16, 'var(--c6)', -35], [16, 80, 'var(--c7)', 45], [204, 86, 'var(--c3)', 10]];
    const inner =
      '<ellipse cx="110" cy="146" rx="54" ry="8" style="fill:var(--ink)" opacity=".07"/>' +
      '<path transform="translate(110 78)" d="M0-56 13.5-46.7 30-48.3 36.8-33.2 51.7-26 49.6-9.6 56 5.6 45.3 18.2 44 34.6 28.1 39.7 18.6 53.2 2.4 50.5-12.4 57.5-23.7 45.7-40 44.6-44.3 28.8-56 17.5-50.2 2-56-13.6-43.6-24.4-41.3-40.8-25.3-44.8-14.6-57.3 1.8-53.6z" style="fill:' + c + '"/>' +
      '<circle cx="110" cy="78" r="37" fill="#fff" opacity=".18"/>' +
      '<path d="M91 79l13 13 26-27" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
      conf.map((k) => '<rect x="' + (k[0] - 4) + '" y="' + (k[1] - 7) + '" width="8" height="14" rx="2.5" transform="rotate(' + k[3] + ' ' + k[0] + ' ' + k[1] + ')" style="fill:' + k[2] + '"/>').join('');
    return svgWrap('0 0 220 160', inner, '');
  }
  /** איור "אין כאן כלום": זכוכית מגדלת מעל דף ריק */
  function emptyArt() {
    const inner =
      '<ellipse cx="110" cy="148" rx="60" ry="8" style="fill:var(--ink)" opacity=".06"/>' +
      '<rect x="56" y="22" width="92" height="118" rx="14" style="fill:var(--surface);stroke:var(--rule-strong)" stroke-width="2"/>' +
      '<rect x="72" y="44" width="46" height="8" rx="4" style="fill:var(--ink-4)" opacity=".7"/>' +
      '<rect x="72" y="64" width="60" height="6" rx="3" style="fill:var(--rule-strong)"/><rect x="72" y="80" width="52" height="6" rx="3" style="fill:var(--rule-strong)"/><rect x="72" y="96" width="36" height="6" rx="3" style="fill:var(--rule-strong)"/>' +
      '<circle cx="146" cy="100" r="26" style="fill:var(--accent-soft);stroke:var(--accent)" stroke-width="7"/>' +
      '<path d="M165 119l18 18" style="stroke:var(--accent)" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M134 92a14 14 0 0 1 14-6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/>';
    return svgWrap('0 0 220 160', inner, '');
  }

  /* ======================================================================
     5. המטבע — סמל המוצר
     שני צדדים (פ / ₪), כדי שאפשר יהיה לסובב אותו בתלת-ממד. size בפיקסלים.
     ====================================================================== */
  function coin(size) {
    const node = document.createElement('span');
    node.className = 'coin';
    if (size) node.style.setProperty('--s', size + 'px');
    node.setAttribute('aria-hidden', 'true');
    const rim = seal({ seed: 9, color: '#8a5200', width: 1.5, petals: 10, quality: 'lo' }).outerHTML;
    node.innerHTML =
      '<span class="coin__face">' + rim + '<b>פ</b></span>' +
      '<span class="coin__face coin__face--back">' + rim + '<b>₪</b></span>';
    return node;
  }

  return { tile, avatar, initials, artKey, colorFor, illSvg, seal, band, coin, stepArt, doneArt, emptyArt, hashStr, ILL };
})();
