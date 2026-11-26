// Fake page for test/logic.test.js. Nothing here is shipped.
//
// test/run.sh builds one file from three parts, in this order:
//   1. this file;
//   2. every top-level `const` / `let` declaration cut out of
//      kick-fullscreen-chat.user.js (the IIFE's other statements, which wire
//      up listeners and boot the script, are left out, so nothing starts);
//   3. test/logic.test.js.
//
// Any top-level `function` declared below REPLACES the script's declaration
// of the same name: run.sh leaves that one out. That is how the calls that
// would reach deep into Kick's page (syncControlState and friends) become
// recorders the tests can read.

// ── page globals ───────────────────────────────────────────────────────────

var window = globalThis;
var location = { pathname: '/xqc', origin: 'https://kick.com', href: 'https://kick.com/xqc' };
window.location = location;
window.innerWidth = 1920;

var cssVars = {};
var document = {
  documentElement: {
    getAttribute: () => null,
    style: { setProperty: (name, value) => { cssVars[name] = value; } },
  },
  body: null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
};

class MutationObserver { observe() {} disconnect() {} }

var console = {
  log: () => {},
  warn: () => {},
  error: () => {},
};

// localStorage, with switches to make it throw like private mode does.
var store = {};
var storageThrows = false;
var localStorage = {
  getItem(k) {
    if (storageThrows) throw new Error('storage disabled');
    return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
  },
  setItem(k, v) {
    if (storageThrows) throw new Error('storage disabled');
    store[k] = String(v);
  },
  removeItem(k) { delete store[k]; },
};

// A clock that only moves when a test calls advance().
var clock = 1700000000000;
Date.now = () => clock;
var timers = [];
var timerSeq = 0;
function setTimeout(fn, ms) {
  const id = ++timerSeq;
  timers.push({ id, at: clock + (Number(ms) || 0), fn });
  return id;
}
function clearTimeout(id) { timers = timers.filter((t) => t.id !== id); }
function advance(ms) {
  clock += ms;
  const due = timers.filter((t) => t.at <= clock).sort((a, b) => a.at - b.at || a.id - b.id);
  timers = timers.filter((t) => t.at > clock);
  due.forEach((t) => t.fn());
}

// ── stand-ins for the script's page-touching functions ─────────────────────

var calls = [];
function updateAdMuteWatch() { calls.push('updateAdMuteWatch'); }
function syncControlState() { calls.push('syncControlState'); }
function nudgePlayerResize() { calls.push('nudgePlayerResize'); }
function scheduleLiveResizeLayout() { calls.push('scheduleLiveResizeLayout'); }
