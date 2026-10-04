# Motion in פרוטה

How the motion is designed, how it is built, and how it is kept seamless.

Everything here is plain CSS and the Web Animations API. There is no animation
library, no video file and no canvas: the intro is ordinary DOM, driven by one
timeline.

---

## The idea in one line

**A single coin runs through the whole product.** It opens the intro, it is the
source the expenses fly out of, it "stamps" a file once it has been read — and
when the intro ends it lands in the corner of the screen and becomes the logo.

The name carries the same idea. *Pruta* (פרוטה) is the smallest coin; *lifrot*
(לפרוט) means both "to break a note into change" and "to itemise". The product
takes one long statement and breaks it into months, categories and merchants.
The motion shows exactly that: small things leaving one coin, then sorting
themselves into a clear picture.

---

## Seven rules

1. **Nothing jumps.** An element enters from the place the eye is already
   looking at: a month card *becomes* the header of the window it opens, the
   coin *becomes* the logo, a category tile *becomes* the tile inside its sheet.
2. **One clock per sequence.** Every animation in a sequence is registered on
   one timeline with an absolute start time. Nothing is chained with callbacks,
   so nothing drifts — and "skip" is a single `finish()`.
3. **Motion means something.** Chips falling into columns *is* the
   classification. A number counting up *is* the sum being added. If a movement
   explains nothing, it is not there.
