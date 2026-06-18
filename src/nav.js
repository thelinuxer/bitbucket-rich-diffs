"use strict";

// chooseNext is defined at module top so Node tests can require it.
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

  // Transient toast near the pill (e.g. "All files are viewed").
  let toastTimer = null;
  function showToast(text) {
    const t = document.createElement("div");
    t.className = "bmd-nav-toast";
    t.textContent = text;
    document.body.appendChild(t);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2500);
  }

  // --- File enumeration -----------------------------------------------------
  // The PR file-tree renders one anchor per file, href="#chg-<path>", for
  // ALL files regardless of Bitbucket's lazy-loading/virtualization of the
  // diff cards. We use those anchors as the authoritative ordered file list
  // and as the navigation trigger (a click delegates load+scroll to Bitbucket).
  //
  // Viewed state is read from the loaded diff card's checkbox when present.
  // A file whose card is not yet loaded is treated as unviewed (so we navigate
  // to it). "All files are viewed" is therefore reported only once every file's
  // card is loaded and checked — which holds after a reviewer has gone through
  // the PR.

  // Resolve the in-diff target element (id="chg-<path>") for a tree anchor's
  // raw href path. Try the raw value and common encode/decode variants because
  // the href and the element id may differ in percent-encoding.
  function findTarget(rawPath) {
    const tryKeys = [rawPath];
    try { tryKeys.push(decodeURIComponent(rawPath)); } catch (_) {}
    try { tryKeys.push(encodeURIComponent(decodeURIComponent(rawPath))); } catch (_) {}
    for (const k of tryKeys) {
      const el = document.getElementById("chg-" + k);
      if (el) return el;
    }
    return null;
  }

  function isPathViewed(rawPath) {
    const target = findTarget(rawPath);
    if (!target) return false; // not loaded -> treat as unviewed
    let cur = target;
    for (let i = 0; i < 8 && cur && cur.parentElement; i++) {
      cur = cur.parentElement;
      const cb = cur.querySelector('input[type="checkbox"]');
      if (cb) return cb.checked || cb.getAttribute("aria-checked") === "true";
    }
    return false;
  }

  // Ordered list of every file from the tree anchors, de-duplicated by path.
  function listFromTree() {
    const seen = new Set();
    const out = [];
    for (const a of document.querySelectorAll('a[href^="#chg-"]')) {
      const href = a.getAttribute("href") || "";
      const raw = href.slice(5); // strip "#chg-"
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      out.push({ raw, anchor: a });
    }
    return out;
  }

  // Fallback when the file-tree sidebar is hidden/absent: enumerate the loaded
  // diff cards directly (id="chg-<path>"), in DOM order (= PR order). Best-effort
  // only — lazy-unloaded cards are not in the DOM, so far-down files this path
  // cannot reach. The tree path remains primary when available.
  function listFromCards() {
    const seen = new Set();
    const out = [];
    for (const el of document.querySelectorAll('[id^="chg-"]')) {
      const raw = el.id.slice(4); // strip "chg-"
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      out.push({ raw, anchor: null });
    }
    return out;
  }

  // The PR "file view" tree can be collapsed via Bitbucket's "Toggle file view"
  // control, which UNMOUNTS the tree (anchors disappear from the DOM) rather than
  // just hiding it. Find that toggle so we can momentarily re-open the tree to
  // read the authoritative full file list even when the reviewer keeps it hidden.
  function findFileTreeToggle() {
    for (const b of document.querySelectorAll('button,[role="button"]')) {
      const label = (b.getAttribute("aria-label") || b.textContent || "").trim();
      if (/toggle file view/i.test(label)) return b;
    }
    return null;
  }

  // Poll until the tree anchors appear (the tree mounts asynchronously after the
  // toggle is clicked) or the timeout elapses.
  function waitForTree(timeoutMs) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        const list = listFromTree();
        if (list.length || Date.now() - t0 > timeoutMs) return resolve(list);
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  // Authoritative ordered file list. Prefer the tree anchors (complete list, even
  // for lazy-unloaded files). If the tree is collapsed/unmounted, momentarily
  // re-open it to read the full list, then restore the collapsed state. Returns
  // { list, restore } where restore() re-collapses the tree if we expanded it.
  async function acquireFileList() {
    let list = listFromTree();
    if (list.length) return { list, restore: null };

    const toggle = findFileTreeToggle();
    if (toggle) {
      toggle.click(); // expand the tree
      list = await waitForTree(1500);
      if (list.length) {
        // Re-collapse only after navigation has been dispatched, so the reviewer's
        // hidden-tree layout is preserved.
        const restore = () => {
          const t = findFileTreeToggle();
          if (t) t.click();
        };
        return { list, restore };
      }
      // Expansion failed to surface anchors — undo our toggle to avoid leaving the
      // tree in an unexpected state.
      const t = findFileTreeToggle();
      if (t) t.click();
    }

    // Last resort: enumerate loaded cards (incomplete on large lazy-loaded PRs).
    return { list: listFromCards(), restore: null };
  }

  function navigate(file) {
    if (file.anchor) file.anchor.click(); // Bitbucket loads + scrolls to the file
    const target = findTarget(file.raw);
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // --- Navigation -----------------------------------------------------------

  // Bitbucket shows an authoritative "N of M files viewed" summary. Parse it
  // for a reliable all-viewed signal independent of which cards are loaded.
  const VIEWED_SUMMARY_RE = /\b(\d+)\s+of\s+(\d+)\s+files?\s+viewed\b/i;
  function allFilesViewedPerHeader() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const m = (node.textContent || "").match(VIEWED_SUMMARY_RE);
      if (m) return Number(m[1]) === Number(m[2]) && Number(m[2]) > 0;
    }
    return false;
  }

  async function onNavClick() {
    if (allFilesViewedPerHeader()) {
      showToast("All files are viewed");
      return;
    }
    const { list, restore } = await acquireFileList();
    try {
      if (!list.length) {
        log("no files found (tree unavailable and no diff cards loaded)");
        return;
      }
      const arr = list.map((f) => {
        const t = findTarget(f.raw);
        return {
          viewed: isPathViewed(f.raw),
          top: t ? t.getBoundingClientRect().top : null,
        };
      });
      const idx = chooseNext(arr, 1);
      if (idx === null) {
        showToast("All files are viewed");
        return;
      }
      navigate(list[idx]);
    } finally {
      // Restore the reviewer's collapsed tree after navigation is dispatched.
      if (restore) setTimeout(restore, 400);
    }
  }

  // --- Lifecycle ------------------------------------------------------------

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

  function syncVisibility() {
    const p = ensurePill();
    p.hidden = !onPrPage();
  }

  function boot() {
    syncVisibility();
    if (onPrPage()) log("nav initialized");
    document.addEventListener("keydown", onKeyDown);
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        syncVisibility();
      }
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
