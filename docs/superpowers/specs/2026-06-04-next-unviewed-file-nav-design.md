# Next Unviewed File Navigation — Design

Date: 2026-06-04
Status: Approved design, pending implementation

## Goal

Add a floating control to a Bitbucket Cloud pull-request page that jumps the
reviewer to the next **unviewed** file. The control floats (fixed position) so
it is reachable from anywhere in a long PR. It covers **all** files in the PR,
not only the Markdown/ODS files this extension renders.

## User-facing behavior

- A floating pill anchored **bottom-right** of the viewport reads
  `Next unviewed (N left)`, where `N` is the number of files not yet marked
  viewed.
- The pill is **hidden when `N == 0`** (nothing left to review).
- Clicking the pill (or pressing the keyboard shortcut **`n`**) navigates to the
  **first unviewed file below the current scroll position**; if none is below,
  it **wraps to the topmost unviewed file**.
- Navigation scrolls smoothly to the target file and aligns it to the top of the
  viewport.

## The lazy-load problem

Bitbucket renders diff cards progressively. On a PR with many files, only a
subset of file cards exist in the DOM at any time; scrolling triggers a spinner
that loads more. Therefore the set of in-DOM cards is **not** the full file list,
and we cannot compute an accurate count or reliably reach a far-down file by
walking cards alone.

**Resolution:** drive navigation through Bitbucket's own **file-tree sidebar**,
which enumerates every file in the PR regardless of lazy-load state and exposes a
per-file viewed indicator. Clicking a tree entry makes Bitbucket itself load and
scroll to that file — we use the lazy loader's own navigation instead of
fighting it.

## Architecture

New module **`src/nav.js`**, loaded immediately before `src/content.js` in both
manifests' content-script `js` arrays. It is self-contained (IIFE, same style as
`content.js`) and shares nothing with `content.js` except the DOM. Rationale:
keep `content.js` focused on rich-diff rendering; navigation is an independent
concern with its own lifecycle.

### Units

1. **`enumerateFiles()` → ordered `[{ key, viewed, navigate() }]`**
   - Primary source: the file-tree sidebar. Each entry yields:
     - `key`: a stable identifier (file path) used for de-dup and ordering.
     - `viewed`: boolean, read from the entry's viewed indicator
       (icon / `aria` state / class).
     - `navigate()`: clicks the tree entry's link, delegating load+scroll to
       Bitbucket.
   - Order follows the tree's DOM order, which matches PR file order.

2. **`fallbackEnumerate()`** (only if the tree is absent/empty)
   - Reuse the existing "Viewed" text-node walk pattern
     (`content.js:findFileContainers`) to find loaded cards, read viewed state
     from each card's checkbox, and `navigate()` via `scrollIntoView`. Because
     lazy-loaded cards may be missing, this path may force incremental scrolling
     to reveal more cards. Documented as best-effort; the tree path is expected
     to be the norm.

3. **`pickNext(files)`**
   - Returns the first `!viewed` file whose target is **below** the current
     scroll position; if none, the topmost `!viewed` file (wrap). For tree
     entries, "below current scroll" is determined by the position of the
     matching loaded card when present, otherwise by the entry's order index
     relative to the nearest currently-visible file.

4. **`renderPill(count)`**
   - Creates/updates the fixed bottom-right pill. Hidden when `count == 0`.
   - Click handler → `pickNext` → `navigate()`.

5. **Lifecycle / refresh**
   - A debounced `MutationObserver` on `document.body` recomputes the count when
     the tree or cards change (files load, viewed toggled). Same observer idiom
     as `content.js:start`.
   - Recompute on click as well, so a stale count never misroutes.
   - Re-init on SPA URL change (Bitbucket is a single-page app), mirroring the
     `setInterval` URL-poll already in `content.js`.

6. **Keyboard shortcut**
   - Global `keydown` listener: bare **`n`** triggers the same action as the
     pill. Ignored when focus is in an input/textarea/contenteditable or when a
     modifier key is held, so it does not hijack typing in comment boxes.

### Styles

Append a `.bmd-nav-pill` rule set to `src/styles.css`. Reuse the existing
dark-mode CSS variables already defined for the toolbar so the pill themes
automatically. Fixed position, high `z-index`, non-intrusive.

## DOM recon prerequisite

The tree-entry structure, the viewed indicator, and the clickable nav element
are Bitbucket-specific and cannot be inspected from this environment. The
implementation plan **must begin with a recon step on a real Bitbucket PR**
(many files, some marked viewed) to capture the actual selectors/attributes for:

- the file-tree container and its per-file entries,
- the viewed indicator on a tree entry,
- the clickable element that triggers load+scroll,
- how a tree entry maps to a loaded card (for "below current scroll").

No selectors are hardcoded in this spec on purpose — they are filled in during
recon, following the codebase's existing preference for verified, heuristic DOM
access over guessed test-ids.

## Testing / verification

Per project rule, verify against the real thing — not a simulation:

1. Load the unpacked extension, open a real Bitbucket PR with many files.
2. Confirm the pill appears with a correct `N left` count before all cards load.
3. Mark files viewed; confirm count decrements and pill hides at 0.
4. Click / press `n` from various scroll positions; confirm next-below-then-wrap
   behavior and that far-down (not-yet-loaded) files load and scroll correctly.
5. Confirm `n` is ignored while typing in a comment box.
6. Confirm dark-mode theming.

## Out of scope (YAGNI)

- Previous-unviewed / back navigation.
- Marking files viewed from the pill.
- Configurable position or custom keybinding.
- Per-file-type filtering (covers all files by design).

## Decisions (from brainstorming)

- Scope: **all** PR files.
- Order: next unviewed **below current scroll**, wrap to top.
- UI: bottom-right pill **with count**, hidden at 0.
- Nav source: **file-tree primary**, card-walk fallback.
- Structure: separate **`src/nav.js`**; keyboard shortcut **`n`**.
