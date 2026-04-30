"use strict";

(() => {
  const MD_EXT = /\.(md|markdown|mdx|mkd)$/i;
  const MODES = ["original", "unified", "sxs"];
  const MODE_LABEL = {
    original: "Original diff",
    unified: "Rendered (unified)",
    sxs: "Rendered (side-by-side)",
  };

  const state = {
    ws: null,
    repo: null,
    prId: null,
    commitsPromise: null,
    rawCache: new Map(),
  };

  const BG = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
  const log = (...a) => console.info("[bmd]", ...a);
  const warn = (...a) => console.warn("[bmd]", ...a);

  async function bgFetch(url, accept = "application/json") {
    if (!BG || !BG.runtime || !BG.runtime.sendMessage) {
      throw new Error("extension messaging unavailable");
    }
    const res = await BG.runtime.sendMessage({ type: "bmd-fetch", url, accept });
    if (!res) throw new Error("no response from background");
    return res;
  }

  function parseLocation() {
    const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/);
    if (!m) return false;
    state.ws = m[1];
    state.repo = m[2];
    state.prId = m[3];
    return true;
  }

  function extractCommits(d) {
    const src = d?.source?.commit?.hash || d?.fromRef?.latestCommit || d?.from?.commit?.hash;
    const dst = d?.destination?.commit?.hash || d?.toRef?.latestCommit || d?.to?.commit?.hash;
    return { src, dst };
  }

  async function trySameOriginPR(path, label) {
    try {
      const r = await fetch(path, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!r.ok) {
        warn(`${label} returned ${r.status}`);
        return null;
      }
      const text = await r.text();
      let d;
      try { d = JSON.parse(text); } catch (_) {
        warn(`${label} returned non-JSON`, text.slice(0, 120));
        return null;
      }
      const { src, dst } = extractCommits(d);
      if (src && dst) {
        log(`got commits via ${label}`, { src, dst });
        return { src, dst };
      }
      warn(`${label} response missing hashes`, d);
      return null;
    } catch (err) {
      warn(`${label} fetch errored`, err && err.message ? err.message : err);
      return null;
    }
  }

  async function tryBackgroundPR(url, label) {
    try {
      const r = await bgFetch(url);
      if (!r.ok) {
        warn(`${label} returned ${r.status}`, (r.text || r.error || "").slice(0, 200));
        return null;
      }
      const d = JSON.parse(r.text);
      const { src, dst } = extractCommits(d);
      if (src && dst) {
        log(`got commits via ${label}`, { src, dst });
        return { src, dst };
      }
      warn(`${label} response missing hashes`, d);
      return null;
    } catch (err) {
      warn(`${label} fetch errored`, err && err.message ? err.message : err);
      return null;
    }
  }

  async function tryApiEndpoints() {
    const samePath = `/!api/2.0/repositories/${state.ws}/${state.repo}/pullrequests/${state.prId}`;
    const sameResult = await trySameOriginPR(samePath, "same-origin /!api/2.0");
    if (sameResult) return sameResult;

    const apiUrl = `https://api.bitbucket.org/2.0/repositories/${state.ws}/${state.repo}/pullrequests/${state.prId}`;
    const apiResult = await tryBackgroundPR(apiUrl, "api.bitbucket.org");
    if (apiResult) return apiResult;

    return null;
  }

  function dumpDomDiagnostics() {
    const anchors = document.querySelectorAll("a[href]");
    const prefixCounts = new Map();
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("#")) continue;
      const key = href.length <= 60 ? href : href.slice(0, 60) + "…";
      prefixCounts.set(key, (prefixCounts.get(key) || 0) + 1);
    }
    const topPrefixes = [...prefixCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([href, n]) => `${n}× ${href}`);

    const dataAttrs = [];
    for (const el of document.querySelectorAll("*")) {
      if (!el.dataset) continue;
      for (const k of Object.keys(el.dataset)) {
        const lk = k.toLowerCase();
        if (/branch|commit|hash|source|dest|target|merge|ref/.test(lk)) {
          const v = el.dataset[k];
          if (v && v.length < 100) dataAttrs.push(`${el.tagName.toLowerCase()}[data-${k}]=${v}`);
        }
      }
      if (dataAttrs.length > 30) break;
    }

    const metas = [];
    for (const m of document.querySelectorAll("meta[name],meta[property]")) {
      const n = m.getAttribute("name") || m.getAttribute("property");
      const c = m.getAttribute("content");
      if (n && c && /branch|commit|source|dest|pull|merge/i.test(n)) {
        metas.push(`${n}=${c.slice(0, 80)}`);
      }
    }

    const firstFile = document.querySelector('[id^="chg-"]');
    const firstFileSnippet = firstFile
      ? firstFile.outerHTML.slice(0, 600).replace(/\s+/g, " ")
      : null;

    return {
      title: document.title,
      anchorCount: anchors.length,
      topAnchorPrefixes: topPrefixes,
      relevantDataAttrs: dataAttrs.slice(0, 30),
      relevantMetas: metas,
      firstFileSnippet,
    };
  }

  function scrapeFromAnchors() {
    const refCounts = new Map();
    const branchHrefs = new Set();
    const commitHrefs = new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      const mSrc = href.match(/\/src\/([^/?#]+)\//);
      if (mSrc) {
        const ref = decodePath(mSrc[1]);
        refCounts.set(ref, (refCounts.get(ref) || 0) + 1);
      }
      if (/\/branch\//.test(href)) branchHrefs.add(href);
      if (/\/commits?\/[a-f0-9]{7,40}/i.test(href)) commitHrefs.add(href);
    }
    return {
      refCounts: [...refCounts.entries()].sort((a, b) => b[1] - a[1]),
      branchHrefs: [...branchHrefs].slice(0, 20),
      commitHrefs: [...commitHrefs].slice(0, 20),
    };
  }

  function scrapeFromScripts() {
    const out = { src: null, dst: null, samples: [] };
    for (const s of document.querySelectorAll("script")) {
      const txt = s.textContent || "";
      if (txt.length < 50 || txt.length > 4_000_000) continue;
      const hasSrc = /"source"\s*:/.test(txt);
      const hasDst = /"destination"\s*:/.test(txt);
      if (hasSrc || hasDst) out.samples.push(txt.length);
      if (!out.src) {
        const m = txt.match(/"source"\s*:\s*\{[\s\S]{0,1500}?"hash"\s*:\s*"([a-f0-9]{12,40})"/);
        if (m) out.src = m[1];
      }
      if (!out.dst) {
        const m = txt.match(/"destination"\s*:\s*\{[\s\S]{0,1500}?"hash"\s*:\s*"([a-f0-9]{12,40})"/);
        if (m) out.dst = m[1];
      }
      if (!out.dst) {
        const m = txt.match(/"merge[_-]?[bB]ase[^"]*"\s*:\s*\{?\s*"?(?:hash"?\s*:\s*)?"([a-f0-9]{12,40})"/);
        if (m) out.dst = m[1];
      }
      if (out.src && out.dst) break;
    }
    return out;
  }

  function pickBranchFromHrefs(hrefs, exclude) {
    for (const href of hrefs) {
      const m = href.match(/\/branch\/([^?#]+)/);
      if (!m) continue;
      const name = decodePath(m[1]);
      if (name && name !== exclude) return name;
    }
    return null;
  }

  async function getCommits() {
    if (state.commitsPromise) return state.commitsPromise;
    state.commitsPromise = (async () => {
      const apiResult = await tryApiEndpoints();
      if (apiResult) return apiResult;

      const fromScripts = scrapeFromScripts();
      const fromAnchors = scrapeFromAnchors();

      let src = fromScripts.src;
      if (!src && fromAnchors.refCounts.length) {
        src = fromAnchors.refCounts[0][0];
      }
      let dst = fromScripts.dst;
      let dstIsBranch = false;
      if (!dst) {
        const branch = pickBranchFromHrefs(fromAnchors.branchHrefs, src);
        if (branch) { dst = branch; dstIsBranch = true; }
      }
      if (!dst && fromAnchors.refCounts.length > 1) {
        dst = fromAnchors.refCounts[1][0];
        dstIsBranch = true;
      }

      if (src && dst) {
        log("got commits via DOM scrape", { src, dst, dstIsBranch });
        return { src, dst, dstIsBranch };
      }

      const detail = {
        scriptsFound: fromScripts.samples.length,
        scriptHashesParsed: { src: fromScripts.src, dst: fromScripts.dst },
        topRefs: fromAnchors.refCounts.slice(0, 8),
        branchHrefsSample: fromAnchors.branchHrefs.slice(0, 8),
        commitHrefsSample: fromAnchors.commitHrefs.slice(0, 8),
        dom: dumpDomDiagnostics(),
      };
      warn("could not resolve commits — dumping diagnostics:", detail);
      throw new Error(
        "Could not determine PR commit hashes (open devtools console for [bmd] details)"
      );
    })();
    return state.commitsPromise;
  }

  async function fetchRaw(hash, path) {
    if (!hash) return { text: "", missing: true };
    const key = `${hash}::${path}`;
    if (state.rawCache.has(key)) return state.rawCache.get(key);
    const url = `/${state.ws}/${state.repo}/raw/${hash}/${encodeURI(path)}`;
    const r = await fetch(url, { credentials: "include" });
    if (r.status === 404) {
      const result = { text: "", missing: true };
      state.rawCache.set(key, result);
      return result;
    }
    if (!r.ok) throw new Error(`raw fetch failed (${r.status}) for ${path}@${hash}`);
    const text = await r.text();
    const result = { text, missing: false };
    state.rawCache.set(key, result);
    return result;
  }

  function isMarkdownPath(p) {
    return !!p && MD_EXT.test(p);
  }

  function decodePath(s) {
    try { return decodeURIComponent(s); } catch { return s; }
  }

  function extractPath(fileEl) {
    if (fileEl.id && fileEl.id.startsWith("chg-")) {
      return decodePath(fileEl.id.slice(4));
    }
    const innerAnchor = fileEl.querySelector('[id^="chg-"]');
    if (innerAnchor && innerAnchor.id) {
      return decodePath(innerAnchor.id.slice(4));
    }
    const filenameEl = findMarkdownFilenameIn(fileEl);
    if (filenameEl) {
      return (filenameEl.textContent || "").trim();
    }
    for (const a of fileEl.querySelectorAll('a[href*="/src/"]')) {
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/src\/[^/]+\/(.+?)(?:[?#]|$)/);
      if (m) return decodePath(m[1]);
    }
    return null;
  }

  const FILENAME_RE = /^[\w@][\w./@+-]*\.(md|markdown|mdx|mkd)$/i;
  const HUNK_HEADER_RE = /^\s*@@\s*-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s*@@/;

  function findMarkdownFilenameIn(el) {
    const candidates = el.querySelectorAll(
      "button, span, a, h1, h2, h3, h4, h5, h6, [data-qa='bk-filepath'], [data-testid='filename']"
    );
    for (const c of candidates) {
      const t = (c.textContent || "").trim();
      if (FILENAME_RE.test(t)) return c;
    }
    return null;
  }

  function findFileContainers() {
    const cards = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent || "";
      if (text.length > 200 || !HUNK_HEADER_RE.test(text)) continue;
      let cur = node.parentElement;
      while (cur && cur !== document.body) {
        if (findMarkdownFilenameIn(cur)) {
          let chosen = cur;
          let parent = cur.parentElement;
          while (parent && parent !== document.body) {
            const filenameMatches = [];
            const sub = parent.querySelectorAll(
              "button, span, a, h1, h2, h3, h4, h5, h6"
            );
            for (const c of sub) {
              const t = (c.textContent || "").trim();
              if (FILENAME_RE.test(t)) filenameMatches.push(c);
              if (filenameMatches.length > 1) break;
            }
            if (filenameMatches.length > 1) break;
            chosen = parent;
            parent = parent.parentElement;
          }
          cards.add(chosen);
          break;
        }
        cur = cur.parentElement;
      }
    }
    return [...cards];
  }

  function buildToolbar(fileEl, path) {
    const bar = document.createElement("div");
    bar.className = "bmd-toolbar";

    const label = document.createElement("span");
    label.className = "bmd-label";
    label.textContent = "Markdown view:";
    bar.appendChild(label);

    const filename = document.createElement("span");
    filename.className = "bmd-filename";
    filename.textContent = path;
    filename.title = path;
    bar.appendChild(filename);

    const group = document.createElement("div");
    group.className = "bmd-btn-group";
    bar.appendChild(group);

    const status = document.createElement("span");
    status.className = "bmd-status";
    bar.appendChild(status);

    const buttons = {};
    for (const m of MODES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bmd-btn";
      b.textContent = MODE_LABEL[m];
      b.dataset.mode = m;
      b.addEventListener("click", () => setMode(fileEl, path, m));
      group.appendChild(b);
      buttons[m] = b;
    }

    fileEl._bmd = { bar, buttons, status, path, mode: "original", view: null };
    return bar;
  }

  function setActiveButton(fileEl, mode) {
    for (const m of MODES) {
      fileEl._bmd.buttons[m].classList.toggle("bmd-active", m === mode);
    }
  }

  function setStatus(fileEl, text, kind = "info") {
    const s = fileEl._bmd.status;
    s.textContent = text || "";
    s.dataset.kind = kind;
  }

  async function setMode(fileEl, path, mode) {
    const ctx = fileEl._bmd;
    if (ctx.mode === mode) return;
    setActiveButton(fileEl, mode);
    ctx.mode = mode;
    fileEl.classList.toggle("bmd-mode-rendered", mode !== "original");

    if (mode === "original") {
      setStatus(fileEl, "");
      return;
    }

    if (!ctx.view) {
      ctx.view = document.createElement("div");
      ctx.view.className = "bmd-view";
      fileEl.appendChild(ctx.view);
    }

    setStatus(fileEl, "Loading…");
    try {
      const { src, dst } = await getCommits();
      const [oldRes, newRes] = await Promise.all([
        fetchRaw(dst, path),
        fetchRaw(src, path),
      ]);
      ctx.view.innerHTML = "";
      const rendered = mode === "sxs"
        ? BMD.makeSideBySide(oldRes, newRes)
        : BMD.makeUnifiedRendered(oldRes, newRes);
      ctx.view.appendChild(rendered);
      setStatus(fileEl, "");
    } catch (err) {
      ctx.view.innerHTML = "";
      const msg = document.createElement("div");
      msg.className = "bmd-error";
      msg.textContent = `Could not render: ${err && err.message ? err.message : err}`;
      ctx.view.appendChild(msg);
      setStatus(fileEl, "Failed", "error");
    }
  }

  function attach(fileEl) {
    if (fileEl.dataset.bmdAttached) return;
    const path = extractPath(fileEl);
    if (!isMarkdownPath(path)) return;
    fileEl.dataset.bmdAttached = "1";
    fileEl.classList.add("bmd-host");
    const bar = buildToolbar(fileEl, path);
    fileEl.insertBefore(bar, fileEl.firstChild);
    setActiveButton(fileEl, "original");
  }

  function scan() {
    if (!state.ws) return;
    for (const el of findFileContainers()) attach(el);
  }

  function start() {
    if (!parseLocation()) return;
    scan();
    const obs = new MutationObserver(() => {
      if (!parseLocation()) return;
      scan();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        state.commitsPromise = null;
        state.rawCache.clear();
        if (parseLocation()) scan();
      }
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
