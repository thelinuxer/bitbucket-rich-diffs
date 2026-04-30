# AMO listing copy

Paste the relevant pieces into the AMO dashboard at
https://addons.mozilla.org/en-US/developers/addon/bitbucket-markdown-diff-render/edit

The fields below are what AMO calls them in the dashboard.

---

## Name

```
Bitbucket Rich Diffs
```

(The current manifest still says "Bitbucket Markdown Diff Renderer" — when you bump the listing here, also bump `manifest.json` in the next release so the in-Firefox name matches.)

---

## Summary (250 chars max)

```
Read Bitbucket Cloud PR diffs the way they were meant to be read. Render Markdown files inline as proper formatted documents — unified with diff highlights, or side-by-side Before / After — without leaving the diff page.
```

(220 chars — leaves a little slack.)

---

## Description (long-form)

```
Reviewing a documentation PR on Bitbucket Cloud is the same experience as reviewing code: a wall of plus and minus signs, line numbers, and raw Markdown syntax. Headings look like "## What it does." Tables look like "| col | col |". Bold text shows as **double-asterisks**. Reading prose this way is slow and easy to skim past.

Bitbucket Rich Diffs adds a small per-file toolbar above every Markdown file in your pull request diffs. One click toggles between three views, and you can mix and match per file:

• ORIGINAL DIFF — Bitbucket's default plus / minus view, untouched.

• RENDERED (UNIFIED) — the file rendered as Markdown, in document order, with added blocks tinted green and removed blocks tinted red and struck through. Skim the change like you'd skim the published doc.

• RENDERED (SIDE-BY-SIDE) — two columns: Before on the left, After on the right, both fully rendered. Best for visualizing structural changes, like added sections or restructured tables.

WHY YOU MIGHT WANT IT

Reviewing READMEs, RFCs, design docs, ADRs, runbooks, or any prose under version control. Anyone whose Bitbucket PRs include a .md file regularly will save time.

HOW IT WORKS

The extension uses the Bitbucket session you're already signed in with — no separate authentication, no app password, no tokens. The before / after file content is fetched the same way Bitbucket's own UI fetches source files, and rendered locally in your browser using the marked library. Output is sanitized with DOMPurify before display, so a malicious Markdown file in a PR can't run arbitrary script in the page.

PRIVACY

Your data does not leave your browser except for the file-content fetches, which go directly to bitbucket.org over the same connection your normal Bitbucket browsing already uses. The extension makes no analytics or telemetry calls. There is no account, no settings sync, no third-party service.

OPEN SOURCE

Source code, releases, and issue tracking on GitHub:
https://github.com/thelinuxer/bitbucket-rich-diffs

Released under the MIT license.

WHAT'S COMING

Markdown is the first file format. CSV, JSON, and ODS are on the wishlist. If there's a file type you wish Bitbucket previewed properly, open an issue.
```

---

## Categories

- **Web Development** (primary)

(One category is enough. Web Development is the closest match.)

---

## Tags

```
bitbucket
markdown
code-review
pull-request
diff
developer-tools
```

(AMO accepts free-form tags. Pick 3–6 specific ones.)

---

## Support email

```
thelinuxer@gmail.com
```

(Or set the GitHub repo's Issues page as a support URL instead — pick one of the two.)

---

## Support website

```
https://github.com/thelinuxer/bitbucket-rich-diffs/issues
```

---

## Privacy policy

The Mozilla review team will ask. Paste this:

```
Bitbucket Rich Diffs does not collect, store, transmit, or share any
personal data. The extension makes HTTP requests only to bitbucket.org
domains, using your existing browser session, to fetch the raw before
and after content of Markdown files visible in pull requests you are
already viewing. No analytics, no telemetry, no third-party services.

Source code is available at:
https://github.com/thelinuxer/bitbucket-rich-diffs
```

---

## Screenshots

Upload these in the Images section of the listing, in this order:

1. `screens/01-original-diff.png` — toolbar visible above an original diff. Caption: "The toolbar appears above every Markdown file in your PR diff."

2. `screens/02-rendered-unified.png` — rendered unified view. Caption: "Rendered (unified): full document with added blocks tinted green, removed blocks tinted red."

3. `screens/03-rendered-side-by-side.png` — rendered side-by-side. Caption: "Rendered (side-by-side): Before / After columns, both fully rendered."

---

## Version notes (per-release "What's new")

For v0.1.4:

```
- Fixed a bug where a phantom toolbar would appear inside a Markdown
  file's diff body when the file's content referenced another .md file
  by name (e.g., a link to CONTRIBUTING.md inside README.md). File-card
  detection now anchors on Bitbucket's "Viewed" label instead of bare
  filename text, so auto-linked filenames in diff content can't create
  false cards.
- Repackaged: leaner zip, ships only what the extension needs at runtime.
```
