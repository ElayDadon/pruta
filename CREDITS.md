# Credits and licences

פרוטה (Pruta) is designed and built by **Elay Dadon**. The code is released under
the MIT License (see [`LICENSE`](LICENSE)); the third-party assets below keep
their own licences.

Everything Pruta shows is stored inside this folder. Nothing is loaded from the
network at run time — not the fonts, not the photographs, not a single script.

## Photographs

37 photographs, all taken from the open collection
[`yavuzceliker/sample-images`](https://github.com/yavuzceliker/sample-images).
Its README states that the images *"were originally sourced from Pixabay.com
and have been modified"*, and that they may be shared and used under the
[Pixabay Content License](https://pixabay.com/service/license-summary/).

What that licence allows, in short: free use, adapting the images into new
works, and no attribution required (credit is given here anyway). What it does
not allow: selling or redistributing an image on its own, unchanged — and
commercial use of images that show recognisable brands, or any misleading use
of images of recognisable people. None of the photographs used here shows a
recognisable person, a logo or a brand.

The collection does not record the Pixabay page or the photographer of each
image, so they cannot be credited by name; the numbers below are the `N` in the
collection's `docs/image-N.jpg`, so every image can be traced to its source file.

Each file was prepared for this project: cropped to the composition it is used
in (some mirrored so the subject sits away from the text), cleaned with a
3-pixel median filter, resized, lightly sharpened and saved as a progressive JPEG.

**The twelve month posters** — `assets/img/months/`, 1280×560

| File | Month | Subject | Source |
|---|---|---|---|
| `01.jpg` | January · כפור | frost | 1042 |
| `02.jpg` | February · פריחה | blossom | 860 |
| `03.jpg` | March · כלניות | red anemone (mirrored) | 40 |
| `04.jpg` | April · אביב | green field | 1804 |
| `05.jpg` | May · קציר | wheat | 1606 |
| `06.jpg` | June · לבנדר | lavender | 678 |
| `07.jpg` | July · בריכה | pool float | 1837 |
| `08.jpg` | August · שקיעה | palms at sunset | 1680 |
| `09.jpg` | September · רימונים | pomegranate (mirrored) | 1412 |
| `10.jpg` | October · שלכת | autumn leaves | 1129 |
| `11.jpg` | November · ערפל | forest in fog | 1082 |
| `12.jpg` | December · אור נרות | candles | 1339 |

**Category covers** — `assets/img/cats/`, 960×540. Shown in greyscale and tinted
with the category's own colour, so they read as one family.

| File | Source | File | Source | File | Source |
|---|---|---|---|---|---|
| `groceries.jpg` | 57 | `bills.jpg` | 1229 | `taxes.jpg` | 1079 |
| `dining.jpg` | 1178 | `health.jpg` | 1157 | `pets.jpg` | 1213 |
| `transport.jpg` | 332 | `sport.jpg` | 1608 | `gifts.jpg` | 1189 |
| `shopping.jpg` | 50 | `education.jpg` | 466 | `card.jpg` | 1146 |
| `fun.jpg` | 1297 | `finance.jpg` | 1367 | `income.jpg` | 74 |
| `travel.jpg` | 1044 | `housing.jpg` | 1644 | `pending.jpg` | 1896 |
| `digital.jpg` | 1167 | `cash.jpg` | 1963 | `other.jpg` | 877 |

**Landing page and intro** — `assets/img/life/`, 720×900

| File | Source |
|---|---|
| `coffee.jpg` | 880 |
| `beach.jpg` | 372 |
| `home.jpg` | 1300 |
| `market.jpg` | 34 |

If you use the project commercially, check the licence terms on Pixabay
yourself; they are the authority, not this file.

## Typefaces

Both are open-source, under the SIL Open Font License 1.1. The licence texts
are in `assets/fonts/`.

| Typeface | Used for | Designer | Files |
|---|---|---|---|
| **Frank Ruhl Libre** | Headlines, the wordmark, month names | Yanek Iontef (Fontef) — an open revival of the classic Frank-Rühl (Rafael Frank, 1908) | `FrankRuhlLibre.woff`, `OFL-FrankRuhlLibre.txt` |
| **Heebo** | Interface text and all figures (tabular numerals) | Oded Ezer | `Heebo.woff`, `OFL-Heebo.txt` |

The variable fonts were converted from TTF to WOFF; nothing else was changed.

## Drawn for this project

All of it is SVG generated in code — there are no icon or illustration files.

- **The coin** — the product's mark: CSS gradients and one letter.
- **Guilloche** — the fine interlaced line patterns of banknotes (round seals
  and wave bands). They are computed from a formula, so each month has its own
  seal. `assets/js/ui/art.js`
- **Twenty-one category illustrations**, two-tone, coloured automatically with
  the category's colour. `assets/js/ui/art.js`
- **Interface icons.** `assets/js/ui/icons.js`

## Colour

The eight category colours were chosen so that they stay apart under colour
blindness. With protanopia, deuteranopia and tritanopia simulated (Machado,
Oliveira & Fernandes, 2009), the smallest distance between any two of them is
ΔE2000 ≈ 11–12 — the level of the Okabe–Ito palette, which was designed for
this. The check is part of `tests/run.js`, and reads the colours straight from
`assets/css/tokens.css`.

## Code

Plain HTML, CSS and JavaScript — no framework, no build step, no dependencies.
The Excel reader (`assets/js/lib/zip.js`, `xlsx.js`) and the CSV reader are
written from scratch for this project. The optional local server (`run.py`)
uses only the Python standard library.

The test statements in `tests/samples/` and `tests/fixtures/` are synthetic: the
names, account numbers and transactions were generated and belong to no one.
They exist only for the automated tests and are not part of the app.
