// Behaviour tests for the script's own logic, run by test/run.sh (never on its
// own — see test/env.js for how the file is put together). They call the very
// code that ships: settings validation, saving and loading, the cross-tab
// settings merge, chat-width clamping, the page and button text matchers, and
// the recent-errors log.
//
// What they can't tell you: anything about Kick's real markup, the player, or
// fullscreen. The manual tests in AGENTS.md still cover those.

const say = typeof print === 'function' ? print : console.log;
let failures = 0;
let passed = 0;

function check(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) { passed++; return; }
  failures++;
  say(`FAIL ${name}: got ${g}, want ${w}`);
}

function table(fnName, fn, cases) {
  for (const [args, want] of cases) {
    check(`${fnName}(${args.map((a) => JSON.stringify(a)).join(', ')})`, fn(...args), want);
  }
}

// ── settings state ─────────────────────────────────────────────────────────

// Every persisted setting, by the name saveSettings writes it under.
const settings = () => ({
  chatWidth, chatSide, overlayOpacity, autoHideOverlayChat, autoHideControls,
  openChatAsOverlay, restoreChatOnFullscreen, idleDelayMs, muteAds, infoHidden,
  infoBgOpacity, infoShowActions, infoShowTags, debug: debugOn,
});
const DEFAULTS = settings();
const NON_DEFAULTS = {
  chatWidth: 520, chatSide: 'left', overlayOpacity: 80, autoHideOverlayChat: false,
  autoHideControls: false, openChatAsOverlay: true, restoreChatOnFullscreen: false,
  idleDelayMs: 7000, muteAds: true, infoHidden: true, infoBgOpacity: 20,
  infoShowActions: false, infoShowTags: false, debug: true,
};
const reset = () => {
  chatWidth = DEFAULTS.chatWidth;
  chatSide = DEFAULTS.chatSide;
  overlayOpacity = DEFAULTS.overlayOpacity;
  autoHideOverlayChat = DEFAULTS.autoHideOverlayChat;
  autoHideControls = DEFAULTS.autoHideControls;
  openChatAsOverlay = DEFAULTS.openChatAsOverlay;
  restoreChatOnFullscreen = DEFAULTS.restoreChatOnFullscreen;
  idleDelayMs = DEFAULTS.idleDelayMs;
  muteAds = DEFAULTS.muteAds;
  infoHidden = DEFAULTS.infoHidden;
  infoBgOpacity = DEFAULTS.infoBgOpacity;
  infoShowActions = DEFAULTS.infoShowActions;
  infoShowTags = DEFAULTS.infoShowTags;
  debugOn = DEFAULTS.debug;
  active = false;
  store = {};
  storageThrows = false;
  calls = [];
  cssVars = {};
  flushSettings();
  store = {};
};
const after = (patch) => { reset(); applySettings(patch); return settings(); };
const field = (key) => (patch) => after(patch)[key];

check('defaults', DEFAULTS, {
  chatWidth: 340, chatSide: 'right', overlayOpacity: 55, autoHideOverlayChat: true,
  autoHideControls: true, openChatAsOverlay: false, restoreChatOnFullscreen: true,
  idleDelayMs: 4000, muteAds: false, infoHidden: false, infoBgOpacity: 60,
  infoShowActions: true, infoShowTags: true, debug: false,
});

// ── applySettings: validation ──────────────────────────────────────────────

for (const bad of [null, undefined, 'x', 42, true, [], {}]) {
  check(`applySettings(${JSON.stringify(bad)}) changes nothing`, after(bad), DEFAULTS);
}
check('every valid field applies', after(NON_DEFAULTS), NON_DEFAULTS);
check('a partial object changes only its fields',
  after({ muteAds: true }), Object.assign({}, DEFAULTS, { muteAds: true }));

