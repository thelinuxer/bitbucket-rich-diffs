# Bitbucket Rich Diffs

A browser extension that renders **Markdown** and **ODS spreadsheet** files in Bitbucket Cloud pull-request diffs as proper formatted views — so reviewing prose, READMEs, design docs, and Tryton/Genshi report templates stops feeling like reading a `+`/`-` log (or a "Binary file" placeholder).

Works in **Firefox** and **Chrome** (and any Chromium-based browser that supports Chrome Web Store extensions).

## Install

[![Get the Add-on for Firefox](https://img.shields.io/badge/Firefox-Get%20the%20Add--on-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/bitbucket-rich-diffs/)
[![Available in the Chrome Web Store](https://img.shields.io/badge/Chrome-Available%20in%20the%20Web%20Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](#)

> **Firefox**: install from [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/bitbucket-rich-diffs/).
>
> **Chrome**: link goes live after the first Chrome Web Store publish.

After installing, open any Bitbucket Cloud pull request that touches a `.md`, `.markdown`, `.mdx`, `.mkd`, or `.ods` file. A small toolbar appears above each supported file with three view modes:

| Mode | Markdown | ODS |
|---|---|---|
| **Original diff** | Bitbucket's default `+`/`-` view | Bitbucket's "Binary file" placeholder |
| **Rendered (unified)** | Rendered Markdown with added blocks tinted green and removed blocks tinted red | Spreadsheet grid with per-cell add/remove/change highlights |
| **Rendered (side-by-side)** | Before / After columns of fully rendered Markdown | Before / After grids |

ODS files default to **Rendered (unified)** on open, since Bitbucket's Original view shows nothing useful for binary files.

## See it in action

### Markdown

**Original diff** — Bitbucket's default view, untouched:

![Original diff with the per-file toolbar](screens/01-original-diff.png)

**Rendered (unified)** — the file rendered as actual Markdown, with added blocks tinted green and removed blocks tinted red and struck through, in document order:

![Rendered unified view](screens/02-rendered-unified.png)

**Rendered (side-by-side)** — two columns: Before on the left, After on the right, both fully rendered:

![Rendered side-by-side view](screens/03-rendered-side-by-side.png)

### ODS spreadsheets

For Tryton/Genshi `.ods` report templates the rendered grid shows each cell with its visible text plus the embedded `relatorio://` expression as a small chip. Cells changed between revisions are highlighted (green added, red removed, yellow changed with old → new shown in place, blue dotted border for format-only changes). Multi-sheet templates get a tab strip with per-sheet change counts.

The chevron and "Viewed" checkbox above the file card stay functional in every mode.

## Load locally for development

The repo's source layout is browser-agnostic; a small build script assembles per-browser loadable directories into `dist/`.

```bash
scripts/build.sh                            # builds dist/firefox and dist/chrome
scripts/build.sh --zip                      # also produces dist/<browser>.zip for stores
scripts/build.sh --version 0.2.0 --zip      # explicit version override
scripts/build.sh --browser firefox          # build only one
```

Then:

- **Firefox** — go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, pick `dist/firefox/manifest.json`.
- **Chrome** — go to `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**, select `dist/chrome/`.

After editing `src/`, re-run `scripts/build.sh` and reload in the browser.

## How it works

1. The content script runs on `*://bitbucket.org/*/pull-requests/*` pages.
2. It detects each file card on the diff page by looking for Bitbucket's per-file "Viewed" label, then walks up to find the enclosing card (an ancestor that also contains the diff hunks or the "Binary file" notice).
3. Filters to supported file extensions (`.md`, `.markdown`, `.mdx`, `.mkd`, `.ods`) and injects a toolbar.
4. On mode switch, it resolves the PR's source/destination commit hashes from Bitbucket and fetches the raw before/after content from `/raw/{commit}/{path}` using your existing browser session. ODS files are fetched as binary `ArrayBuffer`; markdown as text.
5. Markdown is rendered with [`marked`](https://github.com/markedjs/marked), sanitized with [`DOMPurify`](https://github.com/cure53/DOMPurify), and diffed with [`jsdiff`](https://github.com/kpdecker/jsdiff). ODS files are unzipped with [`JSZip`](https://github.com/Stuk/jszip), parsed via DOMParser into a structured cell + style + hyperlink model, then rendered as an HTML grid with per-cell diff annotations.
6. The rendered view is appended inside Bitbucket's body region, so the chevron expand/collapse naturally controls our preview alongside the original content.

No data leaves your browser other than the file fetches that go to Bitbucket directly. No tracking, no analytics, no separate authentication. The same code runs in both Firefox and Chrome — only the manifest differs. See [`PRIVACY.md`](PRIVACY.md) for the full privacy policy.

## Files

```
manifests/firefox.json   Firefox-specific MV3 manifest (background.scripts, gecko id)
manifests/chrome.json    Chrome-specific MV3 manifest (background.service_worker)
amo-metadata.json        AMO listing metadata used by the release pipeline
scripts/build.sh         Assembles dist/firefox and dist/chrome from shared sources
src/content.js           Page detection, toolbar, fetch, mode switching, dispatch
src/renderer.js          Markdown + diff rendering helpers
src/ods-parser.js        ODS unzip + cell/style/hyperlink extraction
src/ods-renderer.js      ODS grid rendering with diff annotations
src/background.js        Privileged fetch handler (cross-browser onMessage)
src/styles.css           Toolbar, spinner, rendered Markdown, and ODS grid styling
lib/marked.min.js        Markdown parser (MIT, vendored)
lib/diff.min.js          Line-level diff (BSD-3, vendored, jsdiff)
lib/purify.min.js        HTML sanitizer (Apache-2.0/MPL-2.0, vendored, DOMPurify)
lib/jszip.min.js         ZIP reader for ODS unzipping (MIT, vendored)
icons/                   Extension icons in 16, 32, 48, 96, 128 px sizes
screens/                 Screenshots used in this README and the store listings
```

## Releases

Tagging `v*` triggers a GitHub Actions workflow that builds per-browser packages (`scripts/build.sh --zip`), lints the Firefox build with `web-ext`, submits the Firefox build to AMO, and conditionally submits the Chrome build to the Chrome Web Store (gated on a `CWS_ENABLED` repo variable). It also creates a GitHub release with both zips attached. See [`RELEASING.md`](RELEASING.md), and the per-store listing copy in [`AMO_LISTING.md`](AMO_LISTING.md) and [`CHROME_LISTING.md`](CHROME_LISTING.md).

## Known limitations

- **Side-by-side Markdown** renders the two columns independently rather than line-aligned — aligning rendered HTML to source lines reliably is more trouble than it's worth.
- **Unified Markdown** renders each diff hunk separately, so a list item or fenced code block split across hunks may render slightly differently than the full document would.
- **ODS row alignment** is naive: if a row is inserted at the top of a sheet, every cell below shifts and the diff highlights everything. Smarter row-fingerprint alignment is on the roadmap.
- **ODS cells with mid-stream changes** (e.g., a small change in a long sentence inside a cell) currently show old → new as block-level, not character-level.
- **More file formats** (CSV, JSON tree, etc.) are planned.

## License

MIT — see [`LICENSE`](LICENSE).
