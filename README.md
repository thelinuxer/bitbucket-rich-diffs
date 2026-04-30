# Bitbucket Markdown Diff Renderer

A Firefox extension that renders Markdown files in Bitbucket Cloud pull-request diffs as **unified rendered** or **side-by-side rendered** views, so reviewing prose / docs / READMEs stops feeling like reading a `+`/`-` log.

## What it does

On a Bitbucket Cloud PR diff page, every file ending in `.md`, `.markdown`, `.mdx`, or `.mkd` gets a small toolbar at the top of its diff card with three modes:

| Mode | What you see |
|---|---|
| **Original diff** | Bitbucket's normal `+`/`-` line view (default). |
| **Rendered (unified)** | Markdown rendered, with added blocks tinted green and removed blocks tinted red and struck through. |
| **Rendered (side-by-side)** | Two columns: **Before** rendered on the left, **After** rendered on the right. |

The before/after content is fetched from Bitbucket via the same session you're already logged in with (no separate auth, no app password).

## Install (temporary, for development)

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Pick the `manifest.json` file in this directory.
4. Open any Bitbucket Cloud PR with a markdown file — you should see a "Markdown view:" toolbar above each `.md` file's diff.

Temporary add-ons are removed when you restart Firefox. To install permanently, the extension would need to be packaged (`web-ext build`) and signed via [AMO](https://addons.mozilla.org/).

## Files

```
manifest.json      MV3 manifest (Firefox)
src/content.js     Page detection, toolbar, fetch, mode switching
src/renderer.js    Markdown + diff rendering helpers
src/styles.css     Toolbar + rendered output styling
lib/marked.min.js  Markdown parser (vendored)
lib/diff.min.js    Line-level diff (vendored, jsdiff)
lib/purify.min.js  HTML sanitizer (vendored, DOMPurify)
icons/             Extension icons
```

## How it works

1. Content script runs on `*://bitbucket.org/*/pull-requests/*` pages.
2. It scans for diff file containers and filters to markdown extensions.
3. On mode switch, it resolves the PR's source/destination commit hashes (via `api.bitbucket.org` with your session, or by parsing the page's embedded state as a fallback).
4. It fetches the raw old and new file content from `bitbucket.org/{ws}/{repo}/raw/{commit}/{path}` (same-origin, uses your session cookie).
5. It renders with `marked`, sanitizes with `DOMPurify`, and either displays the new content alone, both side-by-side, or computes a line diff with `jsdiff` to show added/removed blocks inline.

## Known limitations

- Bitbucket's diff DOM changes occasionally; if no toolbar appears, the file-container selectors in `src/content.js` (`findFileContainers`) may need updating.
- For very large markdown files, the side-by-side columns aren't line-aligned — they're independently rendered. This is intentional: aligning rendered HTML to source lines is fragile.
- The unified view re-renders each diff hunk in isolation, so a list item or fenced code block split across hunks may render slightly differently than the full document would.