// Wrong types leave the current value alone.
check('wrong types change nothing', after({
  chatWidth: '520', chatSide: 'top', overlayOpacity: '80', autoHideOverlayChat: 'false',
  autoHideControls: 0, openChatAsOverlay: 1, restoreChatOnFullscreen: null,
  idleDelayMs: '7000', muteAds: 'yes', infoHidden: {}, infoBgOpacity: [20],
  infoShowActions: 'no', infoShowTags: null, debug: 'on',
}), DEFAULTS);

// chatWidth: static bounds only, never the viewport (see applySettings).
table('chatWidth', field('chatWidth'), [
  [[{ chatWidth: 500 }], 500],
  [[{ chatWidth: 100 }], 260],
  [[{ chatWidth: 5000 }], 640],
  [[{ chatWidth: NaN }], 340],
  [[{ chatWidth: Infinity }], 340],
  [[{ chatWidth: -Infinity }], 340],
]);
// A wide saved width survives a narrow window at load (0.x regression the
// applySettings comment describes: 640 in a 700px window became 420).
window.innerWidth = 700;
check('chatWidth ignores a narrow viewport at load', field('chatWidth')({ chatWidth: 640 }), 640);
window.innerWidth = 1920;

table('chatSide', field('chatSide'), [
  [[{ chatSide: 'left' }], 'left'],
  [[{ chatSide: 'right' }], 'right'],
  [[{ chatSide: 'LEFT' }], 'right'],
  [[{ chatSide: '' }], 'right'],
]);
table('overlayOpacity', field('overlayOpacity'), [
  [[{ overlayOpacity: 40 }], 40],
  [[{ overlayOpacity: 0 }], 25],
  [[{ overlayOpacity: 100 }], 90],
  // JSON.parse turns 1e999 into Infinity; it clamps rather than leaks through.
  [[{ overlayOpacity: JSON.parse('1e999') }], 90],
]);
table('idleDelayMs', field('idleDelayMs'), [
  [[{ idleDelayMs: 3000 }], 3000],
  [[{ idleDelayMs: 0 }], 2000],
  [[{ idleDelayMs: 60000 }], 8000],
]);
table('infoBgOpacity', field('infoBgOpacity'), [
  [[{ infoBgOpacity: 0 }], 0],
  [[{ infoBgOpacity: -5 }], 0],
  [[{ infoBgOpacity: 95 }], 90],
]);

// ── saving and loading ─────────────────────────────────────────────────────

reset();
applySettings(NON_DEFAULTS);
saveSettings();
check('saveSettings writes every setting', JSON.parse(store[SETTINGS_KEY]), NON_DEFAULTS);
{
  const saved = store[SETTINGS_KEY];
  reset();
  store[SETTINGS_KEY] = saved;
  loadSettings();
  check('save → load round-trips every setting', settings(), NON_DEFAULTS);
}

reset();
loadSettings();
check('loadSettings with nothing saved changes nothing', settings(), DEFAULTS);

reset();
store[SETTINGS_KEY] = '{"chatWidth": 500,';
loadSettings();
check('loadSettings with corrupt JSON changes nothing', settings(), DEFAULTS);

reset();
store[SETTINGS_KEY] = 'null';
loadSettings();
check('loadSettings with a saved null changes nothing', settings(), DEFAULTS);

reset();
store[SETTINGS_KEY] = JSON.stringify(NON_DEFAULTS);
storageThrows = true;
let threw = false;
try { loadSettings(); saveSettings(); persistSettings(); flushSettings(); } catch (_) { threw = true; }
check('disabled storage never throws', threw, false);
check('disabled storage changes nothing', settings(), DEFAULTS);

