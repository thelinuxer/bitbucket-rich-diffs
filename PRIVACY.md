# Privacy Policy — Bitbucket Rich Diffs

_Last updated: 2026-06-20_

This is the privacy policy for **Bitbucket Rich Diffs**, a browser extension that renders Markdown and ODS spreadsheet files inside Bitbucket Cloud pull-request diffs.

## Short version

The extension does not collect, store, transmit, or share any personal data with anyone. It runs entirely in your browser. The only network activity is fetching file content from `bitbucket.org` and `api.bitbucket.org` — the same servers your browser is already talking to when you view a Bitbucket pull request.

## What the extension does on your machine

When you view a pull-request diff page on `bitbucket.org`, the extension's content script:

1. Detects each Markdown and ODS file in the diff and adds a small toolbar with three view modes (Original diff / Rendered (unified) / Rendered (side-by-side)).
2. When you switch to a rendered mode, it asks Bitbucket — using your existing browser session — for the raw "before" and "after" content of that file. The same Bitbucket session your browser already uses for normal Bitbucket browsing is reused; the extension never sees, stores, or transmits any credentials, tokens, or cookies.
3. Renders the fetched content locally in your browser (Markdown to HTML, or ODS unzipped and parsed into a table) and inserts the rendered output into the diff card.

That's the whole flow. No data is sent to any third party. There is no analytics, no telemetry, no error reporting service, no settings sync, no account, no remote configuration.

## What the extension stores

Nothing. The extension does not write to `chrome.storage`, `browser.storage`, or `localStorage`. It does not maintain user-specific state across sessions.

## What permissions the extension requests, and why

- **`host_permissions: *://bitbucket.org/*`** — the content script needs to run on Bitbucket pull-request pages and fetch raw file content from the same origin.
- **`host_permissions: *://api.bitbucket.org/*`** — the extension reads the source and destination commit hashes of the pull request from the Bitbucket public REST API, so that it knows which file revisions to fetch.

No other permissions are requested.

## Third parties

The extension communicates only with `bitbucket.org` and `api.bitbucket.org` — the servers you are already authenticated with when you view a pull request. It does not contact any other server, including the extension author's servers (there are none).

## Bundled libraries

Four open-source libraries are bundled inside the extension package and run locally in your browser:

- [marked](https://github.com/markedjs/marked) — Markdown to HTML rendering
- [DOMPurify](https://github.com/cure53/DOMPurify) — HTML sanitization (so a malicious Markdown file in a PR cannot inject script into the page)
- [jsdiff](https://github.com/kpdecker/jsdiff) — line-level diff computation for the unified-rendered view
- [JSZip](https://github.com/Stuk/jszip) — unzips ODS files locally (ODS is a ZIP container) so their contents can be parsed and rendered as a table

None of these libraries make any network requests of their own. Source code for the extension is available at https://github.com/thelinuxer/bitbucket-rich-diffs.

## Changes to this policy

If the extension ever changes in a way that affects this policy — for example, adding a new permission or contacting a new server — this document and the extension's listing on the Chrome Web Store and addons.mozilla.org will be updated, and the version number will be bumped.

## Contact

Questions about this policy or the extension's privacy practices: open an issue at https://github.com/thelinuxer/bitbucket-rich-diffs/issues, or email `thelinuxer@gmail.com`.
