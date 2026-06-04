# Next Unviewed File Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating bottom-right pill (and `n` shortcut) that jumps the reviewer to the next unviewed file in a Bitbucket Cloud PR, covering all files and surviving Bitbucket's lazy file loading.

**Architecture:** A new self-contained content script `src/nav.js` (IIFE, same style as `content.js`) drives navigation through Bitbucket's own file-tree sidebar — the only DOM source that lists every file regardless of lazy-load. Clicking a tree entry delegates load+scroll to Bitbucket. A debounced MutationObserver keeps the count fresh; one pure ordering function is unit-tested in Node.

**Tech Stack:** Vanilla JS content script, MV3 manifests (Chrome + Firefox), CSS with existing dark-mode variables. No build-time bundler; `scripts/build.sh` copies `src/` wholesale. No JS test framework — the single pure function is tested via `node`; all DOM behavior is verified on a real Bitbucket PR.

---

## Testing approach (read first)

This codebase has no test runner and the code is bound to live Bitbucket DOM that cannot be inspected from a dev box. Two verification modes are used, deliberately:

- **Node unit test** for the one pure function `chooseNext(...)` — no framework, run with `node`. This is real TDD for the orderable logic.
- **Manual verification on a real Bitbucket PR** for every DOM-bound task. Per project rule, this is the *real thing*, not a simulation. Each such task lists exact steps and expected on-screen result. Use a PR with **many files** (enough to trigger lazy loading) and **some files already marked viewed**.

Keep a scratch file `docs/superpowers/plans/recon-notes.md` (git-ignored or committed — your call) for recorded selectors from Task 1.

---

## File structure

- **Create** `src/nav.js` — all navigation logic (enumerate, choose, pill, observer, keyboard). One IIFE. Dual-exports `chooseNext` for Node tests.
- **Create** `test/choose-next.test.js` — Node assertions for `chooseNext`.
- **Modify** `manifests/chrome.json` and `manifests/firefox.json` — add `src/nav.js` to the `content_scripts[0].js` array, immediately before `src/content.js`.
- **Modify** `src/styles.css` — append `.bmd-nav-pill` rules using existing dark-mode variables.

---

## Task 1: DOM recon on a real Bitbucket PR (no code)

**Files:**
- Create: `docs/superpowers/plans/recon-notes.md`

This task produces the concrete selectors every later DOM task consumes. It is manual and gated — do not proceed until recorded.

- [ ] **Step 1: Open a real PR with many files, some marked viewed**

Open Chrome/Firefox devtools on a Bitbucket Cloud PR URL of form `https://bitbucket.org/<ws>/<repo>/pull-requests/<id>/diff`.

- [ ] **Step 2: Identify the file-tree sidebar**

In the Elements panel, locate the sidebar that lists every file. For one entry, record:
- selector for the **tree container** (stable ancestor of all entries),
- selector for a **single file entry**,
- how the entry encodes its **file path** (text content, `title`, `data-*`, or `href`),
- the **clickable element** inside the entry that scrolls/loads the file (anchor or button),
- how a **viewed** entry differs from an unviewed one (icon present/absent, `aria-checked`, class, dimmed style). Toggle a file's Viewed checkbox and watch what changes in the tree entry.

- [ ] **Step 3: Identify the loaded-card → file mapping**

For a loaded diff card, confirm `id` still starts with `chg-` (see `content.js:308`) and record how to derive its file path, so a tree entry can be matched to its on-screen card for "below current scroll" positioning.

- [ ] **Step 4: Record findings**

Write `recon-notes.md` with a filled copy of this constants block (real values, not guesses):

```js
// Filled from live Bitbucket DOM on 2026-06-04
const SEL = {
  treeContainer: "<css selector>",
  treeEntry: "<css selector, relative to treeContainer>",
  entryPath: (entryEl) => { /* return file path string */ },
  entryNav: (entryEl) => { /* return the element to .click() */ },
  entryViewed: (entryEl) => { /* return boolean viewed state */ },
};
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/recon-notes.md
git commit -m "docs: record Bitbucket PR DOM recon for unviewed-nav"
```

---

## Task 2: Pure ordering function `chooseNext` + Node test (TDD)

**Files:**
- Create: `test/choose-next.test.js`
- Create: `src/nav.js` (only the pure function + dual-export in this task)

`chooseNext` is the orderable core: given files in PR order with their viewed flag and an optional vertical position, plus the current scroll position, pick the next target index. Position semantics: a file with a known on-screen `top` (loaded card) compares against `currentTop`; files not yet loaded have `top === null` and are treated as "below" everything currently visible, in PR order.

