"use strict";

const BMD = (() => {
  const MARKED_OPTS = { gfm: true, breaks: false, headerIds: false, mangle: false };

  function configure() {
    if (typeof marked === "undefined") return;
    marked.setOptions(MARKED_OPTS);
  }

  function asResult(input) {
    if (input && typeof input === "object" && "text" in input) return input;
    return { text: input || "", missing: !input };
  }

  function renderMarkdown(text) {
    configure();
    const html = marked.parse(text || "", MARKED_OPTS);
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }

  function buildLineDiff(oldText, newText) {
    return Diff.diffLines(oldText || "", newText || "", { newlineIsToken: false });
  }

  function makeRenderedDoc(input, extraClass = "", emptyMsg = null) {
    const res = asResult(input);
    const wrap = document.createElement("div");
    wrap.className = `bmd-rendered ${extraClass}`.trim();
    if (!res.text || !res.text.trim()) {
      const note = document.createElement("div");
      note.className = "bmd-empty-note";
      note.textContent = emptyMsg || (res.missing ? "(file does not exist in this revision)" : "(empty file)");
      wrap.appendChild(note);
      return wrap;
    }
    wrap.innerHTML = renderMarkdown(res.text);
    return wrap;
  }

  function makeSideBySide(oldInput, newInput) {
    const oldRes = asResult(oldInput);
    const newRes = asResult(newInput);
    const newFile = oldRes.missing && !newRes.missing;
    const deletedFile = newRes.missing && !oldRes.missing;

    const root = document.createElement("div");
    root.className = "bmd-sxs";

    const left = document.createElement("div");
    left.className = "bmd-sxs-col bmd-sxs-old";
    const leftHead = document.createElement("div");
    leftHead.className = "bmd-sxs-head";
    leftHead.textContent = "Before";
    left.appendChild(leftHead);
    left.appendChild(makeRenderedDoc(oldRes, "", newFile ? "(new file — did not exist before)" : null));

    const right = document.createElement("div");
    right.className = "bmd-sxs-col bmd-sxs-new";
    const rightHead = document.createElement("div");
    rightHead.className = "bmd-sxs-head";
    rightHead.textContent = "After";
    right.appendChild(rightHead);
    right.appendChild(makeRenderedDoc(newRes, "", deletedFile ? "(file deleted)" : null));

    root.appendChild(left);
    root.appendChild(right);
    return root;
  }

  function makeUnifiedRendered(oldInput, newInput) {
    const oldRes = asResult(oldInput);
    const newRes = asResult(newInput);
    const root = document.createElement("div");
    root.className = "bmd-unified";

    if (oldRes.missing && !newRes.missing) {
      const note = document.createElement("div");
      note.className = "bmd-empty-note bmd-empty-banner";
      note.textContent = "New file — entire content is added below";
      root.appendChild(note);
    } else if (newRes.missing && !oldRes.missing) {
      const note = document.createElement("div");
      note.className = "bmd-empty-note bmd-empty-banner";
      note.textContent = "File deleted — original content shown below struck through";
      root.appendChild(note);
    }

    const parts = buildLineDiff(oldRes.text, newRes.text);
    for (const part of parts) {
      if (!part.value) continue;
      const block = document.createElement("div");
      if (part.added) {
        block.className = "bmd-block bmd-added";
      } else if (part.removed) {
        block.className = "bmd-block bmd-removed";
      } else {
        block.className = "bmd-block bmd-context";
      }
      block.appendChild(makeRenderedDoc(part.value));
      root.appendChild(block);
    }
    return root;
  }

  return {
    renderMarkdown,
    makeRenderedDoc,
    makeSideBySide,
    makeUnifiedRendered,
  };
})();
