"use strict";

/**
 * ODS parser. Given the bytes of an OpenDocument Spreadsheet, returns
 *   { sheets: [{ name, rows: [[cell,...]] }], styles: { id: { bg, color, ... } } }
 * Each cell is { text, hyperlink, styleId, colSpan, rowSpan, type } or null
 * for empty positions. Trailing empty cells per row are trimmed.
 */
const BMD_ODS = (() => {
  const NS = {
    table: "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    text: "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    office: "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    style: "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
    fo: "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
    xlink: "http://www.w3.org/1999/xlink",
  };

  // Hard upper bound on trailing-empty-cell expansion to avoid the common
  // pattern <table-cell number-columns-repeated="1019"/> blowing up memory.
  const MAX_COL = 64;
  const MAX_ROW_REPEAT = 256;

  async function parse(arrayBuffer) {
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip not loaded");
    }
    const zip = await JSZip.loadAsync(arrayBuffer);
    const contentEntry = zip.file("content.xml");
    if (!contentEntry) throw new Error("ODS: missing content.xml");
    const xml = await contentEntry.async("string");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) {
      throw new Error("ODS: content.xml is not well-formed");
    }
    return {
      sheets: parseSheets(doc),
      styles: parseStyles(doc),
    };
  }

  function parseSheets(doc) {
    const out = [];
    const tables = doc.getElementsByTagNameNS(NS.table, "table");
    for (const table of tables) {
      const name = table.getAttributeNS(NS.table, "name") || "Sheet";
      out.push({ name, rows: parseRows(table) });
    }
    return out;
  }

  function parseRows(table) {
    const rows = [];
    const rowEls = table.getElementsByTagNameNS(NS.table, "table-row");
    for (const rowEl of rowEls) {
      const repeat = clamp(intAttr(rowEl, NS.table, "number-rows-repeated", 1), 1, MAX_ROW_REPEAT);
      const cells = parseRowCells(rowEl);
      if (cells.length === 0) {
        // empty row — still preserve one entry per repeat for positional integrity
        for (let r = 0; r < repeat; r++) rows.push([]);
        continue;
      }
      for (let r = 0; r < repeat; r++) rows.push(cells);
    }
    // Trim trailing empty rows
    while (rows.length && rows[rows.length - 1].every(isEmptyCell)) rows.pop();
    return rows;
  }

  function parseRowCells(rowEl) {
    const cells = [];
    for (const child of rowEl.childNodes) {
      if (child.nodeType !== 1) continue;
      const tag = child.localName;
      if (tag === "covered-table-cell") {
        cells.push(null); // placeholder consumed by a span from earlier cell
        continue;
      }
      if (tag !== "table-cell") continue;
      const repeat = clamp(intAttr(child, NS.table, "number-columns-repeated", 1), 1, MAX_COL);
      const cell = parseCell(child);
      for (let i = 0; i < repeat; i++) cells.push(cell);
      if (cells.length >= MAX_COL) break;
    }
    // Trim trailing empty cells
    while (cells.length && isEmptyCell(cells[cells.length - 1])) cells.pop();
    return cells;
  }

  function parseCell(cellEl) {
    const styleId = cellEl.getAttributeNS(NS.table, "style-name") || null;
    const colSpan = intAttr(cellEl, NS.table, "number-columns-spanned", 1);
    const rowSpan = intAttr(cellEl, NS.table, "number-rows-spanned", 1);
    const valueType =
      cellEl.getAttributeNS(NS.office, "value-type") ||
      cellEl.getAttributeNS(NS.office, "value") ||
      null;
    const officeValue =
      cellEl.getAttributeNS(NS.office, "value") ||
      cellEl.getAttributeNS(NS.office, "date-value") ||
      cellEl.getAttributeNS(NS.office, "time-value") ||
      cellEl.getAttributeNS(NS.office, "boolean-value") ||
      null;

    const paragraphs = cellEl.getElementsByTagNameNS(NS.text, "p");
    let text = "";
    let hyperlink = null;
    if (paragraphs.length) {
      const parts = [];
      for (const p of paragraphs) parts.push(extractText(p));
      text = parts.join("\n").replace(/ /g, " ");
      const a = cellEl.getElementsByTagNameNS(NS.text, "a")[0];
      if (a) {
        const href = a.getAttributeNS(NS.xlink, "href");
        if (href) hyperlink = decodeURIComponent(href);
      }
    }
    if (!text && officeValue) text = officeValue;

    if (!text && !hyperlink && !styleId && colSpan === 1 && rowSpan === 1) {
      return null;
    }
    return { text, hyperlink, styleId, colSpan, rowSpan, type: valueType };
  }

  function extractText(node) {
    if (node.nodeType === 3) return node.data;
    if (node.nodeType !== 1) return "";
    if (node.localName === "s") {
      const c = intAttr(node, NS.text, "c", 1);
      return " ".repeat(c);
    }
    if (node.localName === "tab") return "\t";
    if (node.localName === "line-break") return "\n";
    let s = "";
    for (const c of node.childNodes) s += extractText(c);
    return s;
  }

  function parseStyles(doc) {
    const out = {};
    const autoStyles = doc.getElementsByTagNameNS(NS.office, "automatic-styles")[0];
    if (!autoStyles) return out;
    const styleEls = autoStyles.getElementsByTagNameNS(NS.style, "style");
    for (const s of styleEls) {
      const family = s.getAttributeNS(NS.style, "family");
      if (family !== "table-cell") continue;
      const name = s.getAttributeNS(NS.style, "name");
      if (!name) continue;
      const cellProps = s.getElementsByTagNameNS(NS.style, "table-cell-properties")[0];
      const textProps = s.getElementsByTagNameNS(NS.style, "text-properties")[0];
      const paraProps = s.getElementsByTagNameNS(NS.style, "paragraph-properties")[0];
      out[name] = {
        bg: cellProps && cellProps.getAttributeNS(NS.fo, "background-color"),
        color: textProps && textProps.getAttributeNS(NS.fo, "color"),
        fontWeight: textProps && textProps.getAttributeNS(NS.fo, "font-weight"),
        fontStyle: textProps && textProps.getAttributeNS(NS.fo, "font-style"),
        fontSize: textProps && textProps.getAttributeNS(NS.fo, "font-size"),
        textAlign: paraProps && paraProps.getAttributeNS(NS.fo, "text-align"),
        border:
          cellProps &&
          (cellProps.getAttributeNS(NS.fo, "border") ||
            cellProps.getAttributeNS(NS.fo, "border-top") ||
            cellProps.getAttributeNS(NS.fo, "border-bottom") ||
            cellProps.getAttributeNS(NS.fo, "border-left") ||
            cellProps.getAttributeNS(NS.fo, "border-right")),
      };
    }
    return out;
  }

  function isEmptyCell(c) {
    return !c || (!c.text && !c.hyperlink && !c.styleId);
  }

  function intAttr(el, ns, name, def) {
    const v = el.getAttributeNS(ns, name);
    if (!v) return def;
    const n = parseInt(v, 10);
    return isFinite(n) ? n : def;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  return { parse, _internal: { isEmptyCell } };
})();