- [ ] **Step 1: Write the failing test**

```js
// test/choose-next.test.js
"use strict";
const assert = require("assert");
const { chooseNext } = require("../src/nav.js");

// files: array of { viewed, top }  (top = px from viewport top, or null if not loaded)
// currentTop: px threshold (e.g. a small positive offset)

// 1) picks first unviewed strictly below current position
{
  const files = [
    { viewed: false, top: -100 }, // above
    { viewed: true, top: 50 },
    { viewed: false, top: 200 },  // first unviewed below
    { viewed: false, top: 400 },
  ];
  assert.strictEqual(chooseNext(files, 0), 2);
}

// 2) wraps to topmost unviewed when none are below
{
  const files = [
    { viewed: false, top: -300 }, // unviewed but above -> wrap target
    { viewed: true, top: -100 },
    { viewed: false, top: -50 },  // topmost? no: index 0 is higher in PR order
  ];
  assert.strictEqual(chooseNext(files, 0), 0);
}

// 3) not-yet-loaded files (top null) count as below, in PR order
{
  const files = [
    { viewed: true, top: 10 },
    { viewed: false, top: null }, // unloaded, below
    { viewed: false, top: null },
  ];
  assert.strictEqual(chooseNext(files, 0), 1);
}

// 4) all viewed -> null
{
  const files = [ { viewed: true, top: 10 }, { viewed: true, top: 20 } ];
  assert.strictEqual(chooseNext(files, 0), null);
}

console.log("chooseNext: all assertions passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/choose-next.test.js`
Expected: throws `Cannot find module '../src/nav.js'` or `chooseNext is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/nav.js` with the pure function and a dual-export guard at the very bottom. The IIFE wrapper for DOM code is added in Task 3; for now the file is just the function + export.

```js
"use strict";

// Pick the index of the next unviewed file to jump to.
// files: [{ viewed:boolean, top:number|null }] in PR order.
// top = px from viewport top for a loaded card, or null if not yet loaded.
// currentTop: px threshold; a file is "below" if its top > currentTop,
// and unloaded files (top === null) are always treated as below.
function chooseNext(files, currentTop) {
  const isBelow = (f) => f.top === null || f.top > currentTop;
  for (let i = 0; i < files.length; i++) {
    if (!files[i].viewed && isBelow(files[i])) return i;
  }
  for (let i = 0; i < files.length; i++) {
    if (!files[i].viewed) return i; // wrap
  }
  return null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { chooseNext };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/choose-next.test.js`
Expected: `chooseNext: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add src/nav.js test/choose-next.test.js
git commit -m "feat: pure chooseNext ordering for unviewed-file nav"
```

---

## Task 3: nav.js IIFE skeleton + manifest wiring + static pill

Wrap the file in an IIFE (preserving the dual-export), wire it into both manifests, and render a static always-visible pill so we can confirm injection on a real PR before any tree logic exists.

**Files:**
- Modify: `src/nav.js`
- Modify: `manifests/chrome.json` (content_scripts js array)
- Modify: `manifests/firefox.json` (content_scripts js array)

- [ ] **Step 1: Restructure `src/nav.js` into an IIFE with the pill**

Replace the file contents with:

```js
"use strict";

// chooseNext is defined at module top so Node tests can require it.
function chooseNext(files, currentTop) {
  const isBelow = (f) => f.top === null || f.top > currentTop;
  for (let i = 0; i < files.length; i++) {
    if (!files[i].viewed && isBelow(files[i])) return i;
  }
  for (let i = 0; i < files.length; i++) {
    if (!files[i].viewed) return i;
  }
  return null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { chooseNext };
}

(() => {
  if (typeof document === "undefined") return; // Node test context
  const log = (...a) => console.info("[bmd-nav]", ...a);

  const PR_RE = /^\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/;
  function onPrPage() {
    return PR_RE.test(location.pathname);
  }

  let pill = null;
  function ensurePill() {
    if (pill) return pill;
    pill = document.createElement("button");
    pill.type = "button";
    pill.className = "bmd-nav-pill";
    pill.textContent = "Next unviewed";
    pill.addEventListener("click", onNavClick);
    document.body.appendChild(pill);
    return pill;
  }

  function onNavClick() {
    log("nav click (no-op until Task 5)");
  }

  function start() {
    if (!onPrPage()) return;
    ensurePill(); // static for now; count + hide logic added in Task 4
    log("nav initialized");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
```

