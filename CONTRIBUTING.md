# Contributing

Thanks for wanting to make Pruta better. A few things keep it what it is:

1. **Local only.** Nothing may be fetched from, or sent to, the network. No CDNs,
   no analytics, no remote fonts.
2. **No dependencies, no build step.** The app is plain HTML, CSS and JavaScript
   that runs straight from the folder. `tools/build-portable.py` only bundles it
   into one file; it never transforms the code.
3. **Words before charts, and motion that means something.** Every chart sits
   under a sentence that says what it shows; every animation explains something
   (see [`docs/MOTION.md`](docs/MOTION.md)). Everything must still work, in its
   final state, with *Reduce motion* turned on.
4. **Hebrew, right to left, first.** Time runs from right (old) to left (new).

## Running the tests

```bash
node tests/run.js                 # the engine — nothing to install
python3 tools/build-portable.py   # build Pruta.html
node tests/studio.js              # plan, editor and the single-file edition
python3 tests/motion.py --quick   # motion, frame by frame (needs Playwright)
```

`tests/motion.py` needs `pip install playwright && playwright install chromium`;
if Chromium cannot be downloaded it falls back to the Edge or Chrome already on
the machine.

## Never commit real data

The statements in `tests/samples/` and `tests/fixtures/` are synthetic. Do not add
a real statement, a screenshot of real transactions, or anything from `data/` —
`.gitignore` keeps `data/` out, but please check every file you add.

## Style

Match the surrounding code: two-space indentation, `'use strict'`, small modules
on the `window.P` namespace, comments that explain *why*. Comments in the app are
in Hebrew; `run.py` and the tests' infrastructure are in English where a console
might not show Hebrew.
