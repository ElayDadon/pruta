/* ==========================================================================
   core/categories.js — ברירת המחדל של הקטגוריות, מנוע הסיווג והצעות השיוך.
   הסיווג עובד לפי "המילה הארוכה ביותר שנמצאה בתיאור" — כלל אחד, צפוי וניתן לעריכה.
   ========================================================================== */
window.P = window.P || {};

P.cats = (function () {
  'use strict';

  const OTHER = 'לא משויך';
  const INCOME = 'הכנסות';

  /* שמונה צבעים בסדר קבוע, שנשארים נבדלים זה מזה גם בעיוורון צבעים (ראו tokens.css); מעבר להם — אפור "שאר" */
  const SLOTS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
  const REST = 'var(--c-rest)';


  const DEFAULTS = {
    'מזון ומכולת': ['שופרסל','רמי לוי','ויקטורי','יוחננוף','אושר עד','טיב טעם','יינות ביתן','מגה בעיר','סופרמרקט','מכולת','חצי חינם','קרפור','carrefour','שפע','סטופ מרקט','מחסני השוק','קינג סטור','פרש מרקט','יש חסד','יש בשכונה','am pm','ampm','ירקות','פירות','מעדנייה','אטליז','קצביה','מאפיית','חנות נוחות','טיב מרקט','סלט'],
    'מסעדות וקפה': ['מסעד','קפה','cafe','coffee','ארומה','לנדוור','גרג','קפיטו','מקדונלד','burger','בורגר','פיצה','pizza','דומינו','סושי','sushi','חומוס','פלאפל','שווארמה','קבב','kfc','wolt','וולט','תן ביס','10bis','משלוחה','סטארבקס','רולדין','קונדיטור','מאפה','bakery','ביסטרו','פאב','גלידה','ארוחה','טאקו','נודלס','שיפודי','גריל','בית קפה','מזללה'],
    'תחבורה ודלק': ['פז','paz','דלק','delek','סונול','sonol','דור אלון','תדלוק','תחנת דלק','רב קו','רב-קו','pango','פנגו','cellopark','סלופארק','חניון','חניה','רכבת','אגד','מטרופולין','קווים','סופרבוס','מונית','gett','uber','אובר','yango','יאנגו','כביש 6','דרך ארץ','נתיבי','מוסך','צמיג','שטיפת רכב','טסט','רישוי רכב','ליסינג','השכרת רכב','קורקינט','אופניים'],
    'קניות וביגוד': ['zara','זארה','castro','קסטרו','fox','פוקס','h&m','renuar','רנואר','גולף','golf','american eagle','pull','bershka','terminalx','טרמינל איקס','נעלי','scoop','אורבניקה','mango','מנגו','decathlon','דקתלון','ikea','איקאה','home center','הום סנטר','ace','אייס','max stock','מקס סטוק','ורדינון','aliexpress','עלי אקספרס','amazon','אמזון','ebay','shein','asos','סטימצקי','צומת ספרים','כלי בית','ריהוט','תכשיט','בושם','perfume','צעצוע'],
    'בילויים ופנאי': ['סינמה','yes planet','cinema','יס פלאנט','רב חן','גלובוס','תיאטרון','הופעה','ticket','eventim','מוזיאון','פארק','לונה פארק','בריכה','ספורטק','בולינג','חדר בריחה','escape','מופע','פסטיבל','קולנוע','אטרקציה','דיוטי פרי','מועדון'],
    'נסיעות וחופשות': ['מלון','booking','airbnb','טיסה','אל על','ישראייר','ארקיע','wizz','ryanair','נופש','צימר','חופשה','נמל תעופה','סוכנות נסיעות','issta','איסתא','דיילי','kiwi','skyscanner'],
    'מנויים ודיגיטל': ['netflix','נטפליקס','spotify','ספוטיפיי','youtube','apple.com','apple services','itunes','icloud','google','playstation','xbox','steam','nintendo','disney','hbo','chatgpt','openai','anthropic','claude','midjourney','adobe','microsoft','office 365','dropbox','canva','notion','zoom','github','app store','google play','מנוי','subscription','אחסון','דומיין','vpn'],
    'חשבונות ותשתיות': ['חברת החשמל','חשמל','מקורות','תאגיד מים','מי שבע','סופרגז','גז טבעי','אמישראגז','פזגז','ארנונה','עיריית','עירייה','מועצה מקומית','בזק','hot','yes','סלקום','פרטנר','פלאפון','גולן טלקום','רמי לוי תקשורת','019','hotmobile','triple c','אינטרנט','טלוויזיה','ועד בית','ניקיון'],
    'בריאות ותרופות': ['סופרפארם','super-pharm','ניו פארם','בית מרקחת','מכבי','כללית','מאוחדת','לאומית שירותי','קופת חולים','רופא','שיניים','מרפאה','בית חולים','אסותא','הרצליה מדיקל','אופטיק','משקפיים','מעבדה','בדיקות דם','פסיכולוג','פיזיותרפ','דיאטנ','תרופ','טיפול רפואי','חיסון'],
    'ספורט וכושר': ['חדר כושר','הולמס פלייס','holmes','גו אקטיב','go active','אייקון','סינרג','synergy','קאנטרי','פיטנס','fitness','gym','crossfit','קרוספיט','יוגה','פילאטיס','שחייה','מכון כושר'],
    'חינוך וילדים': ['גן ילדים','צהרון','בית ספר','מעון','חוג','חוגים','אוניברסיט','מכללה','קורס','udemy','coursera','שכר לימוד','הסעות','קייטנה','צופים','תנועת נוער','ספרי לימוד','גנון','משפחתון','שיעור פרטי','בייביסיטר'],
    'ביטוח ופיננסים': ['ביטוח','הראל','כלל ביטוח','הפניקס','מגדל ביטוח','מגדל חברה לביטוח','מנורה מבטחים','איילון ביטוח','קופת גמל','שלמה ביטוח','פנסיה','השתלמות','אלטשולר','מיטב','פסגות','ילין לפידות','עמלה','עמלת','ריבית','דמי ניהול','הלוואה','החזר הלוואה','מסלקה'],
    'דיור ושכירות': ['שכירות','שכר דירה','דמי שכירות','משכנתא','תיווך','שיפוץ','אינסטלט','חשמלאי','מזגן','תחזוקה','ריהוט לבית','דמי ניהול בניין'],
    'העברות ומזומן': ['העברה','העברת כספים','bit','ביט','paybox','פייבוקס','pepper pay','פפר פיי','משיכת מזומן','כספומט','atm','הפקדה','המחאה','שיק','צק'],
    'מיסים ואגרות': ['מס הכנסה','מע"מ','מעמ','ביטוח לאומי','מיסים','אגרה','אגרת','קנס','משרד התחבורה','רשות המסים','רשות האוכלוסין','דרכון','מס רכוש','דוח חניה'],
    'חיות מחמד': ['וטרינר','פטשופ','pet','חיות','animal','רויאל קנין','מזון לכלב','מזון לחתול'],
    'מתנות ותרומות': ['תרומה','עמותה','לתת','מתנה','פרחים','צדקה','מעשר','gift card'],
    'חיובי אשראי': ['ישראכרט','isracard','כאל','ויזה כאל','visa cal','מקס איט','max it','לאומי קארד','אמריקן אקספרס','american express','דיינרס','diners','חיוב כרטיס','כרטיס אשראי','כרטיסי אשראי','חיוב חודשי כרטיס'],
    'הכנסות': ['משכורת','שכר עבודה','העברת שכר','החזר מס','מענק','קצבה','דמי לידה','דיבידנד','ריבית זכות','פדיון','זיכוי'],
    'לא משויך': []
  };

  /*
   * שמות שבנקים וחברות אשראי נותנים לקטגוריות שלהם, ומה הם אצלנו.
   * כך "ענף: מזון" מפירוט האשראי או "Restaurants" מבנק זר נכנסים לקטגוריה הנכונה.
   */
  const ALIASES = {
    'מזון ומכולת': ['מזון','מכולת','סופר','סופרמרקט','מרכולים','מזון ומשקאות','groceries','grocery','supermarket','supermarkets','food','boodschappen','lebensmittel'],
    'מסעדות וקפה': ['מסעדות','מסעדה','בתי קפה','קפה','אוכל בחוץ','מזון מהיר','restaurants','restaurant','dining','eating out','cafe','cafes','coffee','food & drink','food and drink','fast food','horeca'],
    'תחבורה ודלק': ['דלק','תחבורה','רכב','חניה','חניונים','תחבורה ציבורית','דלק ותחבורה','fuel','gas','gasoline','petrol','transport','transportation','auto','automotive','car','parking','tolls','vervoer','tanken'],
    'קניות וביגוד': ['אופנה','ביגוד','הלבשה','הנעלה','הלבשה והנעלה','קניות','כלבו','ריהוט','מוצרי חשמל','shopping','clothing','apparel','retail','general merchandise','department stores','electronics','kleding'],
    'בילויים ופנאי': ['פנאי','בילוי','בילויים','בידור','תרבות','פנאי ובידור','entertainment','leisure','recreation','arts','vrije tijd'],
    'נסיעות וחופשות': ['תיירות','נסיעות','טיסות','מלונות','חופשות','travel','hotels','airlines','lodging','vacation','reizen'],
    'מנויים ודיגיטל': ['מנויים','דיגיטל','שירותי מחשב','תוכנה','subscriptions','subscription','software','streaming','digital','online services'],
    'חשבונות ותשתיות': ['תשתיות','חשבונות','חשמל','מים','תקשורת','סלולר','utilities','bills','telecom','phone','internet','energy','vaste lasten'],
    'בריאות ותרופות': ['פארם','בריאות','רפואה','בתי מרקחת','רפואה ובריאות','health','healthcare','pharmacy','medical','drugstore','gezondheid'],
    'ספורט וכושר': ['ספורט','כושר','ספורט ופנאי','fitness','sport','sports','gym'],
    'חינוך וילדים': ['חינוך','לימודים','ילדים','education','kids','childcare','school','tuition'],
    'ביטוח ופיננסים': ['ביטוח','פיננסים','עמלות','בנקאות','insurance','finance','financial','fees','bank fees','charges'],
    'דיור ושכירות': ['דיור','שכירות','משכנתא','בית','housing','rent','mortgage','home','wonen'],
    'העברות ומזומן': ['העברות','מזומן','משיכות','transfers','transfer','cash','atm','withdrawal'],
    'מיסים ואגרות': ['מיסים','מסים','אגרות','ממשלה','taxes','tax','government','belasting'],
    'חיות מחמד': ['חיות','חיות מחמד','pets','pet'],
    'מתנות ותרומות': ['מתנות','תרומות','gifts','donations','charity'],
    'חיובי אשראי': ['כרטיסי אשראי','כרטיס אשראי','חיוב כרטיס','credit card payment','card payment','card settlement'],
    'הכנסות': ['הכנסות','הכנסה','משכורת','שכר','income','salary','payroll','inkomsten']
  };
  let aliasIndex = null;
  function buildAliasIndex() {
    aliasIndex = new Map();
    for (const cat in ALIASES) ALIASES[cat].forEach((a) => aliasIndex.set(P.parse.norm(a), cat));
    for (const cat in DEFAULTS) aliasIndex.set(P.parse.norm(cat), cat);
  }

  /**
   * ממפה שם קטגוריה חיצוני לקטגוריה שלנו.
   * קודם התאמה מדויקת לקטגוריות של המשתמש, אחר כך מילון שמות נרדפים,
   * ואז חלקי-מילה ("מסעדות ובתי קפה" -> מסעדות). אם אין — null.
   */
  function mapExternal(name, rules) {
    const n = P.parse.norm(name);
    if (!n) return null;
    if (rules) for (const cat in rules) if (P.parse.norm(cat) === n) return cat;
    if (!aliasIndex) buildAliasIndex();
    if (aliasIndex.has(n)) return aliasIndex.get(n);
    const words = n.split(' ').filter((w) => w.length > 2);
    for (const w of words) if (aliasIndex.has(w)) return aliasIndex.get(w);
    let best = null, len = 0;
    aliasIndex.forEach((cat, alias) => {
      if (alias.length > 3 && alias.length > len && (n.indexOf(alias) !== -1)) { best = cat; len = alias.length; }
    });
    return best;
  }

  function defaults() { return P.dict(JSON.parse(JSON.stringify(DEFAULTS))); }

  /**
   * צבע לפי דירוג ההוצאה: שש המובילות מקבלות משבצת קבועה, השאר ניטרלי.
   * "לא משויך" לא תופס משבצת — הוא תמיד בצבע הפליז של "ממתין לפעולה".
   */
  const PENDING = 'var(--mark)';
  function colorMap(orderedCats) {
    const map = P.dict();
    let slot = 0;
    orderedCats.forEach((c) => {
      if (c === OTHER) { map[c] = PENDING; return; }
      if (c === INCOME) { map[c] = 'var(--pos)'; return; }
      map[c] = slot < SLOTS.length ? SLOTS[slot] : REST;
      slot++;
    });
    return map;
  }

  /**
   * גוון זהות לכל קטגוריה — לאריח האיור, לכרטיס ולשורה שלה.
   * שמונה המובילות: אותו צבע כמו בגרפים. הבאות: גוון משני מעומעם במקום אפור,
   * כדי שגם קטגוריה קטנה תהיה מזוהה. בגרפים מרובי סדרות נשאר colorMap.
   */
  const EXTRA = ['var(--x1)', 'var(--x2)', 'var(--x3)', 'var(--x4)', 'var(--x5)', 'var(--x6)'];
  function tintMap(orderedCats) {
    const map = P.dict();
    let slot = 0;
    orderedCats.forEach((c) => {
      if (c === OTHER) { map[c] = PENDING; return; }
      if (c === INCOME) { map[c] = 'var(--pos)'; return; }
      map[c] = slot < SLOTS.length ? SLOTS[slot] : EXTRA[(slot - SLOTS.length) % EXTRA.length];
      slot++;
    });
    return map;
  }

  /*
   * הכללים מהודרים פעם אחת לרשימה ממוינת מהמילה הארוכה לקצרה,
   * כך שההתאמה הראשונה היא גם הארוכה ביותר. מחושב מחדש רק כשהכללים משתנים.
   */
  let compiled = null, compiledSig = '';
  function compile(rules) {
    let sig = '';
    for (const cat in rules) sig += cat + ':' + rules[cat].length + ':' + (rules[cat][rules[cat].length - 1] || '') + '|';
    if (compiled && sig === compiledSig) return compiled;
    const list = [];
    for (const cat in rules) rules[cat].forEach((kw) => {
      const k = P.parse.norm(kw);
      if (!k) return;
      const strict = k.length <= 3 || (/^[a-z0-9 &]+$/.test(k) && k.length <= 4);
      list.push({ k: k, cat: cat, kw: kw, strict: strict });
    });
    list.sort((a, b) => b.k.length - a.k.length);
    compiled = list; compiledSig = sig;
    return list;
  }

  /*
   * התאמה בגבולות מילה. מילת מפתח חייבת להתחיל בתחילת מילה — או אחרי אות
   * שימוש עברית אחת (ב, ה, ו, כ, ל, מ, ש), כך ש"שופרסל" תופס גם "בשופרסל".
   * מותר לה להיות תחילית ("מסעד" תופס "מסעדת"), חוץ ממילים קצרות:
   * עד 3 אותיות, או עד 4 באנגלית, חייבות להיות מילה שלמה — אחרת "ביט" היה
   * תופס "ביטול" ו-"hot" היה תופס "hotel".
   */
  const HEB_PREFIX = 'בהוכלמש';
  function matches(d, k, strictEnd) {
    let from = 0;
    for (;;) {
      const i = d.indexOf(k, from);
      if (i === -1) return false;
      const prev = i === 0 ? ' ' : d[i - 1];
      let ok = prev === ' ';
      if (!ok && HEB_PREFIX.indexOf(prev) !== -1) ok = i === 1 || d[i - 2] === ' ';
      if (ok && strictEnd) { const next = d[i + k.length]; ok = next === undefined || next === ' '; }
      if (ok) return true;
      from = i + 1;
    }
  }

  /** @returns {string} שם הקטגוריה */
  function classify(desc, amount, rules) {
    const d = P.parse.norm(desc);
    if (d) {
      const list = compile(rules);
      for (let i = 0; i < list.length; i++) if (matches(d, list[i].k, list[i].strict)) return list[i].cat;
    }
    return amount > 0 ? INCOME : OTHER;
  }

  /** איזה כלל תפס את התיאור — כדי להסביר בממשק למה תנועה סווגה כך */
  function explain(desc, rules) {
    const d = P.parse.norm(desc);
    if (!d) return null;
    const list = compile(rules);
    for (let i = 0; i < list.length; i++) if (matches(d, list[i].k, list[i].strict)) return list[i];
    return null;
  }

  /** שם מקוצר שמייצג בית עסק, לקיבוץ ולהצעת מילת מפתח */
  function merchant(desc) {
    const words = P.parse.norm(desc).replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    return words.slice(0, 3).join(' ') || P.parse.norm(desc) || 'לא ידוע';
  }

  /** מילת מפתח מוצעת לכלל חדש. עם נתונים, נבחרת המילה המזהה ביותר. */
  function keywordFrom(desc) {
    if (P.learn && P.state && P.state.data.tx.length) {
      try { return P.learn.keywordFor(desc, P.state.data.tx); } catch (e) { /* נפילה חזרה */ }
    }
    const words = P.parse.clean(desc).replace(/[0-9]{3,}/g, ' ').split(/\s+/)
      .filter((w) => w.length > 1 && !/^[0-9*#\-]+$/.test(w));
    return words.slice(0, 2).join(' ') || P.parse.clean(desc).slice(0, 18);
  }

  /** דירוג ניחושים לתנועה לא משויכת: חפיפת מילים חלקית מול מילות המפתח הקיימות */
  function suggest(desc, rules, limit) {
    const tokens = P.parse.norm(desc).split(' ').filter((t) => t.length > 2);
    if (!tokens.length) return [];
    const score = P.dict();
    for (const cat in rules) {
      if (cat === OTHER) continue;
      let s = 0;
      for (const kw of rules[cat]) {
        const kt = P.parse.norm(kw).split(' ').filter((t) => t.length > 2);
        for (const t of tokens) {
          for (const k of kt) {
            if (t === k) s += 3;
            else if (t.length > 3 && k.length > 3 && (t.indexOf(k) === 0 || k.indexOf(t) === 0)) s += 1;
          }
        }
      }
      if (s > 0) score[cat] = s;
    }
    return Object.keys(score).sort((a, b) => score[b] - score[a]).slice(0, limit || 3);
  }

  return { OTHER, INCOME, SETTLEMENT: 'חיובי אשראי', PENDING, SLOTS, REST, defaults, colorMap, tintMap, classify, explain, matches, merchant, keywordFrom, suggest, mapExternal, list: () => Object.keys(DEFAULTS) };
})();
