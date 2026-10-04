# Security and privacy

Pruta reads bank statements, so it is built so that **financial data never leaves
the computer it runs on**:

- No server-side, no account, no analytics, no CDN — fonts, photographs and code
  are all in the repository.
- A strict Content-Security-Policy forbids loading anything from another origin;
  the single-file edition (`Pruta.html`) also forbids every network request
  (`connect-src 'none'`) and allows only scripts whose SHA-256 hash it lists.
- The optional local server (`run.py`) listens on `127.0.0.1` only, rejects
  look-alike host names (DNS rebinding) and cross-site requests, never serves the
  `data/` folder as files, writes atomically and keeps rotating backups.
- File contents are only ever inserted as text, never as HTML; exported CSV cells
  are protected against formula injection; damaged or hostile Excel files are
  refused instead of crashing the app.

## Reporting a vulnerability

Please report security issues privately through GitHub:
**Security → Report a vulnerability** on this repository. Do not open a public
issue for a vulnerability, and never include real statements or account details
in a report — a description, or a file with every name and number replaced, is
enough.

## Supported versions

Fixes are made on the latest release.