// persistSettings: one write 300 ms after the first call, however many calls.
reset();
let writes = 0;
{
  const setItem = localStorage.setItem;
  localStorage.setItem = function (k, v) { writes++; return setItem.call(this, k, v); };
  chatWidth = 400; persistSettings();
  chatWidth = 410; persistSettings();
  chatWidth = 420; persistSettings();
  advance(299);
  check('persistSettings waits 300 ms', writes, 0);
  advance(1);
  check('persistSettings writes once', writes, 1);
  check('persistSettings writes the latest value', JSON.parse(store[SETTINGS_KEY]).chatWidth, 420);

  // flushSettings writes a pending save now, and only once.
  writes = 0;
  muteAds = true; persistSettings();
  flushSettings();
  check('flushSettings writes immediately', writes, 1);
  check('flushSettings wrote the pending change', JSON.parse(store[SETTINGS_KEY]).muteAds, true);
  advance(1000);
  check('flushSettings cancels the timer', writes, 1);
  flushSettings();
  check('flushSettings with nothing pending writes nothing', writes, 1);
  localStorage.setItem = setItem;
}

// ── another tab's change (onSettingsStorage) ───────────────────────────────

const storageEvent = (oldValue, newValue, key = SETTINGS_KEY) => ({
  key,
  oldValue: oldValue === null ? null : JSON.stringify(oldValue),
  newValue: newValue === null ? null : JSON.stringify(newValue),
});

reset();
onSettingsStorage(storageEvent({}, NON_DEFAULTS, 'some-other-key'));
check('other storage keys are ignored', [settings(), calls], [DEFAULTS, []]);
onSettingsStorage(storageEvent({}, null));
check('a removed key is ignored', [settings(), calls], [DEFAULTS, []]);
onSettingsStorage({ key: SETTINGS_KEY, oldValue: null, newValue: '{oops' });
check('a corrupt value is ignored', [settings(), calls], [DEFAULTS, []]);
onSettingsStorage(storageEvent(DEFAULTS, DEFAULTS));
check('an unchanged value does nothing', calls, []);

// The case onSettingsStorage exists for: this tab widened the chat (save still
// pending), another tab flipped a switch. Only the switch comes across.
reset();
chatWidth = 520;
onSettingsStorage(storageEvent(
  Object.assign({}, DEFAULTS, { muteAds: false }),
  Object.assign({}, DEFAULTS, { muteAds: true }),
));
check('only the changed field is applied', [chatWidth, muteAds], [520, true]);
check('the page is refreshed', calls, ['updateAdMuteWatch', 'syncControlState']);
check('the chat width CSS variable is reapplied', cssVars['--kfc-chat-width'], '520px');

reset();
active = true;
onSettingsStorage(storageEvent(DEFAULTS, Object.assign({}, DEFAULTS, { chatWidth: 600 })));
check('a width change from another tab applies', chatWidth, 600);
check('the player is nudged while side chat is open', calls.includes('nudgePlayerResize'), true);

// No old value (first save ever in the other tab): everything is new.
reset();
onSettingsStorage(storageEvent(null, NON_DEFAULTS));
check('no old value applies everything', settings(), NON_DEFAULTS);

// Invalid values from another tab are validated like a load.
reset();
onSettingsStorage(storageEvent(DEFAULTS, Object.assign({}, DEFAULTS, { chatWidth: 9999, chatSide: 'top' })));
check('another tab\'s values are validated', [chatWidth, chatSide], [640, 'right']);
reset();

// ── chat width clamping ────────────────────────────────────────────────────

table('clampChatWidth', clampChatWidth, [
  [[400, 1920], 400],
  [[100, 1920], 260],
  [[900, 1920], 640],
  // 60% of the viewport caps it…
  [[500, 600], 360],
  // …but never below the minimum.
  [[500, 300], 260],
]);
window.innerWidth = 800;
check('clampChatWidth reads the window by default', clampChatWidth(600), 480);
window.innerWidth = 1920;

// ── page and text matchers ─────────────────────────────────────────────────

