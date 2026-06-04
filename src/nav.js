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
