"use strict";

/**
 * Render an ODS diff. Inputs are { text, missing } shaped raw fetches; this
 * module decodes them with BMD_ODS.parse and produces grid HTML annotated
 * with per-cell diff state.
 *
 * BMD_ODS_RENDER.makeUnified(oldRes, newRes) -> HTMLElement
 * BMD_ODS_RENDER.makeSideBySide(oldRes, newRes) -> HTMLElement
 *
 * Both return an element you can appendChild into the toolbar's view area.
 */
const BMD_ODS_RENDER = (() => {
  function asResult(input) {
    if (input && typeof input === "object" && "text" in input) return input;
    return { text: input || "", missing: !input };
  }

  function bytesFromResult(res) {
    const r = asResult(res);
    if (r.missing) return null;
    if (r.bytes) return r.bytes;
    if (r.text) {
      const bytes = new Uint8Array(r.text.length);
      for (let i = 0; i < r.text.length; i++) bytes[i] = r.text.charCodeAt(i) & 0xff;
      return bytes.buffer;
    }
    return null;
  }

  async function parseSafe(input) {
    const bytes = bytesFromResult(input);
    if (!bytes) return null;
    try {
      return await BMD_ODS.parse(bytes);
    } catch (err) {
      return { error: err && err.message ? err.message : String(err) };
    }
  }

  function styleHash(s) {
    if (!s) return "";
    return [s.bg, s.color, s.fontWeight, s.fontStyle, s.fontSize, s.textAlign, s.border]
      .map((v) => v || "")
      .join("|");
  }

  function cellState(oldCell, newCell, oldStyles, newStyles) {
    if (!oldCell && !newCell) return "empty";
    if (!oldCell && newCell) return "added";
    if (oldCell && !newCell) return "removed";
    const sameText = (oldCell.text || "") === (newCell.text || "");
    const sameHref = (oldCell.hyperlink || "") === (newCell.hyperlink || "");
    if (!sameText || !sameHref) return "changed";
    const oldStyle = (oldCell.styleId && oldStyles[oldCell.styleId]) || null;
    const newStyle = (newCell.styleId && newStyles[newCell.styleId]) || null;
    if (styleHash(oldStyle) !== styleHash(newStyle)) return "style";
    return "unchanged";
  }

  function applyStyle(td, styleObj) {
    if (!styleObj) return;
    if (styleObj.bg && styleObj.bg !== "transparent") td.style.backgroundColor = styleObj.bg;
    if (styleObj.color) td.style.color = styleObj.color;
    if (styleObj.fontWeight) td.style.fontWeight = styleObj.fontWeight;
    if (styleObj.fontStyle) td.style.fontStyle = styleObj.fontStyle;
    if (styleObj.fontSize) td.style.fontSize = styleObj.fontSize;
    if (styleObj.textAlign) td.style.textAlign = styleObj.textAlign;
    if (styleObj.border) td.style.border = styleObj.border;
  }

  function renderCellContent(cell) {
    const out = document.createElement("div");
    out.className = "bmd-ods-cell-content";
    if (cell && cell.text) {
      const t = document.createElement("div");
      t.className = "bmd-ods-cell-text";
      t.textContent = cell.text;
      out.appendChild(t);
    }
    if (cell && cell.hyperlink) {
      const chip = document.createElement("div");
      chip.className = "bmd-ods-link-chip";
      chip.textContent = cell.hyperlink;
      chip.title = cell.hyperlink;
      out.appendChild(chip);
    }
    return out;
  }

  function colLabel(i) {
    let s = "";
    let n = i + 1;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function renderSheetGrid(oldSheet, newSheet, oldStyles, newStyles) {
    const root = document.createElement("div");
    root.className = "bmd-ods-grid-wrap";
    const table = document.createElement("table");
    table.className = "bmd-ods-grid";

    const oldRows = (oldSheet && oldSheet.rows) || [];
    const newRows = (newSheet && newSheet.rows) || [];
    const rowCount = Math.max(oldRows.length, newRows.length);
    let maxCols = 0;
    for (let r = 0; r < rowCount; r++) {
      maxCols = Math.max(
        maxCols,
        (oldRows[r] && oldRows[r].length) || 0,
        (newRows[r] && newRows[r].length) || 0
      );
    }
    if (maxCols === 0) {
      const empty = document.createElement("div");
      empty.className = "bmd-ods-empty";
      empty.textContent = "(empty sheet)";
      root.appendChild(empty);
      return root;
    }
    // Drop columns that are entirely empty across every row of either side.
    const visibleCols = [];
    for (let c = 0; c < maxCols; c++) {
      let hasContent = false;
      for (let r = 0; r < rowCount && !hasContent; r++) {
        const oc = (oldRows[r] || [])[c];
        const nc = (newRows[r] || [])[c];
        if ((oc && (oc.text || oc.hyperlink)) || (nc && (nc.text || nc.hyperlink))) {
          hasContent = true;
        }
      }
      if (hasContent) visibleCols.push(c);
    }
    if (visibleCols.length === 0) {
      const empty = document.createElement("div");
      empty.className = "bmd-ods-empty";
      empty.textContent = "(empty sheet)";
      root.appendChild(empty);
      return root;
    }
    const colCount = visibleCols.length;

    // Header row: column letters (only for visible columns, using their original index)
    const thead = document.createElement("thead");
    const headTr = document.createElement("tr");
    headTr.appendChild(document.createElement("th")); // corner
    for (const c of visibleCols) {
      const th = document.createElement("th");
      th.className = "bmd-ods-col-label";
      th.textContent = colLabel(c);
      headTr.appendChild(th);
    }
    thead.appendChild(headTr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let r = 0; r < rowCount; r++) {
      const tr = document.createElement("tr");
      const rowLabel = document.createElement("th");
      rowLabel.className = "bmd-ods-row-label";
      rowLabel.textContent = String(r + 1);
      tr.appendChild(rowLabel);
      const oldRow = oldRows[r] || [];
      const newRow = newRows[r] || [];
      for (const c of visibleCols) {
        const td = document.createElement("td");
        const oldCell = oldRow[c] || null;
        const newCell = newRow[c] || null;
        const state = cellState(oldCell, newCell, oldStyles, newStyles);
        td.className = `bmd-ods-cell bmd-ods-cell-${state}`;
        const winningCell = newCell || oldCell;
        if (winningCell) {
          if (winningCell.colSpan > 1) td.colSpan = winningCell.colSpan;
          if (winningCell.rowSpan > 1) td.rowSpan = winningCell.rowSpan;
          const styles = newCell ? newStyles : oldStyles;
          if (winningCell.styleId) applyStyle(td, styles[winningCell.styleId]);
        }
        if (state === "removed") {
          const wrap = document.createElement("div");
          wrap.appendChild(renderCellContent(oldCell));
          const tag = document.createElement("div");
          tag.className = "bmd-ods-tag";
          tag.textContent = "removed";
          wrap.appendChild(tag);
          td.appendChild(wrap);
        } else if (state === "added") {
          td.appendChild(renderCellContent(newCell));
          const tag = document.createElement("div");
          tag.className = "bmd-ods-tag";
          tag.textContent = "added";
          td.appendChild(tag);
        } else if (state === "changed") {
          const wrap = document.createElement("div");
          const before = document.createElement("div");
          before.className = "bmd-ods-changed-before";
          before.appendChild(renderCellContent(oldCell));
          const arrow = document.createElement("div");
          arrow.className = "bmd-ods-arrow";
          arrow.textContent = "↓";
          const after = document.createElement("div");
          after.className = "bmd-ods-changed-after";
          after.appendChild(renderCellContent(newCell));
          wrap.appendChild(before);
          wrap.appendChild(arrow);
          wrap.appendChild(after);
          td.appendChild(wrap);
        } else if (state === "style") {
          td.appendChild(renderCellContent(newCell));
          const tag = document.createElement("div");
          tag.className = "bmd-ods-tag bmd-ods-tag-style";
          tag.textContent = "format";
          td.appendChild(tag);
        } else {
          if (winningCell) td.appendChild(renderCellContent(winningCell));
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    root.appendChild(table);
    return root;
  }

  function countChanges(oldSheet, newSheet, oldStyles, newStyles) {
    const counts = { added: 0, removed: 0, changed: 0, style: 0 };
    const oldRows = (oldSheet && oldSheet.rows) || [];
    const newRows = (newSheet && newSheet.rows) || [];
    const rowCount = Math.max(oldRows.length, newRows.length);
    for (let r = 0; r < rowCount; r++) {
      const oldRow = oldRows[r] || [];
      const newRow = newRows[r] || [];
      const cols = Math.max(oldRow.length, newRow.length);
      for (let c = 0; c < cols; c++) {
        const s = cellState(oldRow[c] || null, newRow[c] || null, oldStyles, newStyles);
        if (s === "added" || s === "removed" || s === "changed" || s === "style") counts[s]++;
      }
    }
    return counts;
  }

  function buildSheetTabs(oldDoc, newDoc) {
    const names = new Set();
    if (oldDoc) for (const s of oldDoc.sheets) names.add(s.name);
    if (newDoc) for (const s of newDoc.sheets) names.add(s.name);
    const list = [...names];
    const tabs = list.map((name) => {
      const oldSheet = oldDoc && oldDoc.sheets.find((s) => s.name === name);
      const newSheet = newDoc && newDoc.sheets.find((s) => s.name === name);
      const counts = countChanges(
        oldSheet,
        newSheet,
        (oldDoc && oldDoc.styles) || {},
        (newDoc && newDoc.styles) || {}
      );
      const totalChanges = counts.added + counts.removed + counts.changed + counts.style;
      return { name, oldSheet, newSheet, counts, totalChanges };
    });
    return tabs;
  }

  async function makeView(oldInput, newInput, mode) {
    const oldRes = asResult(oldInput);
    const newRes = asResult(newInput);
    const root = document.createElement("div");
    root.className = "bmd-ods-root";

    const [oldDoc, newDoc] = await Promise.all([parseSafe(oldRes), parseSafe(newRes)]);

    if (oldDoc && oldDoc.error) return errorEl(`Could not parse old version: ${oldDoc.error}`);
    if (newDoc && newDoc.error) return errorEl(`Could not parse new version: ${newDoc.error}`);

    if (!oldDoc && !newDoc) return errorEl("Both versions of this file are missing.");

    if (oldRes.missing && newDoc) {
      const banner = document.createElement("div");
      banner.className = "bmd-empty-note bmd-empty-banner";
      banner.textContent = "New file — entire spreadsheet is added below";
      root.appendChild(banner);
    } else if (newRes.missing && oldDoc) {
      const banner = document.createElement("div");
      banner.className = "bmd-empty-note bmd-empty-banner";
      banner.textContent = "File deleted — original content shown below";
      root.appendChild(banner);
    }

    const tabs = buildSheetTabs(oldDoc, newDoc);

    if (tabs.length > 1) {
      const strip = document.createElement("div");
      strip.className = "bmd-ods-tabs";
      const sheetArea = document.createElement("div");
      sheetArea.className = "bmd-ods-sheet-area";
      const buttons = [];
      tabs.forEach((tab, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bmd-ods-tab";
        b.textContent = tab.totalChanges
          ? `${tab.name} (${tab.totalChanges} change${tab.totalChanges === 1 ? "" : "s"})`
          : tab.name;
        b.addEventListener("click", () => {
          buttons.forEach((bb) => bb.classList.remove("bmd-ods-tab-active"));
          b.classList.add("bmd-ods-tab-active");
          sheetArea.innerHTML = "";
          sheetArea.appendChild(renderTab(tab, mode, oldDoc, newDoc));
        });
        buttons.push(b);
        strip.appendChild(b);
      });
      const initialIdx = Math.max(0, tabs.findIndex((t) => t.totalChanges > 0));
      buttons[initialIdx].classList.add("bmd-ods-tab-active");
      sheetArea.appendChild(renderTab(tabs[initialIdx], mode, oldDoc, newDoc));
      root.appendChild(strip);
      root.appendChild(sheetArea);
    } else if (tabs.length === 1) {
      root.appendChild(renderTab(tabs[0], mode, oldDoc, newDoc));
    }

    return root;
  }

  function renderTab(tab, mode, oldDoc, newDoc) {
    if (mode === "sxs") {
      const wrap = document.createElement("div");
      wrap.className = "bmd-ods-sxs";
      const left = document.createElement("div");
      left.className = "bmd-ods-sxs-col bmd-ods-sxs-old";
      const lh = document.createElement("div");
      lh.className = "bmd-sxs-head bmd-sxs-head-old";
      lh.textContent = "Before";
      left.appendChild(lh);
      const right = document.createElement("div");
      right.className = "bmd-ods-sxs-col bmd-ods-sxs-new";
      const rh = document.createElement("div");
      rh.className = "bmd-sxs-head bmd-sxs-head-new";
      rh.textContent = "After";
      right.appendChild(rh);
      const oldStyles = (oldDoc && oldDoc.styles) || {};
      const newStyles = (newDoc && newDoc.styles) || {};
      // For side-by-side, render each column with its own version compared to itself
      // (so cells show values; they're side by side so the diff is visual)
      left.appendChild(renderSheetGrid(tab.oldSheet, tab.oldSheet, oldStyles, oldStyles));
      right.appendChild(renderSheetGrid(tab.newSheet, tab.newSheet, newStyles, newStyles));
      wrap.appendChild(left);
      wrap.appendChild(right);
      return wrap;
    }
    return renderSheetGrid(
      tab.oldSheet,
      tab.newSheet,
      (oldDoc && oldDoc.styles) || {},
      (newDoc && newDoc.styles) || {}
    );
  }

  function errorEl(msg) {
    const e = document.createElement("div");
    e.className = "bmd-error";
    e.textContent = msg;
    return e;
  }

  function makeUnified(oldInput, newInput) {
    return makeView(oldInput, newInput, "unified");
  }
  function makeSideBySide(oldInput, newInput) {
    return makeView(oldInput, newInput, "sxs");
  }

  return { makeUnified, makeSideBySide };
})();
