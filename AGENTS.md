# Kick Fullscreen Chat — Agent Context

Browser userscript that adds a Twitch-style side-by-side fullscreen-with-chat mode to Kick.com.

This file is the map and the rules. **The reasoning behind a rule lives next to the code it guards** (the comments in `kick-fullscreen-chat.user.js`), and **the history of each fix lives in `CHANGELOG.md`** — read the relevant entry before changing anything a rule here protects. Many rules below look like simplifications waiting to happen; each one is there because the simpler version shipped and broke.

## Project Overview

**Type:** Single-file JavaScript userscript  
**Primary file:** `kick-fullscreen-chat.user.js`  
**Install docs:** `INSTALL.md`  
**Target:** Any userscript manager (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) on any browser; developed and tested on Safari + Userscripts  
**Git:** `git@github.com:jakubn11/kick-fullscreen-chat.git` (default branch: `main`).

## Commands

There is no package manager, build step, linter, or automated test suite configured.

- Syntax check: `node --check kick-fullscreen-chat.user.js`. Without Node installed, macOS ships a JavaScript engine that can parse-check without executing (the file is an IIFE, so it must not be *run* to be checked):
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -e 'try { new Function(readFile("kick-fullscreen-chat.user.js")); print("syntax OK"); } catch (e) { print("SYNTAX ERROR: " + e); }'`
- No build step — the `.user.js` is shipped as-is.

Useful local checks:

```bash
sed -n '1,80p' kick-fullscreen-chat.user.js
wc -l kick-fullscreen-chat.user.js INSTALL.md
```

## Userscript Metadata

The userscript header controls permissions and host access. Keep it valid across all common userscript managers (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other):

- `@match` should remain scoped to `https://kick.com/*` unless the target changes.
- `@grant none` — this userscript does not need any GM_* APIs. Do not add grants unless a feature actually requires one.
- `@updateURL` / `@downloadURL` point at the `main` branch on GitHub. If the repo or branch moves, update both.
- Bump `@version` when changing user-facing behavior or DOM logic. The `VERSION` constant near the top of the IIFE must be bumped to the **same** string in the same commit — it is what `KickFullscreenChat.version` reports.

Do not add `Co-Authored-By:` trailers to git commits.

## Implementation Map

`kick-fullscreen-chat.user.js` is organized into these areas:

- **Userscript metadata header**
- **Single-instance guard** (0.21.8) — first thing in the IIFE. Marks `<html>` with `data-kfc-running="<version>"`; a later copy `console.warn`s naming both versions and `return`s. First instance wins. Two copies would adopt each other's fixed-id nodes and fight over them. The marker is a DOM attribute, not a `window` property, because managers disagree on whether userscripts share a JS context but always share the DOM.
- **Constants** — element IDs (`BTN_ID`, `WRAP_ID`, `STYLE_ID`, …), `CHAT_WIDTH` and its bounds, and the inlined control SVGs (`BTN_SVG`, `MODE_SVG`, `INFO_SVG`, `SETTINGS_SVG`).
- **Fragile DOM selectors** — `VIDEO_WRAPPER_SELECTORS`, `CHAT_SELECTORS`, `STREAMER_INFO_SELECTORS`, `VIEWER_COUNT_SELECTORS` (see DOM And Routing Notes).
- **Chat discovery** — `pick()`, `findChatByInput()`, `findChat()`.
- **Kick state helpers** — `setKickDataChat()` toggles the `data-chat` attribute Kick uses to drive chat visibility via Tailwind `group-data-[chat=false]/main` rules.
- **Style injection** — `injectStyles()`: the `[data-kfc-video-root]` shrink rules, chat-slot positioning, control/panel styling.
- **Split-layout state** — `savedChatParent`, `savedChatNextSibling`, `chatSlot`, `videoRoots`, `videoOverlays`, `videoFrames`, `markedVideos`, `videoRootHost`, `videoRootObserver`, `active`, `suppressObserver`.
- **Player-layer marking** — `refreshVideoRoots()` marks fsEl's full-coverage children as `[data-kfc-video-root]` (shrink + `translateZ` containing block); `refreshVideoFrames()` marks the video's ancestor chain inside them as `[data-kfc-video-frame]` and the videos as `[data-kfc-video-el]`; `refreshVideoOverlays()` (0.21.10) marks full-coverage children with **no controls** (Kick's transient loading / blur overlays) as `[data-kfc-video-overlay]`. Overlays get width and `--kfc-video-shift` **only** — no height, no `overflow: hidden`, no restacking (the full root treatment made them hit targets above the timeline in 0.9.7; no sizing at all centred the buffering spinner on the screen instead of the video). `clearVideoRoots()` unmarks all four.
- **Reload-resilience state** — `videoReloading`, `videoReadyTimer`, `fullscreenVideoEl`, `videoSwapObserver`, `pendingVideoEl` (see Reload-Resilience Notes).
- **Capture-phase teardown handlers** — `onDocClickCapture` (quality / seekbar / go-live), `onDocPointerDownCapture` (seekbar), `onDocChatToggleClickCapture` (Kick's chat-toggle buttons, by `CHAT_TOGGLE_RE` text/aria/title or `looksLikeChatToggleBtn` icon signature). **Kick has two toggle buttons**, both always in the DOM (the inactive one is 0×0 or off-screen): floating **Show chat** (`KICK_SHOW_CHAT_PATH_SIG`) and **Hide chat** in the chat header (`KICK_HIDE_CHAT_PATH_SIG`). `looksLikeChatToggleBtn` matches either (detection doesn't care about direction). `findKickShowChatBtn()` matches the show direction **only** (icon + the narrower `SHOW_CHAT_RE`), because it *clicks* what it finds.
- **Player gestures** — `onFsClick` (click → **resume only**, 0.21.10) and `onFsDblClick` (double-click → exit fullscreen, 0.9.9), bound to fsEl in `enableSideChat()`. They exist because the side layout sets `pointer-events: none` on the marked video so clicks reach Kick's controls, which also means Kick's own `<video>` handlers never fire; if that rule is ever revisited, these depend on it. Both go through `isVideoSurfaceTarget(target)`: not ours (`isKfcOwnedNode`), not interactive (`button, [role="button"], [role="slider"], a, input, textarea, select, [contenteditable]`), not the seekbar (that click belongs to teardown). Both ignore untrusted events (`onFsDblClick` since 0.21.13); `onFsClick` also requires `e.detail >= 1`.
  - **The click is deliberately one-way** (`canResumeByClick()`): resumes a paused stream, does nothing to a playing one. Don't "restore" Kick's toggle without being asked.
  - **The cursor follows the same two conditions.** `applySurfaceCursor()` runs from `onFsMouseMove` on trusted moves while `active`; `refreshSurfaceCursor()` sets an inline `cursor: pointer !important` on `hoverTarget` only while `isVideoSurfaceTarget` **and** `canResumeByClick()` hold; the video's `play`/`pause` re-run it; `resetSurfaceCursor()` on teardown. A CSS rule on the marked layers doesn't work (inherited cursors lose to Kick's explicit ones, and it painted a hand while playing). `onFsMouseMove()` is also called with no event from many places — hence the `else if (e)`, so those calls don't strip the cursor.
- **Layout toggle** — `enableSideChat()`, `disableSideChat()`.
- **Buttons / controls** — `ensureButton()` builds `#kfc-toggle-wrap` (flex row): info toggle (`#kfc-info-btn`), layout-mode toggle (`#kfc-mode-btn`), settings gear (`#kfc-settings-btn`), **Chat** (`#kfc-toggle-btn`), plus `#kfc-settings-panel`. `removeButton()` removes the wrap **and `#kfc-toast` with its fade timer** (0.21.11 — the toast is parented to the fullscreen element and was otherwise stranded in Kick's React subtree). `updateBtnLabel()` (Chat label + disabled state; per-button show/hide is CSS), `syncControlState()` (reflects prefs onto our nodes, CSS vars and panel inputs), `toggleOverlayMode()`, `toggleInfoOverlay()`, `toggleSettingsPanel()`.
  - **`wireControlButton(btn, onActivate)`** — all four buttons go through it. It swallows the click from the player, rejects **untrusted** clicks outright (0.21.9 — a script-dispatched click has `detail === 0` and would otherwise pass as a keyboard activation; kick-quality-saver was clicking our gear this way), `blur()`s on `pointerdown` (deferred a task) and on pointer `click` (`if (e.detail)`) while keyboard activations keep focus, then asks `controlsAcceptActivation()`.
  - **Refocus guard — `controlsAcceptActivation({ pointer, consume })`** stops the click that re-activates the window (or a later click with the pointer still parked) from landing on a control. It has **two halves, and both are needed** — don't merge them, and a longer timeout is not a substitute:
    - *Untimed:* `pointerParked`, set in `onWindowLeft`, cleared only by a trusted `pointermove` (window, capture) or a non-mouse `pointerdown`. While set, pointer activations are rejected; the rejected activation consumes it (`consume`) so the retry works. `consume` is **false** for the panel's `pointerdown` check, or the click behind it walks through. Keyboard activations pass `pointer: false`.
    - *Timed:* reject while `< CONTROLS_FOCUS_GUARD_MS` (350ms) since `focusRegainedAt`, or while `reactivationPending` is latched and the guard hasn't been seen to expire. **Latch on the way out, never on the way in** (0.21.5): `reactivationPending` is set from `window` `blur` / `visibilitychange` hidden, because the focus event and the reactivating click race. `focusRegainedAt` is stamped by the return event or, failing that, by `controlsAcceptActivation()` via `document.hasFocus()`.
    - **Anything that must not fire on a refocus click goes through this function** — don't add a second timing window. `onWindowLeft` also `blur()`s any focused control of ours, since the browser would restore that focus on return.
  - **The settings panel** applies the same guard itself, in **capture** on both `pointerdown` and `click` (a slider jumps on the press). **Do not add the `isTrusted` rejection there** — clicking a switch's label row reaches the checkbox as a browser-forwarded click.
  - **Every panel control blurs on pointer activation** via `blurOnPointerActivate(el, focusTarget?)` (the panel floats over the player; a focused control eats Space/Enter and arrow keys). For switches it is bound to the **label**, not the input. New panel controls must use it.
  - **aria-labels are a contract, not cosmetics.** Every control label must contain "chat" (kick-quality-saver skips `[aria-label*="chat" i]` when hunting for Kick's gear), and "chat" must **not** directly follow the leading verb (`CHAT_TOGGLE_RE` / `SHOW_CHAT_RE` match `open|close|…` + "chat", so "Open chat settings" would be mistaken for Kick's toggle). Current: "Open/Close fullscreen chat settings".
- **UI prefs** — `chatWidth` (px), `chatSide` (`'right'`/`'left'`), `overlayMode` (derived from `openChatAsOverlay` on each open — not persisted), `infoHidden`, `infoBgOpacity` (0–90%), `overlayOpacity` (25–90%), `autoHideOverlayChat`, `autoHideControls`, `openChatAsOverlay`, `restoreChatOnFullscreen`, `idleDelayMs` (2–8s), `debugOn` (`KickFullscreenChat.debug()`). Persisted to one `localStorage` key (`kfc-settings`) via `saveSettings()` / `persistSettings()` (debounced 300ms); read at startup by `loadSettings()`, validated by `applySettings()`. Persist on every settings mutation; `resetSessionSettings()` restores defaults and re-saves.
  - **Load does not call `clampChatWidth()`** (0.21.11): its 60%-of-viewport term would measure the *windowed* viewport, and the clamped value is written back by the next save, permanently shrinking the width. Load applies the static 260–640 bounds (guarded by `Number.isFinite`); the viewport term stays in `setChatWidth()`. Don't "tidy" these into one call.
  - **Cross-tab** (0.21.12): every tab saves the whole blob from memory, so `onSettingsStorage` (a `storage` listener) applies another tab's save through `applySettings()` and refreshes the CSS vars and panel. It applies only fields that differ between `oldValue` and `newValue`, so this tab's change still waiting on its debounce survives. `flushSettings()` on `pagehide` writes out a pending save.
- **Chat dock side** — `chatSide`. `syncControlState()` toggles `html.kfc-chat-left` (flips `.kfc-chat-slot` and `#kfc-resize-handle` via CSS) and sets three `documentElement` vars that reference `--kfc-chat-width` so they track live resize: `--kfc-video-shift` (side mode — shift the shrunken player right of the chat), `--kfc-control-shift` (overlay mode — shift the controls row clear of the floating chat), `--kfc-info-offset` (push the info overlay right of the chat). All removed when docked right. `onResizePointerMove` measures from the left edge when docked left.
- **Chat-width resize** — `applyChatWidth()` (writes `--kfc-chat-width`), `clampChatWidth(px, viewportWidth?)` (260–640px, ≤60vw — drags, chips and reset, not load), `mountResizeHandle()` / `removeResizeHandle()`, `onResizePointerDown/Move/Up`. **Smoothness:** moves only store the pointer X and schedule one rAF (`resizeMoveFrame` → `applyResizeFromPointer`); the viewport width is snapshotted at pointerdown (`resizeViewportWidth`) so the per-frame update never reads layout; `scheduleLiveResizeLayout()` early-returns while `resizing`, deferring the heavy relayout to `nudgePlayerResize()` on release. **Drag-to-close:** a *raw* (unclamped) width below `CHAT_WIDTH_CLOSE_THRESHOLD` (180px) arms `resizePendingClose` and dims the slot (`.kfc-pending-close`; the divider stays untinted); releasing on `pointerup` (not `pointercancel`) while armed calls `disableSideChat()`. Double-click on the divider resets to `CHAT_WIDTH`.
- **Overlay chat mode** — video keeps full width (`--kfc-video-width: 100%`) and `.kfc-overlay` on the slot floats it translucently. Toggled by `#kfc-mode-btn`, only meaningful while `active`.
- **Info overlay** — `findStreamerInfoSource()`, `findViewerCountSource()`, `mountInfoOverlay()`, `unmountInfoOverlay()`, `recloneInfoOverlay()`, `scheduleInfoReclone()`, `refindInfoSources()`, `startInfoSourceWatcher()` / `stopInfoSourceWatcher()`. Clones Kick's channel-info card and viewer-count badge into fsEl. State: `infoOverlay`, `infoOverlaySource`, `infoOverlayObserver`, `infoViewerSource`, `infoViewerObserver`, `infoBodyObserver`, `infoOverlayPending`, `infoBodyCheckPending`. Fades with the `kfc-idle` class. A body-level observer re-attaches the per-source observers when Kick re-mounts the sources.
- **Idle auto-hide** — `startIdleTracking()`, `stopIdleTracking()`, `onFsMouseMove()`, `setIdle()`, `idleDelayMs` — fades `#kfc-toggle-wrap` and `#kfc-info-overlay` via `.kfc-idle` (`opacity: 0; pointer-events: none`). **The cluster must not be clickable while invisible:** `pointer-events` flips instantly when `.kfc-idle` drops but opacity fades for .2s, so `setIdle()` adds `.kfc-unarmed` on the idle→visible transition **only** and clears it after `CONTROLS_FADE_MS`. `CONTROLS_FADE_MS` must match the wrap's opacity transition, and arming on every mousemove would make the buttons permanently unclickable. This guard and the refocus guard each cover cases the other can't (a faded cluster vs. a visible one).
  - **Debugging "the panel opens by itself":** before attributing it to any guard, wrap `DOMTokenList.prototype.toggle` and log `new Error().stack` whenever the token is `kfc-settings-open`. That is what found the real cause in 0.21.9 after 0.21.8 reasoned its way to the wrong one. (A MutationObserver can't do this — its callback runs after the writer's stack is gone.)
- **Video monitor** — `startVideoLoadingMonitor()`, `stopVideoLoadingMonitor()`, `attachVideoListeners()`, `detachVideoListeners()`.
- **Popover portal** — `startPopoverPortal()`, `stopPopoverPortal()`, `adoptPopover()`, `reconcilePopoverClones()`, `removePopoverClone()`. While side chat is active, **clones** body-portaled popovers (emote tooltips etc.) into fsEl so the Fullscreen API shows them. **Never move the original**: React's portal unmount calls `body.removeChild(popover)`, which throws on a moved node and trips Kick's 404 error boundary. A per-popover observer re-clones on `childList` / `characterData` (not attributes). State: `popoverClones`, `popoverSyncObservers` (Maps keyed by the original).
- **Chat error recovery** — `startChatErrorWatcher()` / `stopChatErrorWatcher()` watch `.kfc-chat-slot` for Kick's error-boundary text (`CHAT_ERROR_RE`), coalesced to one scan per frame (`chatErrorCheckScheduled`). On a match: toast, disconnect, `disableSideChat()` so the chat goes back where Kick expects it. `chatErrorRecovering` guards re-entrance.
- **Observers and listeners** — `dataChatObserver`, `videoSwapObserver`, `popoverPortalObserver`, `chatErrorObserver`, `kickControlsObserver`, the `storage` / `pagehide` settings listeners, and the `fullscreenchange` / `webkitfullscreenchange` handlers.

The central state that drives the split layout is:

```js
let active = false;             // split layout currently mounted
let videoReloading = false;     // player is reloading; Chat button must stay disabled
let savedChatParent = null;     // where to put chat back on teardown
let savedChatNextSibling = null;
let chatSlot = null;            // .kfc-chat-slot we created
let videoRoots = [];            // fsEl children currently tagged data-kfc-video-root
let videoRootHost = null;       // the fsEl those markers are on
let videoRootObserver = null;   // MutationObserver re-marking after Kick swaps layers
```

The core idea: when the user activates the side chat, the chat node is **moved** into a new `.kfc-chat-slot` (`position: fixed` on the right, or the left per `chatSide`) inside the fullscreen element. Kick's player nodes stay parented to `fsEl` — they are not moved. Instead, the script tags the full-coverage direct children of `fsEl` with `data-kfc-video-root`, and CSS shrinks them to `calc(100% - var(--kfc-chat-width))` while `transform: translateZ(0)` makes each marked element a containing block for its `position: fixed/absolute` descendants. On tear-down, the chat node is restored to its original parent (and original `nextSibling` if still present); the markers and chat slot are removed.

This in-place marker design replaced the older `.kfc-video-slot` wrapper (0.9.1 and earlier): wrapping `fsEl`'s children made React's reconciler throw on background refreshes, and Kick's error boundary navigated to its 404 page. **Never re-parent Kick's player nodes.**

## External APIs

None. This userscript does not perform any network requests and does not depend on third-party services. All work is DOM manipulation inside the Kick page.

## DOM And Routing Notes

Kick is a single-page app and may change class names. The fragile selectors live near the top of the userscript:

- `VIDEO_WRAPPER_SELECTORS` — candidates for the fullscreened player container (`#injected-channel-player`, `[data-testid="player"]`, etc.)
- `CHAT_SELECTORS` — candidates for the chat panel (`#chatroom`, `[data-testid="chatroom"]`, etc.)
- `STREAMER_INFO_SELECTORS` — candidates for Kick's channel-info card cloned into the info overlay.
- `VIEWER_COUNT_SELECTORS` / `VIEWER_COUNT_RE` — the viewer-count badge; `VIEWER_COUNT_RE` is the content-based fallback ("770 Viewers"). Its trailing guard is `(?!\p{L})` under `/u`, **not** `\b` — outside `/u`, `\w` is ASCII-only, so `\b` after a non-ASCII token never matches (0.20.3). Verify any new localised token against a real string.

**Prefer adding fallback selectors (at the end) to replacing working ones.** `findChat()` already falls back to walking up from a chat input whose placeholder matches `chat|message|send a message` — extend that heuristic before resorting to class-name matching.

`data-chat` is the attribute Kick uses on a player ancestor to drive chat visibility (`group-data-[chat=false]/main:*`). The script:

1. Sets `data-chat="true"` when entering the split layout, so Kick's CSS doesn't hide the moved chat. If Kick's state says hidden, it first clicks Kick's **Show chat** button (`findKickShowChatBtn()`) so React agrees, and opens a 500ms reconcile guard (`enableSyncUntil`) during which a `"false"` is re-asserted instead of tearing down.
2. Observes `data-chat` and tears down when Kick sets it to `"false"` (Kick's native **Hide chat**).
3. Raises `suppressObserver` around its own writes so they don't re-trigger the observer.

**The `data-chat` observer is not sufficient on its own; `onDocChatToggleClickCapture` is not an optimisation.** Because step 1 forces the attribute, React can be left believing chat is hidden; the user's first hide click then drives React *towards* shown, and the observer (which only acts on `"false"`) does nothing. The capture handler tears down on the click itself. A stale icon signature there shows up as "closing the chat takes two clicks" (0.21.7) — keep it matching, and add signatures rather than replacing them.

Always test after selector or attribute changes:

- Entering fullscreen — **Chat** button appears
- Activating split layout — chat moves in, video shrinks
- Clicking Kick's native **Hide chat** — split layout collapses, **Chat** button reappears
- Re-activating split layout — chat content is visible (not an empty dark slot)
- Exiting fullscreen — chat returns to its original DOM location

## Layout Notes

- Marked layers get `width: calc(100% - var(--kfc-chat-width)) !important; max-width: same; height: 100% !important` and `transform: translateZ(0)` (the containing block that keeps Kick's `position: fixed` timeline inside the video area). The chat slot is `position: fixed; top: 0; bottom: 0; width: var(--kfc-chat-width)` on the docked edge. The video inside is `width/height: 100%; object-fit: contain`.
- **`--kfc-chat-width`** (default `340px`, on `documentElement`) drives both the slot width and the shrink `calc()`; the divider updates it live.
- **Control state never lives on a class on `fsEl`.** Kick's React rewrites `fsEl.className` on re-render. All state lives on our own nodes (`#kfc-toggle-wrap`, `.kfc-chat-slot`, the buttons, `#kfc-info-overlay`) and `documentElement` CSS variables. For the same reason, marker selectors (`[data-kfc-video-root]`, `.kfc-chat-slot`) are **not** scoped under `.kfc-active`, and `videoRootObserver` re-applies the markers when Kick swaps a layer.
- **`looksLikeFullscreenLayer`** marks direct `fsEl` children covering **both** ≥70% width **and** ≥70% height (or containing a `<video>`). OR-based heuristics dragged quality/settings menus into the shrink. **The width basis is viewport − chat while side chat is open** (`coversFullscreen`), so a timeline-only layer isn't un-marked when the chat is dragged wide. In overlay mode the basis is the full viewport.
- **Kick's chat action bar** (channel points / Kicks / gear / `#send-message-button`) needs its **forced widths released at every wrapper level** — Kick's `lg:w-full` keys off the (wide) viewport, not the narrow slot. Required selectors: `:has(> [data-testid="channel-points-button"])`, `:has(> [data-testid="gift-shop-button"])` and `:has(> * > [data-testid="gift-shop-button"])`, each with `width: auto; flex: 0 1 auto`. Match wrappers a level at a time with `> * >`, not by tag. **Don't** use `flex: none` on the icons (worsens the overflow), **don't** tighten padding or gaps, and **don't** add a gap floor to the outer row — no spacing value in the bar is ours, and docked must measure identically to windowed (see Manual Testing). Only the elastic Kicks-to-gear gap legitimately differs. Select via `#send-message-button` and `data-testid`s, never Tailwind classes.
- **Kick's controls fade.** `#kfc-toggle-wrap` fades after `idleDelayMs`; Kick's own controls fade on a fixed internal timer (`KICK_NATIVE_IDLE_MS`). When our delay is longer, `startKeepAlive()` dispatches **untrusted** `mousemove`s on the player (which `onFsMouseMove` ignores) so Kick's timeline fades with ours. When it is shorter, `setKickControlsHidden()` fades Kick's controls layer with inline `opacity: 0` + `pointer-events: none` — **opacity only, no height/layout changes** (the height-based overrides removed in 0.17.0 shifted the timeline). `findKickControlsLayer()` climbs from the seekbar to the subtree without the `<video>`; `kickControlsObserver` re-applies across re-mounts.
  - **The search and the observer are scoped to `videoRoots`, not `fsEl`** (0.21.10). The docked chat is a child of `fsEl`; an `fsEl`-wide search can match a slider in the chat and return **the chat slot**, blanking it. `fsEl` is a last resort only, skipping `isKfcOwnedNode` candidates and refusing a result that is the chat slot, one of our nodes, or an ancestor of the chat. **Anything that fades or hides a node found by searching `fsEl` needs the same two filters.**
- The info overlay (`#kfc-info-overlay`) is top-left, `pointer-events: none`, fades with `kfc-idle`; follow / subscribe / share / notification controls inside the clone are hidden via CSS.

## Reload-Resilience Notes

When Kick's React reconciler re-mounts the player tree (quality change, seek, DVR exit, popstate), our layout can collide with the reconciliation and the page navigates to Kick's 404 error page. The script defends against this in three layers:

1. **Capture-phase teardown.** `onDocClickCapture` and `onDocPointerDownCapture` catch clicks on quality popover items, the seekbar, and "Go to live" buttons *before* Kick's onClick runs, set `videoReloading = true`, and call `disableSideChat()` synchronously so the DOM is back in Kick's expected shape before reconciliation runs.
2. **Disabled Chat button.** `updateBtnLabel()` disables the **Chat** button whenever `videoReloading` is true or the `<video>` element reports `readyState < 2` (`btn.disabled` plus the `#kfc-toggle-btn:disabled` rule).
3. **Grace delay.** Even after `canplay`/`loadeddata` fires, React may still be mid-commit. `VIDEO_READY_GRACE_MS` (750ms) defers re-enabling the button. A `loadstart`/`emptied` during the grace cancels the timer.

The video monitor (`startVideoLoadingMonitor`) attaches to whatever `<video>` is currently in `fsEl` and re-attaches on swap via a `MutationObserver`. It synthesizes the `onVideoLoaded()` path when a *new* element is already past `readyState 2` — but only when it is genuinely different from `previousVideo`, so re-attaching to the same element doesn't clear `videoReloading` on stale `readyState`.

`enableSideChat()` is the last line of defense: it bails when no `<video>` is present and defers (via `pendingVideoEl`, 10s ceiling) when `videoReloading` is true or `readyState < 2`.

## Security

### Rules — always follow these

- **Never use `innerHTML`, `outerHTML`, or `insertAdjacentHTML` with untrusted data.** The existing `innerHTML` uses write only the hardcoded SVG constants (`BTN_SVG`, `MODE_SVG`, `INFO_SVG`, `SETTINGS_SVG`) and the literal `<span>Chat</span>`. Any future markup must remain hardcoded — never interpolate DOM text, URL fragments, or user input.
- **Never use `eval`, `new Function(string)`, `setTimeout(string)`, or `setInterval(string)`.**
- **Do not introduce network requests** without explicit reason. There are currently no `fetch`, `XMLHttpRequest`, `GM_xmlhttpRequest`, or remote image loads. Adding one would require a `@connect` entry and a security review of the destination.
- **Persistence is limited to one `localStorage` key (`kfc-settings`)** holding UI preferences. All reads/writes are wrapped in `try/catch` (private mode / disabled storage) and every value — including values arriving from another tab — is validated/clamped by `applySettings()`. Do not store anything else, and never persist untrusted or sensitive data. No cookies.
- **Do not bypass `suppressObserver`** when mutating `data-chat` from script, or the observer tears down the layout we just enabled (flicker or loops).
- **Do not remove or weaken the `looksLikePlayer` check** in `onFullscreenChange` — it stops us from injecting the controls into unrelated fullscreen targets.

### Checks — run mentally before every commit

- Does any new code assign untrusted data to `innerHTML` or similar? → Fix it.
- Does any new code introduce a `fetch` or other remote request? → Add `@connect`, justify the domain, and document it.
- Does any new code introduce a `localStorage` key beyond `kfc-settings`? → Reconsider; preferences belong in the existing blob, read through `applySettings()`.
- Does any new code mutate `data-chat` without raising `suppressObserver` first? → Wrap the write.
- Does any new code use string-based dynamic execution (`eval`, etc.)? → Remove it.

### Existing security measures (do not remove or weaken)

- `looksLikePlayer` check in `onFullscreenChange`.
- Hardcoded SVG constants as the only `innerHTML` content.
- `suppressObserver` around our own `data-chat` writes.
- `isTrusted` checks on control activations and both player gestures — other scripts on the page can't drive our controls, start playback, or exit fullscreen.
- `@grant none` and zero network calls.
- `showToast()` (instead of `alert()`) for surfacing errors — avoids stealing focus and breaking fullscreen.

## UI Design System

All script-injected UI must follow this design language consistently. Do not deviate from it when adding new buttons, overlays, or controls.

### Palette

Most visible UI inherits Kick's look by cloning Kick's own nodes (info overlay) or rendering Kick's chat inside our slot. The elements the script paints itself follow the **kick-\* family design language** (shared with `kick-third-party-emotes`, `kick-quality-saver`, `kick-chat-utils`, and `kick-vod-resume`). Keep these tokens in sync with the sibling scripts' design sections (`## UI Design System` in kick-third-party-emotes and kick-chat-utils; `### Design tokens (kick-* family)` in kick-quality-saver and kick-vod-resume).

| Token | Value | Usage |
|---|---|---|
| Surface | `#101013` | Button background (Chat + `.kfc-control-btn`), settings panel |
| Green accent | `#22c55e` | Single accent per component — button icons (`fill`), resize divider on hover/drag |
| Neutral border | `rgba(255,255,255,.1)` | Button borders, idle resize divider |
| Hover tint | `rgba(34,197,94,.1)` | Composited over the surface on hover/focus, never as a standalone (transparent) fill |
| Pressed tint | `rgba(34,197,94,.18)` | `#kfc-mode-btn` / `#kfc-settings-btn` while on (composited over the surface) |
| Box shadow | `0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)` | Button depth |
| Backdrop | `blur(10px)` | Button glass effect |
| Border radius | `8px` | Button corners |
| `BTN_SVG` / `MODE_SVG` / `INFO_SVG` / `SETTINGS_SVG` | hardcoded icons | Button icon path data (recoloured green via CSS) |
| `--kfc-chat-width` | default `340px` | Chat-panel width; drives both the slot width and the video-shrink `calc()` |
| `top: 1.75rem; right: 1.75rem` | Kick's `top-7 right-7` placement | `#kfc-toggle-wrap` positioning |
| `rgba(16,16,19,.88)` + `rgba(255,255,255,.1)` border | Toast surface — the family `#101013` at 88% | `#kfc-toast` (errors only) |

### Rules

- **Self-painted buttons use the family tokens, not Kick's classes.** `#kfc-toggle-btn` and `.kfc-control-btn` share the surface / border / blur / shadow / radius above; all styling lives in `injectStyles()`.
- **One green accent per component** — the icon. Never paint a surface green or add a second green element.
- **Hover is the green tint composited over the surface** (`linear-gradient(rgba(34,197,94,.1), rgba(34,197,94,.1)), #101013`) — never the transparent tint alone, or the video shows through.
- **Disabled state is painted by the script:** set `btn.disabled`; `#kfc-toggle-btn:disabled { opacity: .3; pointer-events: none }` does the rest.
- **On/off state is recolouring or the pressed tint** (`#kfc-info-btn.kfc-off` dims the icon; `#kfc-mode-btn.kfc-on` / `#kfc-settings-btn.kfc-on` use the pressed tint) — never a new token.
- **Per-button visibility is CSS, not a wrapper toggle.** The wrap stays visible; `.kfc-chat-open` on the wrap shows the mode toggle and hides **Chat**. Don't hide the whole wrapper.
- **`#kfc-toggle-wrap` is a shared surface with kick-quality-saver.** That script prepends its own button, appends its panel (absolutely positioned, right-aligned under the wrap) while open, and exempts its panel from the idle fade in its own stylesheet (`#kfc-toggle-wrap.kfc-idle:has(#kqs-settings-panel)`). So: `ensureButton()` must keep re-appending the *same* wrap (foreign children must survive), the wrap must not assume it owns all its children (`removeButton()` dropping them on teardown is fine — kqs rebuilds), and **renaming `#kfc-toggle-wrap` / `.kfc-idle` / `.kfc-chat-open`, changing how the wrap moves, or changing the controls' aria-labels (see the controls entry) is a breaking change for kick-quality-saver.** Update both scripts together.
- **The settings panel shares kick-quality-saver's panel design.** `#kfc-settings-panel`: opaque `#101013`, neutral border, one green accent; radii `14px` card / `11px` groups / `8px` controls. A header (`.kfc-settings-head`: icon mark, name, ✕) then one `.kfc-settings-group` per topic. Toggle rows sit in a gap-less `.kfc-settings-switches` column, so each `.kfc-settings-check` row's `7px` vertical padding is the only spacing; `.kfc-settings-switches:last-child` gets `margin-bottom: -7px` to even out the group's padding. Selected chips (`.kfc-selected`) and checked switches use the green tint plus a `0 0 0 3px` green ring. The destructive controls — `.kfc-settings-reset` and `.kfc-settings-close` — share one look (`#fca5a5` glyph on the neutral chip, `rgba(239,68,68,.14)` tint and `rgba(248,113,113,.5)` border on hover), identical to kqs's `.kqs-chip--danger` / `.kqs-close`.
  - **No `backdrop-filter` and no backdrop element** — the surface is opaque, so a blur would only add a compositing layer over the video.
  - **Capped and scrollable:** `max-height: 76vh; overflow-y: auto` plus the family scrollbar (8px, `rgba(255,255,255,.13)` thumb inset by a 2px transparent border with `background-clip: padding-box`, `999px` radius), copied verbatim from `.kqs-card`. Uncapped, it ran off the bottom at 720p / 110%+ zoom. **Every new settings row must keep this true — check the panel at 720p.**
  - Keep it in step with the sibling panel; changing one usually means changing both.
- **The resize divider is a thin neutral line** — 2px `rgba(255,255,255,.12)`, green (`#22c55e`) on hover/drag. No label, fill or shadow.
- **Toasts sit on the family surface** — `rgba(16,16,19,.88)`, neutral border, `8px` radius, no green (an error surface, not a control).
- **The info overlay reuses Kick's own card markup** — a clone plus positioning and a readability gradient. No custom typography, badges, or colour tokens.
- **No new self-painted tooltips, menus, or popovers.** The script's own UI is limited to: the control cluster, one settings panel, one chat slot, one resize divider, one toast, one info overlay (a clone), and a per-popover clone wrapper. Clone Kick's nodes instead of painting new UI.

### Reference implementations

- `#${BTN_ID}` rules in `injectStyles()` — the Chat button
- `.kfc-control-btn` rules — the square icon-only controls (mode, info, settings)
- `#kfc-toggle-wrap` — the positioned flex-row wrapper hosting the control cluster
- `#kfc-settings-panel` — the settings card
- `#kfc-resize-handle` — the draggable video/chat divider
- `.kfc-chat-slot` — fixed-position chat dock; `.kfc-overlay` in overlay mode
- `[data-kfc-video-root]` — in-place marker on Kick's full-coverage player layers
- `#kfc-info-overlay` — top-left clone of Kick's channel-info card
- `#kfc-toast` — neutral error toast

## Manual Testing

Manual testing is required in a browser with a userscript manager installed. The version in brackets is the release whose fix the step guards; its `CHANGELOG.md` entry explains what a failure means.

1. Install the userscript via your manager (e.g. drag the `.user.js` file into Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other, or copy it into the folder configured in the Userscripts extension on Safari).
2. Open a Kick channel page and click the player's fullscreen button.
3. The **Chat** button appears top-right.
4. Click it — video shrinks, chat docks to the right.
5. Click Kick's native **Hide chat** in the chat header (~12px in from its left edge) — the layout tears down and **Chat** reappears, on the **first** click. Test from both starting states: chat visible in the windowed page before fullscreen, and chat hidden. [0.21.7]
6. Click **Chat** again — chat reappears with content (not an empty dark slot).
7. Change quality / seek / "Go to live" with side chat open — the layout tears down and **Chat** stays disabled until the new stream plays.
8. Drag the divider — width follows the pointer, clamped ~260–640px and ≤60% of the screen; the video re-fits live; the width persists across close/re-open and a reload. Drag well past the minimum (below ~180px) — the slot dims (divider stays neutral); releasing closes the side chat; pulling back un-arms it.
9. Click the layout-mode toggle — chat switches to overlay (floating, full-width video) and back; the button looks pressed in overlay mode.
10. Click the info toggle — the stream-info overlay hides/shows; the icon dims when hidden.
11. Enable **Dock chat on left** — chat and divider jump left, video/controls shift right, the info overlay sits right of the chat; resizing still works; in overlay mode the floating chat doesn't cover the bottom controls.
12. Reload and re-enter fullscreen — all settings are restored. **Reset settings** returns everything to defaults and stays reset after another reload.
13. With the panel open: click a switch, then press Space — the video plays/pauses and the switch does **not** toggle. Click a slider, then use the arrow keys — the video seeks. Repeat after an app switch. Tab through the panel and activate with Space/Enter — focus stays put. At 720p or 125% zoom the panel caps at 76vh and **scrolls** to **Reset settings** with the thin family scrollbar. Re-check after adding any settings row. [0.20.1, 0.21.1, 0.21.3]
14. Park the pointer over the cluster until it fades, switch apps, click back in (macOS) — the click reaches the player, no panel, no toggled control. Without switching apps: let it fade over the gear, jiggle and click immediately — the click goes to the player. Moving to the gear normally still opens settings first time. [0.21.1]
15. Same, **without letting the cluster fade** (switch away and back within the hide delay, or with **Auto-hide controls** off): the activating click is swallowed. Same with the panel open and the pointer parked on a switch or slider. Space right after returning plays/pauses and fires nothing in the cluster. A deliberate second click works. [0.21.3, 0.21.5]
16. Park on the gear, return **without clicking** (Cmd-Tab, dock icon, swipe back to the fullscreen Space), wait 2–3s, click without moving — the panel must not open. Nudge a pixel and click — it opens. Repeat parked on a panel switch and on **Chat**. Normal path: return, move to the gear, click — opens first time. [0.21.6]
17. **Repeat 15 and 16 about ten times**, in both flavours — window/app switch (`blur`/`focus`) and tab switch or minimise (`visibilitychange`). The guard defends against a race; one clean pass proves nothing. Also: Tab to the gear, Enter, switch away and back, Space — the video plays/pauses and the panel doesn't toggle.
18. Compare the chat action bar docked vs. windowed at the 260px minimum with a five-digit points value — **measure**, don't eyeball: `getBoundingClientRect()` on `[data-testid="channel-points-button"] svg` and `[data-testid="channel-points-value"]`. Expect 16px icons, 24px from the points value to the Kicks icon, 8px between buttons, 8px gear-to-send in both states; only the Kicks-to-gear space differs. [0.21.4]
19. Enable a **second** copy of the script and reload — one `[KickFullscreenChat] … is standing down` warning, a single `data-kfc-running` on `<html>`, and an open settings panel stays open while the mouse moves. [0.21.8]
20. With **kick-quality-saver** installed, enter/leave fullscreen half a dozen times on a live channel — the settings panel never opens by itself, and quality-saver still applies the saved quality (a regression there looks like the quality silently not applying). Instrument with the `DOMTokenList.prototype.toggle` recipe above to catch a recurrence. [0.21.9]
21. With side chat open: pause, click the video — it resumes; click while playing — nothing happens. The cursor is an arrow while playing and a hand while paused, updating without a mouse move. Double-click exits fullscreen; a `dblclick` dispatched from the console does not. The divider keeps `ew-resize`. A click on the cluster, open panel, divider, info overlay, Kick's controls row or the chat must not resume a paused stream. Let everything fade (2s hide delay, busy chat) — the timeline and cluster go, the **chat stays readable** (`controls-layer lookup landed on our own UI` with debug on means the fade re-targeted the slot). Force a buffer (DevTools → Network → Offline briefly) — Kick's spinner centres on the **video area**, not the screen. [0.21.10]
22. Exit fullscreen — chat back in its original location, no leftover divider / control nodes. Force a toast first (e.g. break `CHAT_SELECTORS` so "chat panel not found" shows), exit, and confirm `document.getElementById('kfc-toast')` is `null`. [0.21.11]
23. Set a wide width (~640px / **Max**) on a full-size window, reload in a window under ~1070px wide, change an unrelated setting, reload on the full-size window — the width is unchanged. [0.21.11]
24. Open Kick in two tabs. In one, change the chat width and an opacity slider; in the other, flip an unrelated switch — then reload both. The first tab's changes survive. Also move a slider and reload straight away: the new value is kept. [0.21.12]
25. Check the developer console for `[KickFullscreenChat]` log lines if something doesn't work (`KickFullscreenChat.debug()` turns on verbose logging).

## Documentation

Update `INSTALL.md` when installation steps, supported browsers, troubleshooting guidance, or user-visible behavior changes.

**Troubleshooting rows live in `INSTALL.md` only.** A user-visible bug fix adds one row under **Fixed in a past release** (oldest first, "Update to **x.y.z+** — …"); general diagnostics go under **If something doesn't work**. `README.md` keeps a three-row summary that links there — don't copy rows into it, since two copies drifted apart before.

Keep docs browser-agnostic. When mentioning installation steps, cover the general flow and call out manager-specific differences (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) where they matter.

Keep this file a map: when a fix needs explaining, put the explanation in the code comment at the site and in `CHANGELOG.md`, and add only the resulting rule here.

## Before Every Commit

Before committing any change, always:

1. **Run the syntax check** (see **Commands**) — it must print `syntax OK`.
2. **Bump `@version`** in the `kick-fullscreen-chat.user.js` metadata header using these rules:

   | Change | Bump | Example |
   |---|---|---|
   | New user-facing feature — new toggle, new layout, new keyboard shortcut | **minor** `x.+1.0` | `0.5.x → 0.6.0` |
   | Bug fix, selector tweak, refactor, internal change | **patch** `x.x.+1` | `0.5.x → 0.5.x+1` |
   | Breaking change or full rewrite | **major** `+1.0.0` | `0.x.x → 1.0.0` |

   Bump the `VERSION` constant inside the IIFE to the same value — it backs `KickFullscreenChat.version`. Verify both with:

   ```bash
   grep -n "@version\|const VERSION" kick-fullscreen-chat.user.js
   ```

3. **Update `CHANGELOG.md`** — add an entry under the new version with a short summary of what changed.
4. **Update `README.md`** if the change is user-facing: new or removed features, changed behaviour, new keyboard shortcuts, or changes to its short troubleshooting summary (bug-fix rows go in `INSTALL.md` — see **Documentation**). Internal refactors and bug fixes that don't change user-facing behaviour do not require a README update.
5. **Suggest a GitHub Release** after every commit if any of the following apply — say "this looks like a good point to publish a GitHub Release":
   - A security fix was made
   - A user-facing feature was added (new toggle, new layout, new keyboard shortcut)
   - A bug affecting core functionality was fixed (button missing in fullscreen, split layout broken, chat not rendering)

   Do NOT suggest a release for: docs-only changes, internal refactors, formatting, style tweaks the user won't notice.

**Commit when a task is finished** and the checks above pass — one commit per finished task, in this repo's commit-message style. **Push only when the user asks.**