- [ ] **Step 2: Wire `src/nav.js` into chrome.json**

In `manifests/chrome.json`, the `content_scripts[0].js` array currently ends `..., "src/ods-renderer.js", "src/content.js"`. Insert `"src/nav.js"` immediately before `"src/content.js"`:

```json
        "src/ods-renderer.js",
        "src/nav.js",
        "src/content.js"
```

- [ ] **Step 3: Wire `src/nav.js` into firefox.json**

Apply the identical edit to `manifests/firefox.json`'s `content_scripts[0].js` array.

- [ ] **Step 4: Build and load the extension**

Run: `scripts/build.sh --browser chrome`
Expected: `built dist/chrome` with no error. Then load `dist/chrome` as an unpacked extension (chrome://extensions → Load unpacked).

- [ ] **Step 5: Verify on a real PR**

Open a real Bitbucket PR. Expected: a pill reading `Next unviewed` is visible bottom-right (unstyled position is fine until Task 8); devtools console shows `[bmd-nav] nav initialized`. Clicking logs `nav click (no-op until Task 5)`.

- [ ] **Step 6: Re-run the Node test (regression)**

Run: `node test/choose-next.test.js`
Expected: `chooseNext: all assertions passed` (IIFE wrapping must not break the export).

- [ ] **Step 7: Commit**

```bash
git add src/nav.js manifests/chrome.json manifests/firefox.json
git commit -m "feat: inject nav.js content script with static pill"
```

---

## Task 4: Enumerate files via the file-tree + live count

Use the recon selectors (Task 1) to list every file with its viewed state, and drive the pill's `N left` count, hiding the pill at 0.

**Files:**
- Modify: `src/nav.js`

- [ ] **Step 1: Add the SEL constants from recon and `enumerateFiles`**

Inside the IIFE (after `ensurePill`), paste the `SEL` block from `recon-notes.md` (real values) and add:

```js
  // SEL is the block recorded in recon-notes.md (Task 1). Example shape:
  // const SEL = { treeContainer, treeEntry, entryPath, entryNav, entryViewed };

  function enumerateFiles() {
    const root = document.querySelector(SEL.treeContainer);
    if (!root) return null; // tree absent -> caller uses fallback (Task 7)
    const entries = [...root.querySelectorAll(SEL.treeEntry)];
    return entries.map((el) => ({
      key: SEL.entryPath(el),
      viewed: SEL.entryViewed(el),
      el,
    }));
  }

  function unviewedCount(files) {
    return files.filter((f) => !f.viewed).length;
  }
```

- [ ] **Step 2: Update the pill to show/hide by count**

Replace `ensurePill` body's creation defaults and add a `renderPill`:

```js
  function renderPill(count) {
    const p = ensurePill();
    if (count <= 0) {
      p.style.display = "none";
      return;
    }
    p.style.display = "";
    p.textContent = `Next unviewed (${count} left)`;
  }

  function refresh() {
    const files = enumerateFiles();
    if (!files) {
      renderPill(0); // hide until fallback exists (Task 7)
      return;
    }
    renderPill(unviewedCount(files));
  }
```

- [ ] **Step 3: Call refresh from start**

In `start()`, replace `ensurePill();` with `refresh();`.

- [ ] **Step 4: Build, reload, verify count on a real PR**

Run: `scripts/build.sh --browser chrome`, reload the unpacked extension, open a real many-file PR.
Expected: pill reads `Next unviewed (N left)` where N matches the number of not-yet-viewed files **before scrolling loads them all**. Mark a file viewed via Bitbucket's checkbox, then re-open/refresh: count should reflect it (live updates come in Task 6). With all files viewed, pill is hidden.

- [ ] **Step 5: Commit**

```bash
git add src/nav.js
git commit -m "feat: count unviewed files from file-tree and drive pill"
```

---

## Task 5: Navigate to next unviewed (click tree entry, next-below + wrap)

Wire the click handler to `chooseNext`, mapping tree entries to on-screen card positions, and navigate via the tree entry's own click (Bitbucket handles lazy load + scroll).

**Files:**
- Modify: `src/nav.js`

- [ ] **Step 1: Add card-position mapping and navigate logic**

```js
  // Find the loaded card for a file path, if present, to get its viewport top.
  function cardTopForKey(key) {
    const card = document.getElementById("chg-" + encodeURIComponent(key));
    if (!card) return null;
    return card.getBoundingClientRect().top;
  }

  function navigateTo(file) {
    const target = SEL.entryNav(file.el);
    if (target) {
      target.click(); // Bitbucket loads + scrolls
    } else if (file.el.scrollIntoView) {
      file.el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function onNavClick() {
    const files = enumerateFiles();
    if (!files || !files.length) return;
    const withTops = files.map((f) => ({
      viewed: f.viewed,
      top: cardTopForKey(f.key),
    }));
    const idx = chooseNext(withTops, 1); // 1px threshold ~ "below the top edge"
    if (idx === null) return;
    navigateTo(files[idx]);
  }
```

Note: `cardTopForKey` assumes card id is `"chg-" + encodeURIComponent(path)` — confirm against recon Step 3 and adjust the id derivation if Bitbucket encodes differently.

- [ ] **Step 2: Build, reload, verify navigation on a real PR**

Run: `scripts/build.sh --browser chrome`, reload, open a real many-file PR.
Verify each, from different scroll positions:
- From top: click pill → scrolls to first unviewed file below the top.
- Mid-PR: click → goes to next unviewed *below* current position, not one above.
- Near bottom with no unviewed below: click → wraps to topmost unviewed.
- Target is a **not-yet-loaded** far-down file: click → Bitbucket loads it and scrolls to it.

- [ ] **Step 3: Commit**

```bash
git add src/nav.js
git commit -m "feat: jump to next unviewed file below scroll, wrap to top"
```

---

## Task 6: Live count refresh (debounced observer + SPA reinit)

Keep the count accurate as files lazy-load and as viewed toggles, and survive Bitbucket's client-side route changes.

**Files:**
- Modify: `src/nav.js`

- [ ] **Step 1: Add a debounced observer and URL poll**

```js
  let refreshTimer = null;
  function scheduleRefresh() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (onPrPage()) refresh();
    }, 300);
  }
```

Replace the bottom-of-IIFE bootstrap (`if (document.readyState ...) ... else start()`) with:

```js
  function boot() {
    if (onPrPage()) start();
    const obs = new MutationObserver(scheduleRefresh);
    obs.observe(document.body, { childList: true, subtree: true });
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (onPrPage()) refresh();
        else renderPill(0);
      }
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
```

(`setTimeout`/`setInterval`/`clearTimeout` are ambient browser globals; no import needed.)

- [ ] **Step 2: Build, reload, verify live updates on a real PR**

Run: `scripts/build.sh --browser chrome`, reload, open a real many-file PR.
Expected:
- Scroll to load more files → count stays correct (does not over/under-count duplicates).
- Toggle a file's Viewed checkbox → count updates within ~1s without page reload.
- Navigate from PR diff to another tab and back (SPA) → pill re-initializes correctly.

- [ ] **Step 3: Commit**

```bash
git add src/nav.js
git commit -m "feat: live-refresh unviewed count via observer and SPA reinit"
```

---

## Task 7: Card-walk fallback when the tree is absent

If `enumerateFiles` returns null (tree hidden/absent), fall back to walking loaded cards via the existing "Viewed" text-node heuristic so the feature degrades instead of disappearing.

**Files:**
- Modify: `src/nav.js`

- [ ] **Step 1: Add `fallbackEnumerate`**

Mirror `content.js:findFileContainers` (content.js:383) — walk text nodes equal to `"Viewed"`, climb to the file card, and read the card's viewed checkbox.

```js
  function fallbackEnumerate() {
    const cards = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if ((node.textContent || "").trim() !== "Viewed") continue;
      let cur = node.parentElement;
      while (cur && cur !== document.body) {
        // climb to the card: first ancestor whose id starts with "chg-"
        if (cur.id && cur.id.startsWith("chg-")) { cards.add(cur); break; }
        cur = cur.parentElement;
      }
    }
    return [...cards].map((card) => {
      const cb = card.querySelector('input[type="checkbox"]');
      return {
        key: decodeURIComponent(card.id.slice(4)),
        viewed: !!(cb && cb.checked),
        el: card,
      };
    });
  }
```

Note: confirm the card-id and checkbox shape against recon Step 2/3; adjust the climb condition if cards are not identified by a `chg-` id.

- [ ] **Step 2: Use the fallback in `refresh` and `onNavClick`**

Replace the two `enumerateFiles()` call sites so they fall back:

```js
  function getFiles() {
    return enumerateFiles() || fallbackEnumerate();
  }
```

Use `getFiles()` in both `refresh` and `onNavClick` instead of `enumerateFiles()`. In `refresh`, drop the `if (!files)` hide-branch (getFiles always returns an array; it may be empty).

- [ ] **Step 3: Build, reload, verify fallback on a real PR**

Run: `scripts/build.sh --browser chrome`, reload. If the tree can be collapsed/hidden in the PR UI, hide it and confirm the pill still counts and navigates among loaded cards. If the tree cannot be hidden, record in `recon-notes.md` that the fallback is untested-by-UI and reason through it manually.

- [ ] **Step 4: Commit**

```bash
git add src/nav.js
git commit -m "feat: card-walk fallback for unviewed nav when tree absent"
```

---

## Task 8: Keyboard shortcut `n`

Bind bare `n` to the same action, ignoring it while typing or with modifiers held.

**Files:**
- Modify: `src/nav.js`

- [ ] **Step 1: Add the keydown handler inside `boot`**

```js
  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      el.isContentEditable
    );
  }

  function onKeyDown(e) {
    if (e.key !== "n" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    if (!onPrPage()) return;
    e.preventDefault();
    onNavClick();
  }
```

In `boot()`, after setting up the observer, add: `document.addEventListener("keydown", onKeyDown);`

- [ ] **Step 2: Build, reload, verify shortcut on a real PR**

Run: `scripts/build.sh --browser chrome`, reload, open a real PR.
Expected:
- Press `n` (focus not in a field) → jumps to next unviewed, same as the pill.
- Focus a PR comment box and type a word containing `n` → no jump; the `n` is typed normally.
- `Ctrl/Cmd+n` → browser's own behavior, not hijacked.

- [ ] **Step 3: Commit**

```bash
git add src/nav.js
git commit -m "feat: bind 'n' shortcut to next-unviewed navigation"
```

---

## Task 9: Pill styling with dark-mode support

Style the pill to match the existing toolbar and theme automatically in dark mode.

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Inspect existing variables**

Open `src/styles.css` and note the dark-mode CSS custom properties already defined for `.bmd-toolbar`/`.bmd-btn` (background, foreground, border, accent). Reuse those variable names so the pill follows the same light/dark switching the toolbar uses.

- [ ] **Step 2: Append pill rules**

Add at the end of `src/styles.css`, substituting the actual variable names found in Step 1 for the placeholders in comments:

```css
.bmd-nav-pill {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2147483000; /* above Bitbucket chrome */
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--bmd-border); /* reuse toolbar's border var */
  background: var(--bmd-btn-bg);       /* reuse toolbar's button bg var */
  color: var(--bmd-fg);                /* reuse toolbar's fg var */
  font: 600 13px/1.2 inherit;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.bmd-nav-pill:hover {
  filter: brightness(1.05);
}
```

- [ ] **Step 3: Build, reload, verify theming on a real PR**

Run: `scripts/build.sh --browser chrome`, reload.
Expected:
- Pill is a rounded bottom-right button, clearly above Bitbucket UI, not overlapping critical controls.
- Toggle OS/browser dark mode (or Bitbucket theme) → pill colors switch to match the toolbar, no unreadable contrast.

- [ ] **Step 4: Build the Firefox bundle and smoke-test**

Run: `scripts/build.sh --browser firefox`
Expected: `built dist/firefox` with no error. Load `dist/firefox` (about:debugging) on a real PR and confirm pill appears + navigates.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "feat: style next-unviewed pill with dark-mode support"
```

---

## Self-review notes

- **Spec coverage:** all-files scope (Task 4 tree enum), next-below+wrap (Task 2 `chooseNext` + Task 5), bottom-right pill w/ count + hide-at-0 (Tasks 3/4/9), file-tree primary (Task 4) + card-walk fallback (Task 7), lazy-load handled via tree-click navigation (Task 5), separate `src/nav.js` (Task 3), `n` shortcut (Task 8), DOM recon prerequisite (Task 1), real-PR verification throughout, dark mode (Task 9). All spec sections mapped.
- **Type consistency:** `chooseNext(files, currentTop)` takes `{viewed, top}` in Task 2 and is fed exactly that shape in Task 5 (`{viewed, top}` via `cardTopForKey`). `enumerateFiles`/`fallbackEnumerate`/`getFiles` all return `[{key, viewed, el}]`. `SEL` keys (`treeContainer/treeEntry/entryPath/entryNav/entryViewed`) are defined in Task 1 and used unchanged in Tasks 4/5.
- **Placeholders:** the only deferred values are real-DOM selectors, which genuinely cannot exist before Task 1; they are captured as a concretely-shaped `SEL` object produced by Task 1 and consumed by name thereafter. Card-id derivation notes flag the one assumption to confirm during recon.
