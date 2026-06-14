'use strict';
// Shared Playwright readiness state — avoids circular dependency between index.js and trigger.js

let _resolve;
const ready = !process.env.RENDER; // locally always ready

const promise = ready ? Promise.resolve() : new Promise(r => { _resolve = r; });

function setReady() {
  if (_resolve) { _resolve(); _resolve = null; }
}

module.exports = { promise, setReady, isReady: () => ready };
