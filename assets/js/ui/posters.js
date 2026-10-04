/* ==========================================================================
   ui/posters.js — העיצוב של כל חודש, ותמונת השער של כל קטגוריה
   ---------------------------------------------------------------------------
   לכל אחד מ-12 חודשי השנה יש "פוסטר" משלו: צילום עונתי, פלטה של שלושה
   גוונים שנגזרה מהצילום, מילה אחת שמתארת את העונה, והספרה הגדולה של החודש.
   הפוסטר מופיע בכרטיס החודש, בראש חלון החודש ובכותרת הסקירה — כך שכל חודש
   נראה אחרת, ועדיין שייך לאותה משפחה.

   הצילומים חופשיים לשימוש (Pixabay Content License) ושמורים מקומית
   בתיקייה assets/img — בלי שום בקשה לרשת. פירוט ב-CREDITS.md.
   ========================================================================== */
window.P = window.P || {};

P.posters = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt;

  /* deep = כהה (מאחורי הטקסט), mid = צבע הזהות, light = הבהרה. fx/fy = מוקד הצילום באחוזים */
  const MONTHS = [
    { deep: '#0d2b55', mid: '#3d7cc9', light: '#dcecff', word: 'כפור', fx: 40, fy: 60 },          // ינואר
    { deep: '#5a1741', mid: '#d4628f', light: '#ffe2ee', word: 'פריחה', fx: 35, fy: 45 },         // פברואר
    { deep: '#5e0d0f', mid: '#e2412e', light: '#ffdccb', word: 'כלניות', fx: 38, fy: 50 },        // מרץ
    { deep: '#123c1c', mid: '#4f9f2e', light: '#e3f6bd', word: 'אביב', fx: 40, fy: 60 },          // אפריל
    { deep: '#46290a', mid: '#c4832a', light: '#f8e3b9', word: 'קציר', fx: 45, fy: 50 },          // מאי
    { deep: '#2b1c5c', mid: '#7d63d2', light: '#e6deff', word: 'לבנדר', fx: 40, fy: 55 },         // יוני
    { deep: '#06486b', mid: '#18a4d8', light: '#cbf2ff', word: 'בריכה', fx: 32, fy: 45 },         // יולי
    { deep: '#571706', mid: '#f06a1e', light: '#ffd9a6', word: 'שקיעה', fx: 45, fy: 60 },         // אוגוסט
    { deep: '#4c0a1b', mid: '#bd2140', light: '#ffd3d3', word: 'רימונים', fx: 52, fy: 50 },       // ספטמבר
    { deep: '#3b1907', mid: '#b9591b', light: '#f8dba9', word: 'שלכת', fx: 30, fy: 50 },          // אוקטובר
    { deep: '#12292b', mid: '#3f716c', light: '#d6e8e2', word: 'ערפל', fx: 50, fy: 50 },          // נובמבר
    { deep: '#17100a', mid: '#cf9130', light: '#ffe5a8', word: 'אור נרות', fx: 40, fy: 55 }       // דצמבר
  ];
  const idx = (key) => {
    const m = typeof key === 'number' ? key : +String(key).slice(5, 7);
    return Math.min(12, Math.max(1, m || 1)) - 1;
  };
  const info = (key) => MONTHS[idx(key)];
  const src = (key) => 'assets/img/months/' + String(idx(key) + 1).padStart(2, '0') + '.jpg';
  /** משתני הצבע של החודש — אפשר להחיל על כל אלמנט שרוצה "להתלבש" בחודש */
  function vars(key) {
    const m = info(key);
    return { '--m-deep': m.deep, '--m-mid': m.mid, '--m-light': m.light };
  }

  /*
   * צילום שנטען בפעם הראשונה מופיע בהדרגה מעל צבע החודש, במקום "לקפוץ" למקומו.
   * צילום שכבר הוצג פעם מופיע מיד — כך רענון של עמוד לא גורם להבהוב.
   */
  const shown = new Set();
  function appear(img) {
    const key = img.getAttribute('src');
    if (shown.has(key)) { img.classList.add('is-loaded'); return img; }
    const done = () => { shown.add(key); img.classList.add('is-loaded'); };
    img.addEventListener('load', done, { once: true });     // קובץ שחסר פשוט לא מופיע: נשאר צבע החודש
    return img;
  }

  /**
   * פוסטר של חודש.
   * opts: { size: 'card'|'cover'|'hero', label: bool (שם החודש על הפוסטר), eager: bool }
   */
  function month(key, opts) {
    const o = opts || {};
    const m = info(key);
    const n = idx(key) + 1;
    const img = el('img.poster__img', { src: src(key), alt: '', loading: o.eager ? 'eager' : 'lazy', decoding: 'async', draggable: 'false',
      style: 'object-position:' + m.fx + '% ' + m.fy + '%' });
    // בכותרת הרחבה הצילום מורחב ומוסט, כך שמוקד התמונה יושב בשליש השמאלי — הרחק מהטקסט שמימין
    if (o.size === 'hero') img.style.setProperty('--hx', Math.max(-35, Math.min(0, 28 - m.fx * 1.35)).toFixed(1) + '%');
    appear(img);
    const seal = P.art.seal({ seed: 300 + n * 17, color: '#fff', width: 0.7, petals: 6 + (n % 6), quality: 'lo', cls: 'poster__seal' });
    return el('div.poster.poster--' + (o.size || 'card'), { vars: vars(key), 'data-month': String(n) }, [
      img,
      el('div.poster__scrim'),
      seal,
      el('span.poster__num', { 'aria-hidden': 'true', text: String(n).padStart(2, '0') }),
      o.label ? el('div.poster__label', null, [
        el('b', { text: fmt.MONTH_LONG[n - 1] }),
        el('span', { text: m.word })
      ]) : null
    ]);
  }

  /* ---------- קטגוריות ---------- */
  const CAT_PHOTO = P.dict({
    'מזון ומכולת': 'groceries', 'מסעדות וקפה': 'dining', 'תחבורה ודלק': 'transport', 'קניות וביגוד': 'shopping',
    'בילויים ופנאי': 'fun', 'נסיעות וחופשות': 'travel', 'מנויים ודיגיטל': 'digital', 'חשבונות ותשתיות': 'bills',
    'בריאות ותרופות': 'health', 'ספורט וכושר': 'sport', 'חינוך וילדים': 'education', 'ביטוח ופיננסים': 'finance',
    'דיור ושכירות': 'housing', 'העברות ומזומן': 'cash', 'מיסים ואגרות': 'taxes', 'חיות מחמד': 'pets',
    'מתנות ותרומות': 'gifts', 'חיובי אשראי': 'card', 'הכנסות': 'income', 'לא משויך': 'pending'
  });
  // קטגוריות שהמשתמש יצר: ניחוש לפי השם, כמו באיורים
  const GUESS = [
    [/(מזון|מכולת|סופר|אוכל|grocer|food)/i, 'groceries'], [/(מסעד|קפה|בר|restaurant|cafe|dining)/i, 'dining'],
    [/(רכב|דלק|תחבור|חני|car|fuel|transport)/i, 'transport'], [/(קניות|ביגוד|אופנה|shop|cloth)/i, 'shopping'],
    [/(בילוי|פנאי|תחביב|fun|leisure|hobby)/i, 'fun'], [/(טיול|חופש|נסיע|טיס|travel|vacation)/i, 'travel'],
    [/(מנוי|דיגיט|תוכנ|subscri|digital|software)/i, 'digital'], [/(חשבון|חשמל|מים|גז|bill|util)/i, 'bills'],
    [/(בריאות|רפוא|תרופ|health|medical)/i, 'health'], [/(ספורט|כושר|sport|gym)/i, 'sport'],
    [/(ילד|חינוך|לימוד|גן|school|kid|education)/i, 'education'], [/(ביטוח|השקע|חיסכון|insur|invest|saving)/i, 'finance'],
    [/(בית|דירה|שכירות|משכנת|דיור|home|rent)/i, 'housing'], [/(מזומן|העבר|cash|transfer)/i, 'cash'],
    [/(מס|אגר|tax|fee)/i, 'taxes'], [/(כלב|חתול|חיות|pet|dog|cat)/i, 'pets'], [/(מתנ|תרומ|gift|donat)/i, 'gifts'],
    [/(אשראי|כרטיס|card|credit)/i, 'card'], [/(הכנס|משכורת|income|salary)/i, 'income']
  ];
  function photoKey(cat) {
    if (CAT_PHOTO[cat]) return CAT_PHOTO[cat];
    for (const [re, k] of GUESS) if (re.test(cat || '')) return k;
    return 'other';
  }
  const catSrc = (cat) => 'assets/img/cats/' + photoKey(cat) + '.jpg';

  /** תמונת שער לקטגוריה: הצילום נצבע בגוון הקטגוריה, כך שכל השערים נראים כמשפחה אחת */
  function cover(cat, color, opts) {
    const o = opts || {};
    return el('div.cover' + (o.cls ? '.' + o.cls : ''), { vars: { '--c': color || P.state.tintOf(cat) } }, [
      appear(el('img.cover__img', { src: o.src || catSrc(cat), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })),
      el('div.cover__tint'),
      el('div.cover__scrim')
    ]);
  }

  /** צילום "חיים" צבעוני (לעמוד הפתיחה ולפתיח): coffee | beach | home | market */
  const life = (name) => 'assets/img/life/' + name + '.jpg';

  return { MONTHS, info, src, vars, month, cover, catSrc, photoKey, life };
})();
