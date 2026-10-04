# Changelog

## 1.0.0 — 2026-10-04

First public release.

**Reading statements**
- Reads `.xlsx`, the HTML tables banks call `.xls`, Excel 2003 XML and CSV/TSV in
  UTF-8, UTF-16 and the Hebrew and Western Windows encodings — decided by content,
  not by file name. Several tables per file and per sheet.
- Finds the columns by the header names Israeli banks and card companies use, or by
  content; settles the direction of every amount from the running balance.
- Remembers the column mapping for the next file of the same shape.

**Understanding spending**
- Three places: **My month** (one sentence, three numbers, one next step, where the
  money went, day by day), **The plan** (monthly targets, overruns, explained
  advice and a what-if simulator) and **Explore** (months, categories,
  transactions and insights).
- Classification in layers — your own choices, categories in the file, keyword
  rules, and similarity to what you already classified — and a learning engine
  that mines new rules, detects recurring charges and flags unusual ones.
- Sorting as a short game: one tap for everything the engine is sure about, a card
  stack for the rest.
- Add, edit and delete transactions; backups and restore.

**Motion**
- A 15-second intro (first visit only), an import sequence built from the file
  just loaded, and four data stories — the month, the year, the year ahead of fixed
  charges, and *everything sorted* — each shown the first time you reach its place.
- Verified frame by frame in a real browser on nine screen shapes.

**Privacy**
- Runs entirely offline: no server-side, no account, no network requests, enforced
  by Content-Security-Policy. Data is one readable JSON file next to the code, or
  the browser's own storage in the single-file edition.
