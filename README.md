<div align="center">

<img src="docs/logo.svg" width="96" height="96" alt="Pruta">

# פרוטה · Pruta

**כל ההוצאות, בפרוטרוט.** — *Every expense, itemised.*

A private, offline spending analyser for Israeli bank and credit-card statements.<br>
Drop in the Excel file your bank gives you; see where the money went — month by month, with a story.

[![License: MIT](https://img.shields.io/badge/license-MIT-237969.svg)](LICENSE)
![Dependencies: none](https://img.shields.io/badge/dependencies-none-237969.svg)
![Runs offline](https://img.shields.io/badge/runs-100%25%20offline-237969.svg)
![Hebrew, right to left](https://img.shields.io/badge/UI-Hebrew%20%C2%B7%20RTL-237969.svg)
![Vanilla JS](https://img.shields.io/badge/vanilla-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-237969.svg)

[Get started](#get-started) · [What it does](#what-it-does) · [Privacy](#private-by-construction) · [Under the hood](#under-the-hood) · [בעברית](#בעברית)

</div>

---

## Why

Banks let you export your transactions, and then leave you with a spreadsheet of
eight hundred rows. Pruta turns that file into the three answers people actually
want — *how much went out, is that more or less than usual, and what drove it* —
without uploading a single number anywhere.

## Get started

**Option 1 — one file, nothing to install.**
Download `Pruta.html` from the [latest release](../../releases/latest) and
double-click it. Everything — code, fonts, photographs — is inside that one file.
Your data is kept in the browser on that computer; download a backup from
*Settings* before switching browser or computer.

**Option 2 — keep your data as a file next to the code.**
Requires Python 3.7 or newer (standard library only).

| | |
|---|---|
| **Windows** | double-click `start-windows.bat` |
| **macOS** | double-click `start-mac.command` (first time: right-click → Open) |
| **Linux** | `bash start-linux.sh` |
| **Any system** | `python3 run.py` |

The browser opens by itself, and everything is saved to `data/pruta-data.json`
with rotating backups. Starting it again opens the copy that is already running.

**Option 3** — open `index.html` directly. It works like the single file.

Runs in any browser from 2023 on: Chrome / Edge 111, Firefox 113, Safari 16.4.

### Your first statement

In the bank's app, export *דוח תנועות בחשבון* to Excel (credit-card statements work
too), then drag the file into the window. Pruta was designed around the Pepper
export and reads the other Israeli banks and card companies as well — several files
at once, any column order.

## What it does

### Three places
- **החודש שלי · My month** — one sentence that sums the month up, three numbers,
  and *one* next step worth taking. Below it: where the money went, and a calendar
  of the month, day by day.
- **התוכנית · The plan** — monthly targets per category, overruns, explained advice
  (*what changed, by how much, compared to what*), and a "what if we cut a little"
  simulator.
- **לחקור · Explore** — months (each with its own seasonal poster), categories,
  every transaction, and insights: recurring charges, unusual charges, habits by
  weekday, the year at a glance.

### Stories, the first time you get somewhere
A 15-second intro plays on the very first visit. After that, every place introduces
itself the first time you reach it — no button needed:

| When you… | You see |
|---|---|
| load a statement | the story of its newest complete month, then the import summary |
| open a month | its photo, spending day by day, where it went, three moments, one closing sentence |
| open the Months page | the coin breaks into twelve month posters, which become a chart and then a ring of categories |
| look at fixed charges | each one drops into the months it is due over the year ahead |
| sort the last merchant | everything you sorted falls into its category — *הכל מסודר* |

Every number on screen is your own data, and running totals are exact sums of what
has appeared. Skip any story with a click or `Esc`; replay it from the small coin
button; set *first time / always / off* in Settings. With *Reduce motion* on, there
are no stories at all.

### Sorting as a short game
Whatever the bank's text doesn't reveal waits in **לשיוך**. Everything the engine is
sure about (because it resembles what you already classified) is sorted in one
tap — and undone in one. The rest is a stack of cards: tap a category and the card
flies into it; drag sideways to skip. Each choice becomes a rule, so next month's
file sorts itself.

## Reads statements the way banks actually write them

Nothing is assumed about the file:

- **What kind of file it is** is decided by its content, not its name: real `.xlsx`,
  the HTML table many banks call `.xls`, Excel 2003 XML, or text separated by commas,
  semicolons, tabs or pipes — in UTF-8, UTF-16 or the Hebrew and Western Windows
  encodings.
- **Where the table is** — account details above it, a total below it, a header
  repeated on every page, several sheets, or two tables on one sheet.
- **Which column is which** — by the header names Israeli banks and card companies
  use (*בחובה / בזכות*, *₪ זכות/חובה*, *סכום חיוב*…), and by content when the names
  are unfamiliar.
- **Which way the money went** — separate debit and credit columns, a column that
  says *חובה / זכות*, a minus sign, or a card statement where a charge is positive.
  When there is a balance column it settles the question: the difference between
  two consecutive balances *is* the transaction — oldest-first or newest-first.

When the file leaves no doubt, it is imported at once. When something had to be
guessed, one mapping window shows the guess and asks — and remembers the answer for
the next file of the same shape.

## Private by construction

The data is a bank statement, so privacy is enforced, not promised.

- **Nothing leaves the machine.** No server-side, no account, no analytics, no CDN.
- **The browser enforces it.** A strict Content-Security-Policy allows files from
  the app's own folder only; the single file forbids every network request.
- **Your data is one readable file** — `data/pruta-data.json`, written atomically,
  with rotating backups (always backed up before a save that removes transactions).
  A damaged file is never thrown away: it is moved to `data/backups/`.
- **The local server is locked down** — `127.0.0.1` only, rejects other sites and
  look-alike host names (DNS rebinding), never serves `data/` as files.
- **Two tabs cannot overwrite each other**, and closing the server window loses
  nothing: unsaved changes are kept in the browser and written back next time.
- `data/` is in `.gitignore`. See [`SECURITY.md`](SECURITY.md).

## Under the hood

```
index.html                the shell — one page, no build step
run.py                    optional local server: saves to data/, standard library only
assets/
  css/                    tokens · base · components · overlays · motion · pages ·
                          showcase · studio · premium · flow · stories
  js/
    lib/                  zip, xlsx and csv readers and a file sniffer — written for this project
    core/                 parse · detect · categories · learn · state · insights · store
    ui/                   kit · art · icons · posters · motion · fx · stories · charts · overlays · …
    pages/                one file per page
  fonts/ img/             Heebo, Frank Ruhl Libre (+ licences) · month posters, category covers
tools/build-portable.py   bundles everything into one self-contained Pruta.html
tests/                    run.js (engine) · studio.js (plan, single file) · motion.py (motion)
docs/MOTION.md            the motion system: storyboards, rules, techniques
```

- **No framework, no bundler, no dependencies** — hand-written code that runs
  straight from the folder.
- **Reads Excel itself.** An `.xlsx` is a ZIP of XML; it is unpacked with the
  browser's `DecompressionStream` and parsed directly. Files that lie about their own
  size or structure are refused.
- **A learning engine without a model** — merchant grouping, TF-IDF similarity to
  what you already classified, keyword mining from your own choices, recurring-charge
  detection by rhythm, outliers against each merchant's own history.
- **Charts are hand-built SVG**, right to left: time runs from right (old) to left
  (new). Eight category colours chosen to stay apart under colour blindness — and
  tested, not assumed.
- **One motion engine** — Web Animations API on a single timeline per sequence; no
  animation library, no video, no canvas. Every sequence is laid out from measured
  sizes, so it is right on any screen. Details in [`docs/MOTION.md`](docs/MOTION.md).
- **Accessible** — keyboard everywhere, focus kept across re-renders, dialogs trap
  focus, colour never carries meaning alone, *Reduce motion* respected everywhere.

### Tests

```bash
node tests/run.js                 # engine — nothing to install
python3 tools/build-portable.py   # build the single file
node tests/studio.js              # plan, editor, single file
python3 tests/motion.py           # motion — needs Playwright
```

- **Engine** (`run.js`, 100 checks): amounts, dates and text as statements really
  write them; the same statement written by xlsxwriter, openpyxl, LibreOffice and
  pandas, as Excel 2003 XML and in four text encodings; hostile and damaged Excel
  files; the layouts of Pepper, Leumi, Hapoalim, Discount, Mizrahi, the First
  International, Max, Cal and Isracard; 1,120 generated statements whose direction
  must be read exactly; classification, persistence, the learning engine, the
  sentences, the facts every story tells, and the colour palette under simulated
  colour blindness.
- **Studio** (`studio.js`, 11 checks): budgets, transaction editing and deletion,
  the explained advice, and the single file's embedded assets and CSP hashes.
- **Motion** (`motion.py`, 115 checks): a real browser freezes every sequence and
  steps through it every 20–40 ms on nine screen shapes, from 320×568 to 1920×1080,
  checking that nothing flies over text or off screen, that every chip lands in its
  own category's column, that the coin lands on the logo to the pixel, that running
  totals never run ahead of what is on screen, and that with *Reduce motion* nothing
  plays. Falls back to the installed Edge or Chrome if Chromium can't be downloaded.

All of it runs in [GitHub Actions](.github/workflows/ci.yml) on every push. Pushing
a tag like `v1.0.0` builds `Pruta.html` and attaches it to a release.

## Credits

Designed and built by **Elay Dadon**.

Typefaces: Heebo and Frank Ruhl Libre (SIL Open Font License). Photographs: an open
collection sourced from Pixabay (Pixabay Content License). Everything else is drawn
in code. Details, file by file, in [`CREDITS.md`](CREDITS.md).

## License

[MIT](LICENSE) © 2026 Elay Dadon. Bundled fonts and photographs keep their own licences.

---

<div dir="rtl">

## בעברית

**פרוטה** קוראת את דוח התנועות מהבנק או מחברת האשראי (אקסל או CSV, בכל מבנה), ומחזירה
תמונה מסודרת — בלי לשלוח מספר אחד לשום מקום.

**שלושה מקומות.** *החודש שלי* — משפט שמסכם, שלושה מספרים וצעד אחד שכדאי לעשות, ומתחתיהם לאן
הלך הכסף ויום אחרי יום. *התוכנית* — יעדים חודשיים, חריגות, הסברים והדמיית "מה אם נצמצם קצת".
*לחקור* — חודשים (כל חודש בעיצוב משלו), קטגוריות, כל התנועות ותובנות.

**סיפורים, בפעם הראשונה שמגיעים לכל מקום.** הפתיח רץ בביקור הראשון בלבד. דוח חדש נפתח
בסיפור של החודש השלם האחרון בו; חודש שנפתח — בסיפור שלו; עמוד החודשים — בסיפור השנה;
ההוצאות הקבועות — בשנה הקרובה שלהן; ובית העסק האחרון בתור השיוך — ב"הכל מסודר". כל מספר על
המסך הוא הנתונים שלך. אפשר לדלג בכל רגע ולבחור בהגדרות: בפעם הראשונה · בכל פעם · כבוי.

**שיוך כמשחק.** מה שהמנוע בטוח בו נסגר בלחיצה אחת (וניתן לביטול). השאר — ערימת כרטיסים:
לוחצים על קטגוריה והכרטיס עף אליה; גוררים הצידה כדי לדלג. כל בחירה הופכת לכלל להבא.

**הפעלה.** הכי פשוט: מורידים את `Pruta.html` מעמוד ה-Releases ופותחים בלחיצה כפולה — הכל בפנים,
והנתונים נשמרים בדפדפן (כדאי להוריד גיבוי מההגדרות לפני מעבר מחשב). כדי שהנתונים יישמרו כקובץ
ליד הקוד: ב-Windows לחיצה כפולה על `start-windows.bat`, ב-Mac על `start-mac.command`, ב-Linux
`bash start-linux.sh` (דרוש Python 3.7 ומעלה). הנתונים נשמרים ב-`data/pruta-data.json`.

**איך מתחילים.** באפליקציה של הבנק מורידים את "דוח תנועות בחשבון" כאקסל, וגוררים אותו לחלון.
אם משהו לא נקלט כמו שצריך — בסיכום שאחרי הקליטה יש "מיפוי ידני של העמודות", והתיקון נזכר
לקבצים הבאים באותו מבנה.

**פרטיות.** הכל רץ על המחשב שלך: אין שרת מרוחק, אין חשבון, אין שום בקשה לרשת — והדפדפן עצמו
אוכף את זה. התיקייה `data/` לא עולה ל-git.

עוצב ונבנה על ידי **Elay Dadon** · רישיון MIT.

</div>
