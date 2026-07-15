# Kick Fullscreen Chat — Agent Context

Browser userscript that adds a Twitch-style side-by-side fullscreen-with-chat mode to Kick.com.

## Project Overview

**Type:** Single-file JavaScript userscript  
**Primary file:** `kick-fullscreen-chat.user.js`  
**Install docs:** `INSTALL.md`  
**Target:** Any userscript manager (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) on any browser; developed and tested on Safari + Userscripts  
**Git:** `git@github.com:jakubn11/kick-fullscreen-chat.git` (default branch: `main`).

## Commands

There is no package manager, build step, linter, or automated test suite configured.

Useful local checks:

```bash
sed -n '1,80p' kick-fullscreen-chat.user.js
wc -l kick-fullscreen-chat.user.js INSTALL.md
```

Manual testing is required in a browser with a userscript manager installed:

1. Install the userscript via your manager (e.g. drag the `.user.js` file into Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other, or copy it into the folder configured in the Userscripts extension on Safari).
2. Open a Kick channel page.
3. Click the player's fullscreen button.
4. Verify the **Chat** button appears top-right.
5. Click it — video should shrink, chat should dock to the right.
6. Click Kick's native **Hide chat** inside the chat panel — split layout should tear down and the **Chat** button should reappear.
7. Click **Chat** again — chat should reappear in the split layout (not stay empty).
8. Change stream quality / seek / "Go to live" with side chat open — layout should tear down and the **Chat** button should stay disabled until the new stream is playing.
9. With chat open, drag the divider between the video and chat — chat width should follow the pointer, clamped between ~260px and ~640px (and never past 60% of the screen). The video area should re-fit live. Width should persist when you close and re-open chat **and across a page reload**. Drag the divider *well past* the minimum (below ~180px from the docked edge) — the chat slot should dim (the divider itself stays neutral). Releasing while armed closes the side chat; pulling back above the threshold should un-arm (slot returns to normal) and a normal release commits the clamped width instead.
10. With chat open, click the layout-mode toggle (top-right) — chat should switch to overlay (floating semi-transparent over full-width video) and back to side-by-side. The button should look "pressed" while overlay mode is on.
11. Click the info toggle (top-right) — the streamer-info overlay should hide / show; the toggle's icon dims when hidden.
12. Open the settings gear and enable **Dock chat on left** — the chat panel and divider should jump to the left edge, the video/controls should shift right to clear it, and the stream-info overlay should sit to the right of the chat. Dragging the divider should still resize correctly. Toggle overlay mode and confirm the floating chat sits on the left without covering the bottom controls.
13. Reload the page and re-enter fullscreen — all settings (width, dock side, opacity, hide delay, toggles) should be restored. Open settings and click **Reset settings** — everything should return to defaults and stay reset after another reload.
14. Exit fullscreen — DOM should be restored to its original state, chat back in its original location, and no leftover divider / control nodes.
15. Check the browser developer console for `[KickFullscreenChat]` log lines if something doesn't work.

## Userscript Metadata

The userscript header controls permissions and host access. Keep it valid across all common userscript managers (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other):

- `@match` should remain scoped to `https://kick.com/*` unless the target changes.
- `@grant none` — this userscript does not need any GM_* APIs. Do not add grants unless a feature actually requires one.
- `@updateURL` / `@downloadURL` point at the `main` branch on GitHub. If the repo or branch moves, update both.
- Bump `@version` when changing user-facing behavior or DOM logic.

Do not add `Co-Authored-By:` trailers to git commits.

## Implementation Map

`kick-fullscreen-chat.user.js` is organized into these areas:

- Userscript metadata header
- Constants — element IDs (`BTN_ID`, `WRAP_ID`, `STYLE_ID`), `CHAT_WIDTH`, the inlined Kick button SVG (`BTN_SVG`), and Kick's button class string (`BTN_CLASS`)
- Fragile DOM selectors — `VIDEO_WRAPPER_SELECTORS`, `CHAT_SELECTORS`
- Chat discovery — `pick()`, `findChatByInput()`, `findChat()`
- Kick state helpers — `setKickDataChat()` toggles the `data-chat` attribute Kick uses to drive chat visibility via Tailwind `group-data-[chat=false]/main` rules
- Style injection — `injectStyles()` adds the `[data-kfc-video-root]` shrink rules, chat-slot positioning, and button wrapper positioning
- Split-layout state — `savedChatParent`, `savedChatNextSibling`, `chatSlot`, `videoRoots`, `videoRootHost`, `videoRootObserver`, `active`, `suppressObserver`
- Reload-resilience state — `videoReloading`, `videoReadyTimer`, `fullscreenVideoEl`, `videoSwapObserver`, `pendingVideoEl`
- Capture-phase teardown handlers — `onDocClickCapture` (quality / seekbar / go-live), `onDocPointerDownCapture` (seekbar), `onDocChatToggleClickCapture` (Kick's chat-toggle button anywhere on the page — detected by `CHAT_TOGGLE_RE` text/aria/title match or `looksLikeChatToggleBtn` SVG-path-signature match)
- Layout toggle — `enableSideChat()`, `disableSideChat()`
- Buttons / controls — `ensureButton()` builds the top-right control cluster (`#kfc-toggle-wrap`, a flex row): the info-overlay toggle (`#kfc-info-btn`), the layout-mode toggle (`#kfc-mode-btn`), and the **Chat** button (`#kfc-toggle-btn`). `removeButton()`, `updateBtnLabel()` (Chat-button label + disabled state only; per-button show/hide is CSS via `.kfc-active` scoping), `syncControlState()` (reflects the saved prefs onto fsEl classes + button aria-labels), `toggleOverlayMode()`, `toggleInfoOverlay()`. Each control button's click handler calls `blur()` after a **pointer** click (`if (e.detail)`, so keyboard activations keep focus) — otherwise the button retains focus after a mouse click and, when the window regains focus (e.g. switching apps on macOS), a later Space/Enter meant for the player re-triggers the still-focused button, opening the settings panel or toggling a control "randomly"
- UI prefs — `chatWidth` (px), `chatSide` (`'right'`/`'left'`), `overlayMode` (bool, derived from `openChatAsOverlay` on each open — not persisted), `infoHidden` (bool), `infoBgOpacity` (0–90%), `overlayOpacity`, `autoHideOverlayChat`, `autoHideControls`, `openChatAsOverlay`, `restoreChatOnFullscreen`, `idleDelayMs`. **Persisted** to a single `localStorage` key (`kfc-settings`) via `saveSettings()` / `persistSettings()` (debounced 300ms) and restored at startup by `loadSettings()`. Persist on every settings mutation; `resetSessionSettings()` restores defaults and re-saves.
- Chat dock side — `chatSide` (`'right'` default). `syncControlState()` toggles `html.kfc-chat-left` (flips `.kfc-chat-slot` and `#kfc-resize-handle` to the left edge via CSS) and sets three `documentElement` offset vars that all reference `--kfc-chat-width` so they track live resize: `--kfc-video-shift` (side mode — `translateX` the shrunken player right of the chat), `--kfc-control-shift` (overlay mode — `margin-left` the full-width controls row clear of the floating chat), `--kfc-info-offset` (push the top-left info overlay right of the chat). All are `0`/removed when docked right. `onResizePointerMove` measures from the left edge when docked left.
- Chat-width resize — `applyChatWidth()` (writes `--kfc-chat-width` on `documentElement`), `clampChatWidth(px, viewportWidth?)` (260–640px, ≤60vw), `mountResizeHandle()` / `removeResizeHandle()`, and the pointer drag handlers (`onResizePointerDown/Move/Up`) on `#kfc-resize-handle`. The width is a CSS variable referenced by both the chat-slot width and the video-shrink `calc()`. **Smoothness:** `onResizePointerMove` only stores the pointer X and schedules one `requestAnimationFrame` (`resizeMoveFrame`); `applyResizeFromPointer` does the actual width update at most once per frame, so a high-polling-rate mouse / high-refresh display can't trigger several full chat-subtree reflows per frame. The viewport width is snapshotted at pointer-down (`resizeViewportWidth`) and threaded through `setChatWidth`/`clampChatWidth` so the per-frame update never reads `window.innerWidth` after the move has dirtied layout (which would force a synchronous reflow). `scheduleLiveResizeLayout()` early-returns while `resizing`, deferring the heavy player relayout (`refreshVideoRoots` + synthetic window `resize`) to the `nudgePlayerResize()` on release; the video box still tracks the divider live via pure CSS. **Drag-to-close gesture:** while the user drags the divider, `applyResizeFromPointer` compares the *raw* (unclamped) pointer width against `CHAT_WIDTH_CLOSE_THRESHOLD` (180px). When raw width drops below it, `resizePendingClose` is armed — the chat slot gains a `.kfc-pending-close` class (dims to opacity 0.35); the divider itself is left untinted (kept as the existing neutral/green hover treatment) since the slot dim alone reads clearly enough. On `pointerup` (not `pointercancel`) with the flag set, `onResizePointerUp` calls `disableSideChat(fsEl)` to tear the side layout down before the usual `nudgePlayerResize`; otherwise the flag and class are cleared and the drag commits a normal clamped width. Double-click on the divider still resets width to `CHAT_WIDTH` regardless.
- Overlay chat mode — in overlay mode the video keeps full width (`--kfc-video-width: 100%` on `documentElement` overriding the shrink `calc()`) and the chat slot floats semi-transparently over it via the `.kfc-overlay` class on the slot. Toggled by `#kfc-mode-btn`; only meaningful while `active`. **State is never keyed on a class on `fsEl`** — Kick's React rewrites `fsEl`'s `className` on re-render and would strip it; all control state lives on our own nodes (`#kfc-toggle-wrap`, `.kfc-chat-slot`, the buttons, `#kfc-info-overlay`) and on `documentElement` CSS variables.
- Info overlay — `findStreamerInfoSource()`, `findViewerCountSource()`, `mountInfoOverlay()`, `unmountInfoOverlay()`, `recloneInfoOverlay()`, `scheduleInfoReclone()`, `refindInfoSources()`, `startInfoSourceWatcher()`, `stopInfoSourceWatcher()`; clones Kick's channel-info card and viewer-count badge into fsEl while fullscreen so the user sees streamer name / title / game / viewer count overlaid on the player. State: `infoOverlay`, `infoOverlaySource`, `infoOverlayObserver`, `infoViewerSource`, `infoViewerObserver`, `infoBodyObserver`, `infoOverlayPending`, `infoBodyCheckPending`. Tied to the same `kfc-idle` class as the toggle button so it fades together with Kick's controls/timeline. A body-level observer detects when Kick re-mounts the tracked sources and re-attaches the per-source observers so the overlay stays live across React reconciler swaps.
- Idle auto-hide — `startIdleTracking()`, `stopIdleTracking()`, `onFsMouseMove()`, `setIdle()`, `IDLE_MS` — fades both `#kfc-toggle-wrap` (the whole control cluster) and `#kfc-info-overlay`
- Video monitor — `startVideoLoadingMonitor()`, `stopVideoLoadingMonitor()`, `attachVideoListeners()`, `detachVideoListeners()`
- Popover portal — `startPopoverPortal()`, `stopPopoverPortal()`, `adoptPopover()`, `reconcilePopoverClones()`, `removePopoverClone()`; while side chat is active, *clones* body-portaled popovers (emote-name tooltips etc.) into the fullscreen element so the Fullscreen API displays them. The original stays in `document.body` so Kick's React `createPortal` unmount path (which calls `body.removeChild(popover)`) doesn't throw a `NotFoundError` and trip Kick's 404 error boundary. A per-popover sync observer re-clones when the original's subtree changes (`childList` / `characterData`, not attributes — see below) so content React adds to the wrapper on a later commit shows up in the clone. The clone is removed when the original is removed from `document.body`. Tracked in `popoverClones` (Map: original → clone) and `popoverSyncObservers` (Map: original → sync MutationObserver)
- Chat error recovery — `startChatErrorWatcher()` / `stopChatErrorWatcher()` and `chatErrorObserver` (a MutationObserver on `.kfc-chat-slot`'s `childList` / `subtree` / `characterData`) detect Kick's own chat error boundary fallback ("We are sorry, but something went wrong") via `CHAT_ERROR_RE`. The mutation handler coalesces bursts of message activity into one `chatSlot.textContent` scan per frame using `chatErrorCheckScheduled` (a stored `requestAnimationFrame` id, cancelled by `stopChatErrorWatcher`); when the fallback is seen, the watcher logs, shows a `showToast` ("Kick chat errored. Click Chat to reopen."), disconnects itself, and calls `disableSideChat(fsEl)` to put the chat node back where Kick expects it so the user can re-dock without a full page reload. `chatErrorRecovering` guards re-entrance during the teardown so textContent changes from the move itself don't re-trigger the handler.
- Observers and listeners — `dataChatObserver` (watches for Kick toggling `data-chat="false"`), `videoSwapObserver` (watches for Kick replacing the `<video>` element), `popoverPortalObserver` (watches `document.body` childList for body-portaled popovers while side chat is active), `chatErrorObserver` (see "Chat error recovery" above), and the `fullscreenchange` / `webkitfullscreenchange` handlers

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

The core idea: when the user activates the side chat, the chat node is **moved** into a new `.kfc-chat-slot` (`position: fixed` on the right) inside the fullscreen element. Kick's player nodes stay parented to `fsEl` — they are not moved. Instead, the script tags the full-coverage direct children of `fsEl` with `data-kfc-video-root`, and CSS shrinks them to `calc(100% - 340px)` while `transform: translateZ(0)` makes each marked element a containing block for its `position: fixed/absolute` descendants. On tear-down, the chat node is restored to its original parent (and original `nextSibling` insertion point if still present); the markers and chat slot are removed.

This in-place marker design replaced the older `.kfc-video-slot` wrapper (0.9.1 and earlier). Wrapping `fsEl`'s children caused React to throw on long-running background refreshes — its reconciler would try to remove a node from `fsEl` and find it inside our wrapper instead, and Kick's error boundary navigated to its 404 page.

## External APIs

None. This userscript does not perform any network requests and does not depend on third-party services. All work is DOM manipulation inside the Kick page.

## DOM And Routing Notes

Kick is a single-page app and may change class names. The fragile selectors live near the top of the userscript:

- `VIDEO_WRAPPER_SELECTORS` — candidates for the fullscreened player container (`#injected-channel-player`, `[data-testid="player"]`, etc.)
- `CHAT_SELECTORS` — candidates for the chat panel (`#chatroom`, `[data-testid="chatroom"]`, etc.)
- `STREAMER_INFO_SELECTORS` — candidates for Kick's channel-info card cloned into the top-left fullscreen overlay (`[data-testid="streamer-info"]`, `[data-testid="channel-info"]`, `#channel-header`, etc.). When Kick renames the card, add new fallback selectors at the end rather than replacing working ones.

When fixing Kick DOM breakage, prefer adding fallback selectors rather than replacing working selectors. `findChat()` already falls back to walking up from a chat input/textarea whose placeholder matches `chat|message|send a message` — extend that heuristic before resorting to brittle class-name matching.

`data-chat` is the attribute Kick uses on a player ancestor to drive chat visibility through Tailwind variants like `group-data-[chat=false]/main:block`. The script:

1. Sets `data-chat="true"` when entering the split layout, so chat is not hidden by Kick's own CSS once it has been moved into our chat slot.
2. Observes `data-chat` mutations and tears down the split layout when Kick sets it to `"false"` (e.g. when the user clicks Kick's native **Hide chat** button).
3. Uses a `suppressObserver` flag so our own writes do not immediately re-trigger the observer.

Always test after selector or attribute changes:

- Entering fullscreen — **Chat** button appears
- Activating split layout — chat moves in, video shrinks
- Clicking Kick's native **Hide chat** — split layout collapses, **Chat** button reappears
- Re-activating split layout — chat content is visible (not an empty dark slot)
- Exiting fullscreen — chat returns to its original DOM location

## Layout Notes

- Kick's player nodes are **not** moved. The script tags the full-coverage direct children of `fsEl` with `data-kfc-video-root`, CSS shrinks each marked element to `width: calc(100% - var(--kfc-chat-width)) !important; max-width: same; height: 100% !important`, and the chat panel is docked as `position: fixed; top: 0; right: 0; bottom: 0; width: var(--kfc-chat-width)` so it overlays the right side of the screen.
- **Chat width is a CSS variable.** `--kfc-chat-width` (default `340px`, written on `documentElement` by `applyChatWidth()`) drives both the shrink `calc()` and the slot width. The `#kfc-resize-handle` divider updates it live during a pointer drag, clamped to 260–640px and ≤60vw. The value lives in `chatWidth` and is persisted to `localStorage` (debounced), so it survives both open/close and a page reload.
- **Overlay mode** (toggled by `#kfc-mode-btn`) overrides the video shrink back to `width: 100%` by setting `--kfc-video-width: 100%` on `documentElement`, and gives `.kfc-chat-slot` a translucent blurred background via the `.kfc-overlay` class on the slot, so the chat floats over the full-width video instead of shrinking it. Reset on teardown by `syncControlState()`; the `overlayMode` preference is retained for the next open. **Do not key this (or any control state) on a class on `fsEl`** — Kick's React strips `fsEl`'s `className` on re-render (the same reason `[data-kfc-video-root]` is re-applied by an observer), which previously reverted the controls mid-resize. Drive state from our own nodes + `documentElement` variables only.
- `looksLikeFullscreenLayer` only marks direct `fsEl` children whose `getBoundingClientRect()` covers **both** ≥70% width *and* ≥70% height (or which contain a `<video>` regardless of size). Earlier OR-based heuristics dragged tall-but-narrow popovers (quality / settings menus) into the shrink and broke their placement. **The width basis is the available video width (viewport − chat) while side chat is open, not the full viewport** (`coversFullscreen`): a controls layer that only holds the timeline (no `<video>`, so it must pass the size+controls test) is shrunk to `100% − chatWidth`, and measuring it against the full viewport would drop it below 70% once the chat is dragged wide — un-marking it, losing the `translateZ(0)` containing block, and letting Kick's `position: fixed` timeline escape across the chat. In overlay mode the basis is the full viewport (video isn't shrunk).
- Marker selectors (`[data-kfc-video-root]`, `.kfc-chat-slot`) are intentionally **not** scoped under `.kfc-active`. Kick's React periodically re-renders `fsEl` and writes its own `className`, stripping `.kfc-active`. The `data-kfc-video-root` attribute is set on Kick's own nodes, so a `MutationObserver` (`videoRootObserver`) re-applies it whenever Kick swaps a layer. `.kfc-chat-slot` is on a node we created and Kick never touches.
- `[data-kfc-video-root]` sets `transform: translateZ(0)` so each marked layer acts as a containing block for Kick's `position: fixed/absolute` descendants — without this, the timeline / controls anchor to the viewport and overflow across the chat panel.
- The video element inside a marked layer is forced to `width/height: 100%` with `object-fit: contain` so it fills the shrunken area without leaving black side bars.
- The toggle button wrapper (`#kfc-toggle-wrap`) fades via the `.kfc-idle` class (`opacity: 0; pointer-events: none`) after `idleDelayMs` of no real `mousemove` on the fullscreen element. Kick's own controls overlay fades on its own fixed internal timer (~`KICK_NATIVE_IDLE_MS`), which the user can't change. When the configured delay exceeds that, `startKeepAlive()` dispatches **untrusted** synthetic `mousemove`s on the player to reset Kick's timer, with the final nudge scheduled `idleDelayMs - KICK_NATIVE_IDLE_MS` in so Kick's timeline fades together with our overlay instead of sooner. `onFsMouseMove` ignores untrusted events so these nudges don't reset our own idle timer. When the configured delay is **shorter** than Kick's native timer, `setKickControlsHidden()` fades Kick's controls layer to `opacity: 0` + `pointer-events: none` (inline `!important`, **no** height/layout changes) the moment we go idle, so the timeline hides in step with our overlay. `findKickControlsLayer()` locates the cluster from the seekbar and climbs only as far as the subtree that does not contain the `<video>`, so the video layer is never faded; a childList-only observer (`kickControlsObserver`) re-applies the fade across React re-mounts during idle. This is a deliberately minimal re-take on the height-based control overrides removed in 0.17.0 — opacity-only, so the timeline never shifts off the bottom.
- The streamer info overlay (`#kfc-info-overlay`) is anchored top-left of the fullscreen element and fades through the same `kfc-idle` class as the toggle button, so it appears with Kick's timeline/controls and disappears with them. It is `pointer-events: none` so clicks pass through to the player. Follow / subscribe / share / notification controls inside the cloned card are hidden via CSS so the overlay stays compact.

## Reload-Resilience Notes

When Kick's React reconciler re-mounts the player tree (quality change, seek, DVR exit, popstate), our layout can collide with the reconciliation and the page navigates to Kick's 404 error page. The script defends against this in three layers:

1. **Capture-phase teardown.** `onDocClickCapture` and `onDocPointerDownCapture` catch clicks on quality popover items, the seekbar, and "Go to live" buttons *before* Kick's onClick runs, set `videoReloading = true`, and call `disableSideChat()` synchronously so the DOM is back in Kick's expected shape before reconciliation runs.
2. **Disabled Chat button.** `updateBtnLabel()` disables the **Chat** button whenever `videoReloading` is true or the `<video>` element reports `readyState < 2`. The disabled state is enforced via `btn.disabled = true` plus Kick's own `disabled:pointer-events-none` Tailwind class on `BTN_CLASS`.
3. **Grace delay.** Even after `canplay`/`loadeddata` fires, React may still be mid-commit. `VIDEO_READY_GRACE_MS` (750ms) defers re-enabling the button. A `loadstart`/`emptied` during the grace cancels the timer and keeps the button disabled.

The video monitor (`startVideoLoadingMonitor`) attaches to whatever `<video>` is currently in `fsEl` and re-attaches on swap via a `MutationObserver`. It also synthesizes the `onVideoLoaded()` path when a *new* element is already past `readyState 2` by the time the observer wakes — but only when the element is genuinely different from the previous one (compared against `previousVideo` captured before the detach), so re-attaching to the same element doesn't clear `videoReloading` based on stale `readyState`.

`enableSideChat()` is the last line of defense: it bails when no `<video>` is present and defers (via `pendingVideoEl`) when `videoReloading` is true or `readyState < 2`.

## Security

### Rules — always follow these

- **Never use `innerHTML`, `outerHTML`, or `insertAdjacentHTML` with untrusted data.** The single existing use of `innerHTML` writes a hardcoded SVG + `<span>Chat</span>` template. Any future button content must remain hardcoded — never interpolate provider responses, DOM text, URL fragments, or user input.
- **Never use `eval`, `new Function(string)`, `setTimeout(string)`, or `setInterval(string)`.**
- **Do not introduce network requests** without explicit reason. There are currently no `fetch`, `XMLHttpRequest`, `GM_xmlhttpRequest`, or remote image loads. Adding one would require a `@connect` entry and a security review of the destination.
- **Persistence is limited to one `localStorage` key (`kfc-settings`)** holding UI preferences (see `saveSettings()` / `loadSettings()`). All reads/writes are wrapped in `try/catch` (private mode / disabled storage) and every value is validated/clamped on load. Do not store anything else, and never persist untrusted or sensitive data. No cookies.
- **Do not bypass `suppressObserver`** when mutating `data-chat` from script. Doing so will cause the observer to immediately tear down the layout we just enabled, leading to flicker or infinite loops.
- **Do not remove or weaken the `looksLikePlayer` check** in `onFullscreenChange` — it stops us from injecting the toggle into unrelated fullscreen targets.

### Checks — run mentally before every commit

- Does any new code assign untrusted data to `innerHTML` or similar? → Fix it.
- Does any new code introduce a `fetch` or other remote request? → Add `@connect`, justify the domain, and document it.
- Does any new code introduce a `localStorage` key beyond `kfc-settings`? → Reconsider; preferences belong in the existing `kfc-settings` blob, and all access must stay wrapped in `try/catch` with validation on load.
- Does any new code mutate `data-chat` without raising `suppressObserver` first? → Wrap the write.
- Does any new code use string-based dynamic execution (`eval`, etc.)? → Remove it.

### Existing security measures (do not remove or weaken)

- `looksLikePlayer` check in `onFullscreenChange` — only injects the toggle when the fullscreen target is a Kick player container.
- Hardcoded `BTN_SVG` + `<span>Chat</span>` template for the toggle button — the only `innerHTML` use in the script.
- `suppressObserver` flag around our own `data-chat` writes — prevents the `dataChatObserver` from tearing down the layout we just enabled.
- `@grant none` and zero `fetch` / `XMLHttpRequest` / image-load calls — keeps the attack surface to in-page DOM manipulation only.
- `showToast()` (instead of `alert()`) for surfacing errors — avoids stealing focus and breaking fullscreen.

## UI Design System

All script-injected UI must follow this design language consistently. Do not deviate from it when adding new buttons, overlays, or controls.

### Palette

Most visible UI inherits Kick's look by cloning Kick's own nodes (info overlay) or rendering Kick's chat inside our slot. The elements the script paints itself — the **Chat** button and the icon control buttons — follow the **kick-emotes design language** (the sibling userscript), so the two scripts feel like one family. These are the shared tokens; keep them in sync with `kick-emotes`' `## UI Design System` section.

| Token | Value | Usage |
|---|---|---|
| Surface | `#101013` | Button background (Chat + `.kfc-control-btn`) |
| Green accent | `#22c55e` | Single accent per component — button icons (`fill`), resize divider on hover/drag |
| Neutral border | `rgba(255,255,255,.1)` | Button borders, idle resize divider |
| Hover tint | `rgba(34,197,94,.1)` | Composited over the surface on hover/focus, never as a standalone (transparent) fill |
| Pressed tint | `rgba(34,197,94,.18)` | `#kfc-mode-btn` while overlay mode is active (composited over the surface) |
| Box shadow | `0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)` | Button depth |
| Backdrop | `blur(10px)` | Button glass effect |
| Border radius | `8px` | Button corners |
| `BTN_SVG` / `MODE_SVG` / `INFO_SVG` | hardcoded icons | Button icon path data (recoloured green via CSS) |
| `--kfc-chat-width` | default `340px` | Chat-panel width; drives both the slot width and the video-shrink `calc()` |
| `top: 1.75rem; right: 1.75rem` | Kick's `top-7 right-7` placement | `#kfc-toggle-wrap` positioning |
| `rgba(0,0,0,.88)` + `rgba(255,255,255,.1)` border | Neutral toast palette | `#kfc-toast` (errors only) |

### Rules

- **The toggle button follows the kick-emotes design system, not Kick's native classes.** It is the script's one self-painted control: `#101013` surface, `rgba(255,255,255,.1)` border, `blur(10px)` backdrop, the layered box-shadow above, and `8px` radius. All styling lives in `injectStyles()` under `#${BTN_ID}` — the button no longer carries any Kick Tailwind class string.
- **One green accent per component.** The toggle button's single `#22c55e` accent is the icon (`#${BTN_ID} svg { fill: #22c55e }`). Never paint the surface green or add a second green element.
- **Hover is the green tint composited over the surface.** `#${BTN_ID}:hover` uses `linear-gradient(rgba(34,197,94,.1), rgba(34,197,94,.1)), #101013` so the tint sits on an opaque surface and text contrast holds — never set the transparent tint as a standalone background (the video would show through).
- **Disabled state is painted by the script.** Because the button dropped Kick's `disabled:*` classes, `#${BTN_ID}:disabled { opacity: .3; pointer-events: none }` provides it. Set `btn.disabled = true`/`false`; the CSS does the rest.
- **Icon control buttons share the button's surface.** The layout-mode toggle (`#kfc-mode-btn`) and info toggle (`#kfc-info-btn`) use the `.kfc-control-btn` class — the same `#101013` glass surface / border / blur / shadow as the Chat button, but square and icon-only, with the single green accent on the icon. Their on/off state is shown by recolouring (`#kfc-info-btn.kfc-off` dims the icon) or a pressed green tint (`#kfc-mode-btn.kfc-on`), never by inventing a new token.
- **`#kfc-toggle-wrap` is a shared surface — the sibling kick-quality-saver script mounts into it.** When both scripts are installed, that script prepends its own button as the leftmost child of the wrap, and while its settings panel is open it appends the panel as an absolutely positioned child too (right-aligned under the wrap, so the wrap's `right` transition carries it during chat resizes exactly as it carries `#kfc-settings-panel`). It also neutralises the wrap's idle fade for its own panel from its own stylesheet (`#kfc-toggle-wrap.kfc-idle:has(#kqs-settings-panel)`), mirroring the `settingsOpen` exemption in `syncControlState()`. Consequences: `ensureButton()` must keep re-appending the *same* wrap element rather than rebuilding it (a foreign child has to survive), the wrap must not assume its children are only the ones it created (`removeButton()` may drop foreign nodes on teardown, which is fine — that script rebuilds them), and renaming `#kfc-toggle-wrap` / `.kfc-idle` / `.kfc-chat-open`, or changing how the wrap moves, is a **breaking change for kick-quality-saver**. Update both scripts together.
- **Per-button visibility is CSS, not a wrapper toggle.** `#kfc-toggle-wrap` stays visible (it's a flex row hosting all controls); individual buttons show/hide via `.kfc-active` scoping (Chat button only when chat is closed, mode toggle only when open). Do not hide the whole wrapper.
- **The settings panel shares kick-quality-saver's panel design.** `#kfc-settings-panel` keeps the tokens above (opaque `#101013`, `rgba(255,255,255,.1)` border, one green accent) but departs on radius — a `14px` card, `11px` groups, `8px` controls — because the nesting needs the extra step. Its structure is a header (`.kfc-settings-head`: icon mark, name, and a ✕ close button) followed by one `.kfc-settings-group` per topic. Within a group the toggle rows are wrapped in a gap-less `.kfc-settings-switches` column (mirroring the sibling panel's `.kqs-switches`) so each `.kfc-settings-check` row's own `7px` top/bottom padding is the only vertical spacing and the hairline separators sit centered between rows; a `.kfc-settings-switches:last-child` gets `margin-bottom: -7px` so a group ending in toggles has equal padding at its top and bottom edges (the sibling panel does not yet do this last part). Selected chips (`.kfc-selected`) and checked switches use a green tint plus a `0 0 0 3px` green ring. The two destructive controls — `.kfc-settings-reset` and `.kfc-settings-close` — share one look: `#fca5a5` glyph on the neutral chip surface, `rgba(239,68,68,.14)` tint and `rgba(248,113,113,.5)` border on hover. Keep them identical to each other and to the sibling panel's `.kqs-chip--danger` / `.kqs-close`. **The panel carries no `backdrop-filter` and has no backdrop element behind it** — its surface is opaque, so a blur would only add a compositing layer over the video. Keep it visually in step with the sibling script's panel; changing one usually means changing both.
- **The resize divider is a thin neutral line.** `#kfc-resize-handle` is a near-invisible 2px line (`rgba(255,255,255,.12)`) that turns green (`#22c55e`) on hover/drag — the one accent for that component. No label, no fill, no shadow.
- **Toasts are neutral, not themed.** `#kfc-toast` uses a black-on-translucent palette for surfacing internal errors (e.g. "chat panel not found"). It is intentionally distinct from both Kick and the kick-emotes design language.
- **The info overlay reuses Kick's own card markup.** `#kfc-info-overlay` is a *clone* of Kick's existing channel-info card; the script does not paint streamer name / title / viewer count on its own. The overlay container adds only positioning + a subtle gradient backdrop for readability — it must not introduce custom typography, badges, or colour tokens.
- **No new tooltips, menus, or popovers painted by the script.** The script's self-painted UI surface is intentionally limited to: the control cluster (Chat button + mode toggle + info toggle), one chat slot, one resize divider, one toast, one info overlay (clone of Kick's card), and a per-popover clone wrapper. Do not paint new UI from scratch — clone Kick's existing nodes instead.

### Reference implementations

- `#${BTN_ID}` rules in `injectStyles()` — the toggle button, styled in the kick-emotes design language (dark surface, neutral border, blur, green icon accent)
- `.kfc-control-btn` rules — the square icon-only control buttons (mode + info toggles); same surface as the Chat button
- `BTN_SVG` / `MODE_SVG` / `INFO_SVG` constants — hardcoded icon path data for the three controls (recoloured green via CSS)
- `#kfc-toggle-wrap` — the positioned flex-row wrapper hosting the control cluster
- `#kfc-resize-handle` — the draggable video/chat divider (neutral line, green on hover/drag)
- `.kfc-chat-slot` — fixed-position chat dock; width is `var(--kfc-chat-width)`; gains a translucent backdrop via its own `.kfc-overlay` class in overlay mode
- `[data-kfc-video-root]` — in-place marker on Kick's full-coverage player layers; CSS-only shrink to the left of the chat slot (full width when `--kfc-video-width` is set to `100%` in overlay mode)
- `#kfc-info-overlay` — top-left clone of Kick's channel-info card; positioning + readability gradient only, all visible content (avatar / name / title / game / viewers) comes from Kick's own DOM
- `#kfc-toast` — neutral error toast

## Documentation

Update `INSTALL.md` when installation steps, supported browsers, troubleshooting guidance, or user-visible behavior changes.

Keep docs browser-agnostic. When mentioning installation steps, cover the general flow and call out manager-specific differences (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) where they matter.

## Before Every Commit

Before committing any change, always:

1. **Bump `@version`** in the `kick-fullscreen-chat.user.js` metadata header using these rules:

   | Change | Bump | Example |
   |---|---|---|
   | New user-facing feature — new toggle, new layout, new keyboard shortcut | **minor** `x.+1.0` | `0.5.x → 0.6.0` |
   | Bug fix, selector tweak, refactor, internal change | **patch** `x.x.+1` | `0.5.x → 0.5.x+1` |
   | Breaking change or full rewrite | **major** `+1.0.0` | `0.x.x → 1.0.0` |

2. **Update `CHANGELOG.md`** — add an entry under the new version with a short summary of what changed.
3. **Update `README.md`** if the change is user-facing: new or removed features, changed behaviour, new keyboard shortcuts, or updated troubleshooting steps. Internal refactors and bug fixes that don't change user-facing behaviour do not require a README update.
4. **Suggest a GitHub Release** after every commit if any of the following apply — say "this looks like a good point to publish a GitHub Release":
   - A security fix was made
   - A user-facing feature was added (new toggle, new layout, new keyboard shortcut)
   - A bug affecting core functionality was fixed (button missing in fullscreen, split layout broken, chat not rendering)

   Do NOT suggest a release for: docs-only changes, internal refactors, formatting, style tweaks the user won't notice.