const atPath = (fn) => (pathname) => { location.pathname = pathname; return fn(); };
table('getCurrentChannelPath', atPath(getCurrentChannelPath), [
  [['/xqc'], '/xqc'],
  [['/xqc/'], '/xqc'],
  [['/xqc/videos/abc-123'], '/xqc'],
  [['/'], null],
  [[''], null],
  [['/favicon.ico'], null],
]);
table('isRecordingPage', atPath(isRecordingPage), [
  [['/xqc/videos/abc-123'], true],
  [['/xqc/clips/clip_01ABC'], true],
  [['/xqc'], false],
  [['/xqc/videos'], false],
  [['/xqc/about'], false],
]);
location.pathname = '/xqc';

table('VIEWER_COUNT_RE', (t) => VIEWER_COUNT_RE.test(t), [
  [['770 Viewers'], true],
  [['1 viewer'], true],
  [['1,250 viewers'], true],
  [['1.250 Zuschauer'], true],
  [['1 234 sledujících'], true],
  [['12 diváků'], true],
  [['3 412 зрителей'], true],
  [['88 spectateurs'], true],
  [['770 viewership'], false],
  [['Viewers'], false],
  [['770'], false],
]);

table('QUALITY_OPTION_RE', (t) => QUALITY_OPTION_RE.test(t), [
  [['Auto'], true],
  [['source'], true],
  [['Original'], true],
  [['1080p60'], true],
  [['1080p 60'], true],
  [['720p'], true],
  [['160p'], true],
  [['Autoplay'], false],
  [['1080p60fps'], false],
  [['5p'], false],
  [['Quality'], false],
]);

table('GO_LIVE_RE', (t) => GO_LIVE_RE.test(t), [
  [['Go to live'], true],
  [['Jump to Live'], true],
  [['back to live'], true],
  [['Skip to live'], true],
  [['GoLive'], true],
  [['Live'], false],
  [['Go to live now'], false],
]);

// ── recent page errors ─────────────────────────────────────────────────────

table('clip', clip, [
  [['abc', 5], 'abc'],
  [['abcde', 5], 'abcde'],
  [['abcdef', 5], 'abcde…'],
]);

const circular = {};
circular.self = circular;
table('describeErrorValue', describeErrorValue, [
  [[new TypeError('x is undefined')], 'TypeError: x is undefined'],
  [['plain text'], 'plain text'],
  [[{ a: 1 }], '{"a":1}'],
  [[42], '42'],
  [[null], 'null'],
  [[undefined], 'undefined'],
]);
check('describeErrorValue(circular object)', describeErrorValue(circular), '[object Object]');

recentErrors.length = 0;
clock = 1700000000000;
const boom = new Error('boom');
recordError('error', ['Uncaught', boom]);
advance(2500);
{
  const [entry] = formatRecentErrors();
  check('recorded error source', entry.source, 'error');
  check('recorded error message joins every value', entry.message, 'Uncaught Error: boom');
  check('recorded error keeps the stack', entry.stack, String(boom.stack || ''));
  check('recorded error age', entry.ago, '2.5s');
}

recentErrors.length = 0;
recordError('console.error', ['x'.repeat(2000)]);
check('long messages are clipped', recentErrors[0].message.length, ERROR_TEXT_MAX + 1);

recentErrors.length = 0;
for (let i = 1; i <= RECENT_ERRORS_MAX + 5; i++) recordError('error', [`e${i}`]);
check('the log keeps the newest entries', recentErrors.length, RECENT_ERRORS_MAX);
check('the oldest entries go first',
  [recentErrors[0].message, recentErrors[RECENT_ERRORS_MAX - 1].message],
  ['e6', `e${RECENT_ERRORS_MAX + 5}`]);

recentErrors.length = 0;
let recordThrew = false;
try { recordError('error', null); } catch (_) { recordThrew = true; }
check('recordError never throws', recordThrew, false);

say(`${passed} passed, ${failures} failed`);
if (failures) throw new Error(`${failures} logic test(s) failed`);
say('all logic tests passed');