4. **Nothing flies over text.** A moving chip never crosses a caption, a total
   or a label, and never passes over a chip that has already landed. Paths are
   computed around what has to stay readable ([how](#flight-paths-that-go-around-text)).
5. **What the screen says is true.** The running total is always exactly the
   sum of the expenses that have landed. Every chip lands in the column of its
   own category. The import sequence is built from the file that was just
   loaded: its real merchants, its real categories, its real counts.
6. **The interface never waits for the show.** The page is fully rendered under
   the intro before it starts; the intro plays once per visit; both sequences
   can be skipped at any moment (button, click, `Esc`, `Enter`, `Space`).
7. **Stillness is a feature.** With *Reduce motion* turned on in the operating
   system there is no intro, no import sequence, no morphing and no reveal —
   every screen appears in its final state.

---

## The intro — 15 seconds, five scenes

File: `assets/js/ui/fx.js` → `intro()`. All times in seconds.

| Time | Scene | What moves | Caption |
|---|---|---|---|
| 0.0 – 2.8 | **1. The coin** | A gold coin drops and bounces (`linear()` bounce curve), spinning two and a half turns. Banknote-style guilloche rings unfold around it. The wordmark rises one letter at a time, each un-blurring as it lands. | פרוטה |
| 2.8 – 6.8 | **2. Coin by coin** | The coin rises to the top and shrinks. Sixteen everyday expenses shoot out of its sides one after another — each launch makes the coin pulse — curve around the caption and the total, and settle in rows. The far rows fill first, so no expense flies over one that has landed. The total grows by exactly the amount of each expense as it lands. | פרוטה ועוד פרוטה… |
| 6.8 – 10.6 | **3. They add up** | The expenses drop to a "sorting line" under the total and slide along it, each into the column of its category. The ones resting above the total go around it — and only when they are out of its way does the total lift and make room. Six columns spring up to their real proportions; names and amounts follow. | …מצטרפות לחשבון גדול. |
| 10.6 – 13.4 | **4. Real life** | Three photographs fan in — coffee, a holiday, the market — each with the expense it stands for. Then the cards flip over: behind every photo is one of the twelve month posters. | רואים לאן הולך הכסף. → וכל חודש — בעיצוב משלו. |
| 13.4 – 15.0 | **5. Hand-off** | The cards collapse back into the coin, which returns to the centre with the wordmark and the tagline. The stage dissolves, and the coin flies to the exact position and size of the logo in the sidebar (or the top bar on a phone). | כל ההוצאות, בפרוטרוט. |

The last half-second is the seam that matters. The rectangle of the real logo
is measured before the timeline is built, and the distance is taken from the
real centre of the stage, so the flying coin and the logo coincide to the
pixel; the overlay is then simply removed.

Scenes 2 and 3 quote the proverb the product is named after — *"כל פרוטה
ופרוטה מצטרפת לחשבון גדול"* (Bava Batra 9b): every coin adds up to a large sum.

### Laid out from measurement

The scene is built only after the fonts have loaded, so every size it works
with is the real one — the width of the caption, of the final total, of each
chip. From those it decides:

- **how many rows** fit between the caption and the bottom of the screen, above
  and below the total;
- **how many columns** fit side by side without two chips touching — by the
  chips' actual widths, not an average;
- **how many expenses** to show: sixteen on a desktop, ten on a phone, eight on
  a short screen (a phone held sideways);
- **the spacing**: on a wide screen the chips are spread airily and alternate
  rows are offset like bricks; on a narrow one each row is packed by its own
  widths and centred. Tilt and jitter are reduced until no chip touches another
  chip or any text (a separating-axis test on the rotated rectangles).

### Flight paths that go around text

`route()` in `fx.js` gives every chip a path that keeps clear of what must stay
readable:

1. It leaves the source **sideways, on a quarter ellipse** — horizontal at the
   start, vertical at the end — so it passes *beside* the caption, not through it.
2. It comes down a **lane** just outside the widest obstacle, scaled to fit
   between that obstacle and the edge of the screen.
3. It **tucks in** to its place, moving inward first and growing last.

When a direct arc is already clean, the chip takes it. Otherwise the arc is made
as tall as it can be while still clearing the obstacle's corner (a short binary
search), which keeps the curve generous on a desktop and tight on a phone. Each
candidate is checked the way the browser will actually play it — between the
keyframes too, with the chip's size and tilt at that moment. The path is then
handed to the browser as about fifteen sampled keyframes, which read as one curve.

The launch order does the rest: far rows first, and within a row from the
centre outward — so a chip never has to cross one that is already resting.
On the narrowest phones, where there is no way around the total, a chip fades
in place instead of crossing it.

---

## Loading a file — 5 seconds, same language

File: `assets/js/ui/fx.js` → `importSequence()`.

| Time | What happens |
|---|---|
| 0.1 | A card with the file name drops in; a light sweep "reads" it. |
| 0.6 – 2.9 | Up to eighteen **real transactions from the file** slide out from behind the card, tumble down and fall into the column of the category they were classified to. |
| 1.5 – 3.4 | The columns spring up, one after another. |
| 2.5 – 3.9 | Once the last transaction is out of the way, three figures count up: transactions, months, and the share classified automatically. |
| 3.0 – 3.8 | The number of transactions appears above each column. |
| 4.1 – 5.0 | The centre clears, the coin stamps it, and the stage fades into the summary dialog. |

The order is what keeps it clean: movement first, numbers after. The page
behind is already re-rendered with the new data before the sequence starts, so
when it fades there is nothing left to load.

---

## Stories — the same stage, your data

File: `assets/js/ui/stories.js` (the facts each one tells: `core/insights.js` →
`monthStory()`, `yearStory()`, `recurringYear()`, tested in `tests/run.js`).
All four run on `P.fx.run()`: one timeline, skip at any moment, built only after the
fonts and photographs are ready, no story at all with *Reduce motion*.

**When they play.** Not behind a button: each place introduces itself the first time
you reach it, and remembers it did (`prefs.seen`, saved with the data). Settings →
הדמיות: first time · always · off. A small coin button next to each name replays it.

| Where you are | Story | Then |
|---|---|---|
| A statement was just loaded | Month story of its newest complete month — *story first, dashboard second* | the import summary |
| A month opens, from anywhere | Month story | the month window opens (also when skipped) |
| The Months page | Year story | the page |
| Fixed charges (window or tab) | The year ahead | the window |
| The last merchant in the queue gets a category | Everything sorted | the done state |

### Month story — 15.4 seconds, dressed in the month

| Time | What moves |
|---|---|
| 0.0 – 2.6 | The month's photograph opens behind the stage, its outlined numeral rises, its own seal unfolds; the coin drops and the month name rises letter by letter. |
| 2.6 – 6.0 | The coin and the name rise to become the heading. One column per day, right to left; **the total grows by exactly the spending of each day as its column grows.** Then the comparison chip. |
| 6.0 – 9.1 | The largest categories as glass rows, each bar at its true length; one sentence under them. |
| 9.1 – 11.9 | Three cards — the biggest expense, the regular place, the peak day — rise into place in their own lane. |
| 11.9 – 15.4 | The cards fold back into the coin; under it, the sentence that sums the month up. |

### Year story — 16 seconds

| Time | What moves |
|---|---|
| 0.0 – 2.7 | The coin lands; the year rises digit by digit (left to right, as a number is written). |
| 2.7 – 6.9 | *Breaking the year into change:* the coin deals twelve month posters, farthest first so none passes over one that landed; the total grows by each month as it lands; the coin is used up. |
| 6.9 – 9.9 | The posters become columns in each month's own colour; the average line draws itself; the most and least expensive months get a flag. |
| 9.9 – 12.8 | The total moves into the centre of a ring that fills category by category; every arc is a labelled row ("everything else" included) — colour never carries identity alone. |
| 12.8 – 16.0 | The coin re-forms; the average, the months in surplus and the fixed charges; the proverb. |

### The year ahead — 11.2 seconds

Fixed charges appear as chips; then twelve months right to left, and in each month
every charge that is due drops into its column (monthly every month, quarterly every
third) while its chip pulses. The total grows by exactly what dropped. The projection
starts the month after the data ends (or the last month, when it holds under a week).

### Everything sorted — 5.6 seconds

The merchants you just sorted appear together, then fall into the column of the
category each one received — bottom row first, centre out — the counts appear, and the
coin stamps *הכל מסודר*.

---

## Everyday motion

| Moment | Technique | Where |
|---|---|---|
| Moving between pages | **View Transitions API** on the content area only — the sidebar never repaints. Blocks of the new page then cascade in. Without the API, the page turns on its right edge like a Hebrew book. | `router.js`, `showcase.css` §5 |
| The active page marker | One pill that slides between links, instead of one highlight disappearing and another appearing. | `router.js` → `mark()` |
| Month card → month window | **Shared-element morph (FLIP).** A clone of the card's poster is animated from the card's rectangle to the header's rectangle — real `width`/`height`, not `scale`, so the photo re-crops on every frame instead of stretching. The header text enters only after the photo has landed. | `motion.js` → `morph()` |
| Category tile → category window | The same morph, on the illustrated tile. | `pages/categories.js` |
| Switching month in the header | The old poster dissolves into the new one; the figure counts to its new value. | `pages/overview.js` |
| Segmented controls | The white thumb slides from the previous choice to the new one, even though the control itself was re-rendered in between. | `blocks.js` → `seg()`, `motion.js` → `slide()` |
| Scrolling | Blocks rise into place as they enter the viewport, staggered per row (`IntersectionObserver`). Uses the individual `translate` / `scale` properties so it never fights the hover transform on the same card. | `motion.js` → `reveal()` |
| Cards | Tilt towards the pointer with a moving highlight; the photo inside zooms slightly. | `motion.js` → `tilt()` |
| Landing page | A photo collage in four depth layers that follow the pointer (parallax through CSS variables), a seamless marquee of categories, and a strip of the twelve posters. | `pages/welcome.js` |
| Charts | Bars grow from the baseline, the trend line is *drawn* (`pathLength="1"` plus `stroke-dashoffset`), dots pop in along it. | `charts.js`, `showcase.css` §8 |
| Windows | Sheets rotate in on a hinge; a sheet opened over another pushes the first one back and to the side, like cards in a stack. On a phone they rise from the bottom. | `overlays.css` |
| Photographs | Fade in over the month's colour the first time they load — never a pop. | `posters.js` → `appear()` |
| Notifications | A small spring. | `showcase.css` §8 |
| Sorting (לשיוך) | A game: the merchant's letter flies from the card into the category tapped, a ring in the category's colour "swallows" it and `+₪` rises; the next card rises from the stack behind; dragging sideways skips (the card tilts with the finger, then flies off); the score counts up. | `pages/assign.js`, `flow.css` §3 |
| Explore | Inside לחקור the sidebar opens its four parts under it; the doors lift on hover, the month fan spreads, the trend line is revealed from oldest to newest. | `pages/explore.js`, `flow.css` §1–2 |

---

## How the timeline works

`P.motion.timeline()` (in `assets/js/ui/motion.js`) is about fifty lines:

```js
const tl = P.motion.timeline();
tl.add(coin, [{ transform: 'rotateY(-900deg)' }, { transform: 'rotateY(0)' }], { at: 150, duration: 1700, easing: 'out' });
tl.stagger(letters, keyframes, { at: 1350, each: 95, duration: 700 });
tl.call(4000, () => total.add(119));       // a callback at an absolute time
await tl.play();                           // resolves when the last animation ends
tl.finish();                               // skip: jump to the final state, run pending callbacks
```

- Each `add()` creates a paused `element.animate()` with `delay = at`.
  On `play()` all of them get the same `startTime`, so they share one clock.
- The first animation of an element fills `both` (it also defines the state
  *before* it starts); later ones fill `forwards`. Otherwise the starting
  keyframe of a later animation would override everything before it.
- Spring and bounce are `linear()` easing functions; browsers without
  `linear()` fall back to a cubic-bezier overshoot.

Only `transform` and `opacity` are animated in the two big sequences, so they
run on the compositor. The one deliberate exception is the morph, which
animates the box of a single cloned element for half a second.

---

## Checked frame by frame

"It looks fine to me" is not a test for two sequences with dozens of objects
moving at once. `tests/motion.py` opens a real browser, freezes the timeline and
steps through both sequences **every 20 ms, on nine screen shapes** (320×568 up
to 1920×1080, including a phone held sideways). At every step it checks rules 4
and 5 above:

- no chip over a caption, a total, a figure or a column label;
- nothing off screen;
- in the intro, no chip over a chip that has landed, and none touching at rest;
- every chip ends in the column of its own category (below 360 px, where a chip
  has no way around the total, it may fade in place — and only there);
- at the last frame the coin sits on the logo (within one pixel);
- in real time, sampled on every frame: the running total never runs ahead of
  the expenses on screen, never steps back, and ends on the exact sum;
- with *Reduce motion*, neither sequence exists;
- every story, end to end (with its total at its final, widest value): no text over
  other text, nothing moving over text, nothing off screen, no card or poster over
  another; in *everything sorted* each merchant lands in its own category's column;
  and with *Reduce motion* no story runs and no button offers one.

```
python3 tests/motion.py          # about two minutes; --quick for three screens
```

It needs Playwright (`pip install playwright && playwright install chromium`) —
the only thing in the project that needs installing, and only for this check.

Measuring instead of watching paid for itself. It turned up chips landing in
the *mirrored* column (positions computed left-to-right in a right-to-left
layout), a coin that landed 7.5 px beside the logo on desktop (the stage is
narrower than the window by the scrollbar gutter), a running total that ran
ahead of the chips, chips crossing the caption on their way out of the coin —
and a total that stepped *back* by a few shekels for a single frame, about one
run in three (a frame can carry a timestamp slightly earlier than the call that
scheduled it, which made one time step negative). None of it was obvious at
full speed.

---

## Try it

- **Settings → פתיח → לצפות עכשיו** replays the intro at any time
  (or choose *first visit only* — the default — *once per visit / always / off*).
- **Settings → הדמיות** sets the stories to *first time / always / off*, replays any
  of them, and can show them all again from the start.
- **על פרוטה** (About) shows the five easing curves side by side, the twelve
  posters with their palettes, and the type and colour system.
- Add `?intro=0` to the address to open the app without the intro.
