/* ==========================================================================
   ui/importer.js — אשף הייבוא: מיפוי עמודות לכל קובץ טבלאי.
   נפתח עם ניחוש מלא מוכן; ברוב המקרים מספיק ללחוץ "ייבוא".
   ========================================================================== */
window.P = window.P || {};

P.importer = (function () {
  'use strict';
  const el = P.kit.el, fmt = P.fmt;

  const SIGN_OPTS = [
    ['neg-out', 'מינוס = הוצאה'],
    ['pos-out', 'מספר חיובי = הוצאה'],
    ['kind', 'לפי עמודת סוג התנועה'],
    ['balance', 'לפי השינוי ביתרה']
  ];
  const DATE_OPTS = [['auto', 'זיהוי אוטומטי'], ['dmy', 'יום/חודש/שנה'], ['mdy', 'חודש/יום/שנה']];
  const DEC_OPTS = [['auto', 'זיהוי אוטומטי'], ['.', 'נקודה (1,234.50)'], [',', 'פסיק (1.234,50)']];

  /**
   * @param {{fileName:string, sheets:Array}} input
   * @returns {Promise<Object|null>} ההגדרות שאושרו, או null אם בוטל
   */
  function open(input) {
    return new Promise((resolve) => {
      const sheets = input.sheets;
      const S = { sheetIndex: input.startSheet || 0, analysis: null, remember: true, signChosen: false };
      let done = false;
      const finish = (value) => { if (done) return; done = true; resolve(value); };

      let modal, statusEl, previewEl, rawEl, sideEl, importBtn;

      function analyze() {
        const rows = sheets[S.sheetIndex].rows;
        S.analysis = P.detect.analyze(rows);
        const sig = S.analysis.signature;
        const profile = P.state.getProfile(sig);
        S.signChosen = !!(profile && profile.mapping);      // מיפוי שמור: סימן החיוב שבו הוא בחירה שלכם
        if (profile && profile.mapping) {
          S.analysis.mapping = Object.assign({}, profile.mapping);
          S.analysis.options = Object.assign({}, S.analysis.options, profile.options);
          if (typeof profile.headerRow === 'number') S.analysis.profile = P.detect.profile(rows, profile.headerRow);
        }
      }

      function rows() { return sheets[S.sheetIndex].rows; }
      function prof() { return S.analysis.profile; }

      function preview() {
        try {
          const res = P.parse.build(rows(), prof().headerRow, S.analysis.mapping, Object.assign({}, S.analysis.options, { balanceBefore: P.state.balanceBefore }));
          return { ok: true, res: res };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }

      function refresh() {
        const p = preview();
        statusEl.innerHTML = '';
        previewEl.innerHTML = '';

        if (!p.ok) {
          statusEl.appendChild(el('div.callout.callout--bad', { style: 'flex:1', text: p.error }));
          previewEl.appendChild(el('div.empty', { text: 'בחרו את העמודות החסרות בצד כדי לראות תצוגה מקדימה' }));
          importBtn.disabled = true;
          return;
        }
        const tx = p.res.tx;
        const dates = tx.map((t) => t.date).sort();
        const totals = P.state.totals(tx);
        importBtn.disabled = !tx.length;
        importBtn.lastChild.textContent = tx.length ? 'ייבוא ' + tx.length.toLocaleString('he-IL') + ' תנועות' : 'ייבוא';

        [['תנועות שיובאו', tx.length.toLocaleString('he-IL')],
         ['שורות שידולגו', String(p.res.skipped)],
         ['טווח', dates.length ? fmt.dayShort(dates[0]) + ' – ' + fmt.dayShort(dates[dates.length - 1]) : '—'],
         ['יצא', fmt.money(totals.outflow)],
         ['נכנס', fmt.money(totals.inflow)]
        ].forEach(([k, v]) => statusEl.appendChild(el('div', null, [document.createTextNode(k), el('strong', { text: v })])));

        // סכומים בלי סימן: הכיוון נקרא מהיתרה. שורה שאין לפניה יתרה להשוות אליה הוערכה — ומוצגת ראשונה, לאישור
        const unsure = new Set(p.res.unsure);
        if (unsure.size) {
          statusEl.appendChild(el('p.imp__note', null, [P.icons.svg('alert', 15), el('span', { text:
            (unsure.size === 1 ? 'לתנועה אחת אין בקובץ יתרה קודמת להשוות אליה' : 'ל-' + unsure.size + ' תנועות אין בקובץ יתרה קודמת להשוות אליהן') +
            ', ולכן הכיוון (נכנס או יצא) הוערך. ' + (unsure.size === 1 ? 'היא מסומנת' : 'הן מסומנות') + ' בראש הרשימה — כדאי לוודא.' })]));
        }

        if (!tx.length) {
          previewEl.appendChild(el('div.empty', null, [el('b', { text: 'לא נמצאו תנועות' }), 'נסו שורת כותרות אחרת, או עמודת תאריך אחרת.']));
          return;
        }
        const m = S.analysis.mapping;
        const head = ['תאריך', 'תיאור', 'סכום']
          .concat(m.balance != null ? ['יתרה'] : [])
          .concat(m.category != null ? ['קטגוריה בקובץ'] : [])
          .concat(m.ref != null ? ['אסמכתא'] : []);
        const shown = unsure.size ? tx.filter((t) => unsure.has(t.id)).concat(tx.filter((t) => !unsure.has(t.id))) : tx;
        const body = shown.slice(0, 40).map((t) => {
          const mapped = t.fileCat ? (P.cats.mapExternal(t.fileCat, P.state.data.rules) || null) : null;
          return el('tr', { class: unsure.has(t.id) ? 'is-unsure' : null, title: unsure.has(t.id) ? 'הכיוון הוערך — אין יתרה קודמת בקובץ' : null }, [
            el('td', { text: fmt.day(t.date) }),
            el('td', { text: t.desc, title: t.desc }),
            el('td.num', { style: t.amount > 0 ? 'color:var(--pos-ink)' : null, text: fmt.signed(t.amount, true) }),
            m.balance != null ? el('td.num', { style: 'font-weight:500;color:var(--ink-3)', text: t.balance == null ? '—' : fmt.money2(t.balance) }) : null,
            m.category != null ? el('td.imp__map', null, t.fileCat ? (mapped && mapped !== t.fileCat
              ? [document.createTextNode(t.fileCat + ' ← '), el('b', { text: mapped })]
              : [el('b', { text: t.fileCat }), mapped ? null : el('span', { text: ' (קטגוריה חדשה)' })].filter(Boolean)) : '—') : null,
            m.ref != null ? el('td', { style: 'color:var(--ink-3)', text: t.ref || '—' }) : null
          ].filter(Boolean));
        });
        previewEl.appendChild(el('table', null, [
          el('thead', null, el('tr', null, head.map((h) => el('th', { text: h })))),
          el('tbody', null, body)
        ]));
      }

      function buildSide() {
        sideEl.innerHTML = '';
        const columns = prof().columns;
        const opts = (selected) => [el('option', { value: '', text: '— ללא —' })].concat(
          columns.map((c) => el('option', {
            value: String(c.index),
            text: c.letter + ' · ' + c.name,
            selected: selected === c.index ? true : null
          })));

        const roleSec = el('div.imp__sec', null, [el('h4', { text: 'איזו עמודה היא מה' })]);
        P.detect.ROLES.forEach((role) => {
          const cur = S.analysis.mapping[role.key];
          const sel = el('select.input', {
            'aria-label': role.label,
            onchange: (e) => {
              const v = e.target.value;
              if (v === '') delete S.analysis.mapping[role.key];
              else S.analysis.mapping[role.key] = +v;
              // העמודות השתנו: סימן החיוב נקבע מחדש לפיהן — אלא אם כבר בחרתם אותו בעצמכם
              if (!S.signChosen) S.analysis.options.signMode = P.detect.guessSign(prof(), S.analysis.mapping);
              else if (role.key === 'kind' && v !== '') S.analysis.options.signMode = 'kind';
              buildSide(); refresh();
            }
          }, opts(cur));
          const col = cur != null ? columns[cur] : null;
          const sample = col && col.samples.length
            ? col.samples.slice(0, 3).map((v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? fmt.day(v) : v)).join('  ·  ')
            : role.hint;
          roleSec.appendChild(el('div.imp__role' + (cur != null ? '.is-set' : ''), null, [
            el('label', null, [document.createTextNode(role.label), role.required ? el('em', { text: ' *' }) : null].filter(Boolean)),
            sel,
            el('div.imp__sample', { text: sample, title: sample })
          ]));
        });
        sideEl.appendChild(roleSec);

        const decode = el('div.imp__sec', null, [el('h4', { text: 'איך לקרוא את הערכים' })]);
        decode.appendChild(pick('סימן החיוב', SIGN_OPTS, S.analysis.options.signMode, (v) => { S.analysis.options.signMode = v; S.signChosen = true; refresh(); }));
        decode.appendChild(pick('סדר התאריך', DATE_OPTS, S.analysis.options.dateOrder, (v) => { S.analysis.options.dateOrder = v; refresh(); }));
        decode.appendChild(pick('מפריד עשרוני', DEC_OPTS, S.analysis.options.decimal || 'auto', (v) => { S.analysis.options.decimal = v; refresh(); }));
        sideEl.appendChild(decode);
      }

      function pick(label, options, current, onPick) {
        return el('div.imp__role', null, [
          el('label', { text: label }),
          el('select.input', { onchange: (e) => onPick(e.target.value) },
            options.map(([v, l]) => el('option', { value: v, text: l, selected: v === current ? true : null })))
        ]);
      }

      function buildRaw() {
        rawEl.innerHTML = '';
        const r = rows().slice(0, 14);
        const width = Math.min(12, r.reduce((m, row) => Math.max(m, (row || []).length), 0));
        const table = el('table');
        r.forEach((row, i) => {
          const tr = el('tr', {
            class: i === prof().headerRow ? 'is-head' : '',
            title: 'לחיצה מגדירה את השורה הזאת ככותרות',
            onclick: () => {
              S.analysis.profile = P.detect.profile(rows(), i);
              S.analysis.mapping = P.detect.guessMapping(S.analysis.profile);
              S.analysis.options.signMode = P.detect.guessSign(S.analysis.profile, S.analysis.mapping);
              S.signChosen = false;
              buildSide(); buildRaw(); refresh();
            }
          }, [el('td.imp__rowno', { text: String(i + 1) })]);
          for (let c = 0; c < width; c++) tr.appendChild(el('td', { text: P.parse.clean((row || [])[c]) }));
          table.appendChild(tr);
        });
        rawEl.appendChild(table);
      }

      analyze();

      sideEl = el('div.imp__side');
      statusEl = el('div.imp__status');
      previewEl = el('div.imp__preview');
      rawEl = el('div.imp__raw');

      const sheetPick = sheets.length > 1
        ? el('select.input', { style: 'max-width:200px', onchange: (e) => { S.sheetIndex = +e.target.value; analyze(); buildSide(); buildRaw(); refresh(); } },
            sheets.map((s, i) => el('option', { value: String(i), selected: i === S.sheetIndex ? true : null, text: s.name + ' (' + s.rows.length + ' שורות)' })))
        : null;

      const remember = el('input', { type: 'checkbox', id: 'imp-remember', checked: true, onchange: (e) => { S.remember = e.target.checked; } });

      importBtn = el('button.btn.btn--primary', { type: 'button', onclick: () => {
        const p = preview();
        if (!p.ok) return;
        if (S.remember) {
          P.state.saveProfile(S.analysis.signature, {
            name: input.fileName, headerRow: prof().headerRow,
            mapping: S.analysis.mapping, options: S.analysis.options, at: new Date().toISOString()
          });
        }
        // קודם מחזירים את התוצאה ורק אחר כך סוגרים — סגירה בלי תוצאה נחשבת ביטול
        finish({
          tx: p.res.tx,
          meta: P.parse.meta(rows(), prof().headerRow),
          skipped: p.res.skipped,
          mapping: S.analysis.mapping,
          options: S.analysis.options,
          headerRow: prof().headerRow,
          signature: S.analysis.signature,
          categoryColumn: S.analysis.mapping.category,
          kind: P.detect.fileKind(prof(), S.analysis.mapping, S.analysis.options),
          rows: rows()
        });
        modal.close();
      } }, [P.icons.svg('check', 16), el('span', { text: 'ייבוא' })]);

      const body = el('div.imp', null, [
        sideEl,
        el('div.imp__main', null, [
          statusEl,
          previewEl,
          el('details.adv', null, [
            el('summary', null, [P.icons.svg('chevron', 14), 'השורות כפי שהן בקובץ — לחיצה על שורה מגדירה אותה כשורת הכותרות']),
            rawEl
          ])
        ])
      ]);

      modal = P.ui.dialog({
        title: 'מיפוי העמודות',
        subtitle: input.fileName + ' · הניחוש כבר מוכן. בדקו שהתצוגה המקדימה נראית נכון, ולחצו ייבוא.',
        body: body, wide: true, flush: true, headExtra: sheetPick,
        foot: [
          importBtn,
          el('button.btn.btn--ghost', { type: 'button', onclick: () => { finish(null); modal.close(); } }, 'ביטול'),
          el('span.spacer'),
          el('label.check', { for: 'imp-remember', style: 'font-size:var(--fs-tiny)' }, [remember, el('span', { text: 'לזכור את המיפוי לקבצים במבנה הזה' })])
        ],
        onClose: () => finish(null)
      });

      buildSide(); buildRaw(); refresh();
    });
  }

  return { open: open };
})();
