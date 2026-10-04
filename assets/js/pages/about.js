/* ==========================================================================
   pages/about.js — על פרוטה: השם, השפה החזותית, התנועה והקרדיטים
   עמוד אחד שמרכז את כל ההחלטות העיצוביות של המוצר — כמו ספר מותג קטן.
   ========================================================================== */
window.P = window.P || {};
P.pages = P.pages || {};

P.pages.about = (function () {
  'use strict';
  const el = P.kit.el, ic = P.icons, art = P.art;

  function render(params, mount) {
    /* ---------- השם ---------- */
    mount.appendChild(el('section.about-hero', null, [
      art.band({ color: '#fff', lines: 16, seed: 31, width: 1400, height: 520, strokeWidth: 0.6, cls: 'about-hero__band' }),
      el('div.about-hero__coin', { 'aria-hidden': 'true' }, art.coin(132)),
      el('div.about-hero__text', null, [
        el('h1', { text: 'פרוטה' }),
        el('p.about-hero__tag', { text: 'כל ההוצאות, בפרוטרוט.' }),
        el('p', null, ['פרוטה היא המטבע הקטן ביותר. ', el('b', { text: 'לפרוט' }), ' זה גם לפרוט שטר למטבעות קטנים, וגם לפרט — להציג דבר על כל פרטיו. זה בדיוק מה שהמוצר עושה: לוקח דוח תנועות ארוך, ופורט אותו לחודשים, לקטגוריות ולבתי עסק.']),
        el('blockquote', null, ['"כל פרוטה ופרוטה מצטרפת לחשבון גדול"', el('cite', { text: 'בבא בתרא ט, ב' })])
      ])
    ]));

    /* ---------- צבע וטיפוגרפיה ---------- */
    const sw = (name, value, label) => el('div.swatchcard', null, [el('i', { style: 'background:' + value }), el('b', { text: label }), el('span', { text: name })]);
    mount.appendChild(section('צבע', 'צבע מבטא אחד שמתחלף (חמש ערכות), ושמונה צבעי קטגוריות בסדר קבוע — שנבחרו כך שיישארו נבדלים זה מזה גם בעיוורון צבעים. קטגוריות קטנות מקבלות גוון משני מעומעם.',
      el('div.swatchgrid', null, P.app.ACCENTS.map((a) => sw(a.key, 'linear-gradient(140deg,' + a.a + ',' + a.b + ')', a.label))
        .concat([1, 2, 3, 4, 5, 6, 7, 8].map((n) => sw('--c' + n, 'var(--c' + n + ')', ['כחול', 'טורקיז', 'ענבר', 'ורד', 'סגול', 'כתום', 'תכלת', 'ירוק'][n - 1])))
        .concat([sw('--mark', 'var(--mark)', 'ממתין'), sw('--pos', 'var(--pos)', 'נכנס'), sw('--neg', 'var(--neg)', 'חריגה')]))));

    mount.appendChild(section('אות', 'שני גופנים, שניהם ברישיון פתוח ושמורים מקומית: פרנק-ריהל לכותרות — הסריף העברי הקלאסי, כמו על שטר — והיבו לממשק ולמספרים.',
      el('div.typegrid', null, [
        el('div.typecard', { 'data-reveal': '' }, [el('span', { text: 'Frank Ruhl Libre · כותרות' }), el('p.typecard__display', { text: 'לאן הולך הכסף?' }), el('p.typecard__row', { style: 'font-family:var(--font-display)', text: 'אבגדהוזחטיכלמנסעפצקרשת ₪1,234' })]),
        el('div.typecard', { 'data-reveal': '' }, [el('span', { text: 'Heebo · ממשק ומספרים' }), el('p.typecard__figure.fig', { text: '₪16,559' }), el('p.typecard__row', { text: 'אבגדהוזחטיכלמנסעפצקרשת 0123456789' })])
      ])));

    /* ---------- החודשים ---------- */
    mount.appendChild(section('12 חודשים, 12 פוסטרים', 'לכל חודש צילום עונתי, פלטה של שלושה גוונים שנגזרה ממנו, מילה אחת, והספרה שלו. הכותרת בעמוד הסקירה, כרטיסי החודשים וראש חלון החודש — כולם מתלבשים בחודש.',
      el('div.postergrid', null, P.posters.MONTHS.map((m, i) => {
        const card = el('div.postergrid__card', { 'data-reveal': 'zoom' }, [
          P.posters.month(i + 1, { size: 'card', label: true, eager: true }),
          el('div.postergrid__pal', null, [m.deep, m.mid, m.light].map((c) => el('i', { style: 'background:' + c, title: c })))
        ]);
        return P.motion.tilt(card, { max: 8, lift: 4 });
      }))));

    /* ---------- תנועה ---------- */
    const curve = (name, label) => el('div.curve', null, [el('span', { text: label }), el('div.curve__track', null, el('i', { style: 'animation-timing-function:' + P.motion.E(name) }))]);
    mount.appendChild(section('תנועה', 'שום דבר לא קופץ: דברים נכנסים, מתגלגלים או משנים צורה — מהמקום שהעין כבר מסתכלת אליו. המטבע הוא החוט המקשר: הוא פותח את הפתיח, ממיין את התנועות בקליטת קובץ, ונשאר כסמל בפינה.', [
      el('div.curves', { 'data-reveal': '' }, [curve('out', 'כניסה'), curve('inOut', 'מעבר'), curve('back', 'קפיצה'), curve('spring', 'קפיץ'), curve('bounce', 'נחיתת מטבע')]),
      el('div.row', { style: 'margin-top:18px;gap:10px' }, [
        el('button.btn.btn--primary', { type: 'button', onclick: () => P.app.playIntro() }, [ic.svg('spark', 16), 'הפתיח — 15 שניות']),
        // שאר ההדמיות מספרות את הנתונים שלך — ולכן מופיעות רק כשיש נתונים
        P.stories.can() ? P.stories.button('סיפור החודש', () => P.stories.month(P.insights.focusMonth()), '') : null,
        P.stories.can() && P.state.months().length >= 2 ? P.stories.button('סיפור השנה', () => P.stories.year(), '') : null,
        P.stories.canRecurring() ? P.stories.button('הקבועות של השנה הקרובה', () => P.stories.recurring(), '') : null,
        el('span.dim', { style: 'font-size:var(--fs-small)', text: 'מי שביקש במערכת ההפעלה "הפחתת תנועה" מקבל את האתר בלי הנפשות.' })
      ])
    ]));

    /* ---------- פרטיות וקרדיטים ---------- */
    mount.appendChild(section('פרטיות', null, el('div.promises', null, [
      promise('lock', 'var(--c2)', 'אפס בקשות לרשת', 'אין שרת מרוחק, אין אנליטיקה, אין גופנים מהרשת. הכל — קוד, גופנים וצילומים — יושב בתיקייה אחת.'),
      promise('folder', 'var(--c1)', 'קובץ אחד, אצלך', 'הנתונים נשמרים ב-data/' + P.store.FILE + ', עם גיבויים מתחלפים. מוחקים את התיקייה — והכל נעלם.'),
      promise('download', 'var(--c5)', 'יוצאים מתי שרוצים', 'גיבוי מלא ב-JSON וייצוא התנועות ל-CSV, בלחיצה אחת.')
    ])));

    mount.appendChild(section('קרדיטים', null, el('div.card', { 'data-reveal': '' }, el('dl.credits', null, [
      el('dt', { text: 'עיצוב ופיתוח' }), el('dd', { text: 'Elay Dadon. הקוד פתוח ברישיון MIT; הצילומים והגופנים — כל אחד ברישיון שלו, כמפורט כאן.' }),
      el('dt', { text: 'צילומים' }), el('dd', { text: 'מהאוסף הפתוח sample-images (yavuzceliker), שלפי ההצהרה שלו מקורו ב-Pixabay — ברישיון Pixabay Content License: חופשי לשימוש ולעיבוד, בלי חובת קרדיט. הצילומים נחתכו ועובדו לפרויקט, ושמורים מקומית בתיקייה assets/img. הפירוט המלא בקובץ CREDITS.md.' }),
      el('dt', { text: 'גופנים' }), el('dd', { text: 'Heebo (עודד עזר) ו-Frank Ruhl Libre (יאנק יונטף), שניהם ברישיון SIL Open Font License 1.1. שמורים מקומית בתיקייה assets/fonts.' }),
      el('dt', { text: 'איורים ואייקונים' }), el('dd', { text: 'צוירו בקוד (SVG) במיוחד לפרויקט: 21 איורי קטגוריות, המטבע, וחותמות הגיליוש — קווי הביטחון של שטר, שנוצרים מנוסחה.' }),
      el('dt', { text: 'קוד' }), el('dd', { text: 'HTML, CSS ו-JavaScript בלבד. בלי ספריות, בלי שלב בנייה. קריאת קובצי האקסל נעשית בדפדפן.' })
    ]))));
  }

  function section(title, lead, body) {
    return el('section.landing-sec', null, [
      el('div.landing-sec__head', { 'data-reveal': '' }, [el('h2', { text: title }), lead ? el('p', { text: lead }) : null]),
      body
    ]);
  }
  function promise(icon, color, title, text) {
    return el('div.promise', { 'data-reveal': '', vars: { '--c': color } }, [el('span.promise__icon', null, ic.svg(icon, 22)), el('h3', { text: title }), el('p', { text: text })]);
  }

  return { render: render, title: 'על פרוטה' };
})();
