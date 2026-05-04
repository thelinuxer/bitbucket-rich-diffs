# Chrome Web Store listing copy

Paste the relevant pieces into the CWS dashboard at
https://chrome.google.com/webstore/devconsole

Field names below match what the CWS dashboard calls them.

---

## Item name (max 75 chars)

```
Bitbucket Rich Diffs
```

---

## Summary (max 132 chars)

```
Render Markdown files in Bitbucket Cloud pull-request diffs as proper formatted documents — unified or side-by-side.
```

(118 chars.)

---

## Description (long-form)

```
Reviewing a documentation PR on Bitbucket Cloud is the same experience as reviewing code: a wall of plus and minus signs, line numbers, and raw Markdown syntax. Headings look like "## What it does." Tables look like "| col | col |". Bold text shows as **double-asterisks**. Reading prose this way is slow and easy to skim past.

Bitbucket Rich Diffs adds a small per-file toolbar above every Markdown file in your pull request diffs. One click toggles between three views, and you can mix and match per file:

ORIGINAL DIFF — Bitbucket's default plus / minus view, untouched.

RENDERED (UNIFIED) — the file rendered as Markdown, in document order, with added blocks tinted green and removed blocks tinted red and struck through. Skim the change like you'd skim the published doc.

RENDERED (SIDE-BY-SIDE) — two columns: Before on the left, After on the right, both fully rendered. Best for visualizing structural changes like added sections or restructured tables.

WHY YOU MIGHT WANT IT
Reviewing READMEs, RFCs, design docs, ADRs, runbooks, or any prose under version control. Anyone whose Bitbucket PRs include a Markdown file regularly will save time.

HOW IT WORKS
The extension uses the Bitbucket session you're already signed in with — no separate authentication, no app password, no tokens. Before/after file content is fetched the same way Bitbucket's own UI fetches source files, and rendered locally in your browser using the marked library. Output is sanitized with DOMPurify before display, so a malicious Markdown file in a PR can't run script in the page.

PRIVACY
Your data does not leave your browser except for the file-content fetches, which go directly to bitbucket.org over the same connection your normal Bitbucket browsing already uses. The extension makes no analytics or telemetry calls. There is no account, no settings sync, no third-party service.

OPEN SOURCE
Source code, releases, and issue tracking on GitHub:
https://github.com/thelinuxer/bitbucket-rich-diffs

Released under the MIT license.

WHAT'S COMING
Markdown is the first file format. CSV, JSON, and ODS are on the wishlist.
```

---

## Category

```
Developer Tools
```

(Closest CWS category.)

---

## Language

```
English (United States)
```

---

## Support URL

```
https://github.com/thelinuxer/bitbucket-rich-diffs/issues
```

---

## Single purpose description (Privacy practices tab)

```
Render Markdown files inside Bitbucket Cloud pull-request diffs as proper formatted documents — either unified with diff highlights, or side-by-side Before/After — so reviewing prose changes doesn't require reading raw +/- lines.
```

---

## Remote code use justification (Privacy practices tab)

Chrome asks even if you don't use any. Paste:

```
This extension does NOT load or execute any remote code. All JavaScript is bundled in the extension package: lib/marked.min.js, lib/diff.min.js, lib/purify.min.js, src/background.js, src/content.js, src/renderer.js. The extension does not inject <script> tags into pages, does not use eval() or new Function(), and does not download or run code from external sources at runtime. The only network activity is fetching the user's own pull-request file content from bitbucket.org (same domain the user is already viewing) for local rendering.
```

When the form asks "Are you using Remote code?", the answer is **No**.

---

## Host permission justifications (Privacy practices tab)

CWS asks for a separate justification per `host_permissions` entry.

### `*://bitbucket.org/*`

```
The extension's content script runs on Bitbucket Cloud pull-request diff pages and fetches the raw before/after content of Markdown files in the diff using the user's existing browser session (same-origin). This is the only way to display rendered Markdown alongside the diff without requiring the user to re-authenticate.
```

### `*://api.bitbucket.org/*`

```
The extension reads the source and destination commit hashes of the pull request being viewed by calling Bitbucket's public REST API. This is the same data Bitbucket's own web UI fetches; the extension reuses the user's existing browser session.
```

---

## Privacy practices declaration

CWS asks several specific yes/no questions:

| Question | Answer |
|---|---|
| Single purpose | Yes — render Markdown files inside Bitbucket Cloud pull request diffs |
| Personally identifiable information collected | No |
| Health information collected | No |
| Financial / payment info collected | No |
| Authentication info collected | No (uses the user's existing browser session, never sees credentials) |
| Personal communications collected | No |
| Location data collected | No |
| Web history collected | No |
| User activity collected | No |
| Website content collected | Yes — *but* only file contents the user is already viewing in a Bitbucket pull request, fetched directly to render locally. Nothing is transmitted to any third party. |

### Privacy policy URL

Paste this in the CWS "Privacy policy URL" field:

```
https://github.com/thelinuxer/bitbucket-rich-diffs/blob/main/PRIVACY.md
```

The full policy text lives in `PRIVACY.md` in this repo. Update both `PRIVACY.md` and the date at the top whenever you change permissions or what the extension contacts.

### Permission justifications

CWS asks why each manifest permission is needed.

- **storage** — used to remember per-file toolbar preferences across pageloads. (Currently unused but reserved for future settings; can be removed if reviewer pushes back.)
- **host_permissions: bitbucket.org** — content script must run on Bitbucket Cloud pull-request pages and fetch raw file content from the same origin.
- **host_permissions: api.bitbucket.org** — used to look up the source/destination commit hashes of the pull request being viewed, via the Bitbucket public API.

---

## Screenshots

CWS requires at least one screenshot at 1280×800 or 640×400. The 3276-wide screenshots in `screens/` will need resizing. Quick resize:

```bash
for f in screens/01-original-diff.png screens/02-rendered-unified.png screens/03-rendered-side-by-side.png; do
  base=$(basename "$f" .png)
  convert "$f" -resize 1280x800^ -gravity North -extent 1280x800 "screens/cws-${base}.png"
done
```

Upload in this order:

1. `screens/cws-01-original-diff.png` — caption: "Per-file toolbar appears above every Markdown file in your PR diff."
2. `screens/cws-02-rendered-unified.png` — caption: "Rendered (unified): full document, added blocks green, removed blocks red."
3. `screens/cws-03-rendered-side-by-side.png` — caption: "Rendered (side-by-side): Before / After columns, both fully rendered."

---

## After publishing

Once the listing is approved:

1. Get your **extension ID** from the CWS dashboard (looks like `abcdefghijklmnopqrstuvwxyzabcdef`).
2. Generate OAuth 2.0 credentials per `RELEASING.md` and add the four secrets (`CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_EXTENSION_ID`) to the GitHub repo.
3. From then on, tagging a release will upload + publish to CWS automatically alongside AMO.
