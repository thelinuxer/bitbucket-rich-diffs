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
