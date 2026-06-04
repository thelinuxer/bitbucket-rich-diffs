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

  function navigate(file) {
    file.anchor.click(); // Bitbucket loads + scrolls to the file
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

  function onNavClick() {
    if (allFilesViewedPerHeader()) {
      showToast("All files are viewed");
      return;
    }
    const list = listFromTree();
    if (!list.length) {
      log("no file-tree anchors found");
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
