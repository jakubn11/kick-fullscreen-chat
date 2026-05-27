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
9. Press **C** while fullscreen on the Kick player — toggles the side chat. Press again — collapses it. Type a `c` inside Kick's chat input — does NOT toggle (input focus should swallow the key).
10. Exit fullscreen — DOM should be restored to its original state, chat back in its original location.
11. Check the browser developer console for `[KickFullscreenChat]` log lines if something doesn't work.

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
- Button — `ensureButton()`, `removeButton()`, `updateBtnLabel()`
- Keyboard shortcut — `onKeyDown` listener (attached at script load) toggles the side chat on `C` when fullscreen is on the Kick player. Ignored when typing in input / textarea / contenteditable, when a modifier (⌘ / Ctrl / Alt) is held, when the video is mid-reload, and when fullscreen target isn't a Kick player.
- Info overlay — `findStreamerInfoSource()`, `findViewerCountSource()`, `mountInfoOverlay()`, `unmountInfoOverlay()`, `recloneInfoOverlay()`, `scheduleInfoReclone()`, `refindInfoSources()`, `startInfoSourceWatcher()`, `stopInfoSourceWatcher()`; clones Kick's channel-info card and viewer-count badge into fsEl while fullscreen so the user sees streamer name / title / game / viewer count overlaid on the player. State: `infoOverlay`, `infoOverlaySource`, `infoOverlayObserver`, `infoViewerSource`, `infoViewerObserver`, `infoBodyObserver`, `infoOverlayPending`, `infoBodyCheckPending`. Tied to the same `kfc-idle` class as the toggle button so it fades together with Kick's controls/timeline. A body-level observer detects when Kick re-mounts the tracked sources and re-attaches the per-source observers so the overlay stays live across React reconciler swaps.
- Idle auto-hide — `startIdleTracking()`, `stopIdleTracking()`, `onFsMouseMove()`, `setIdle()`, `IDLE_MS` — fades both `#kfc-toggle-wrap` and `#kfc-info-overlay`
- Video monitor — `startVideoLoadingMonitor()`, `stopVideoLoadingMonitor()`, `attachVideoListeners()`, `detachVideoListeners()`
- Popover portal — `startPopoverPortal()`, `stopPopoverPortal()`, `adoptPopover()`, `reconcilePopoverClones()`, `removePopoverClone()`; while side chat is active, *clones* body-portaled popovers (emote-name tooltips etc.) into the fullscreen element so the Fullscreen API displays them. The original stays in `document.body` so Kick's React `createPortal` unmount path (which calls `body.removeChild(popover)`) doesn't throw a `NotFoundError` and trip Kick's 404 error boundary. A per-popover sync observer re-clones when the original's subtree changes (`childList` / `characterData`, not attributes — see below) so content React adds to the wrapper on a later commit shows up in the clone. The clone is removed when the original is removed from `document.body`. Tracked in `popoverClones` (Map: original → clone) and `popoverSyncObservers` (Map: original → sync MutationObserver)
- Observers and listeners — `dataChatObserver` (watches for Kick toggling `data-chat="false"`), `videoSwapObserver` (watches for Kick replacing the `<video>` element), `popoverPortalObserver` (watches `document.body` childList for body-portaled popovers while side chat is active), and the `fullscreenchange` / `webkitfullscreenchange` handlers

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

- Kick's player nodes are **not** moved. The script tags the full-coverage direct children of `fsEl` with `data-kfc-video-root`, CSS shrinks each marked element to `width: calc(100% - 340px) !important; max-width: same; height: 100% !important`, and the chat panel is docked as `position: fixed; top: 0; right: 0; bottom: 0; width: 340px` so it overlays the right side of the screen.
- `looksLikeFullscreenLayer` only marks direct `fsEl` children whose `getBoundingClientRect()` covers **both** ≥70% of viewport width *and* ≥70% of viewport height (or which contain a `<video>` regardless of size). Earlier OR-based heuristics dragged tall-but-narrow popovers (quality / settings menus) into the shrink and broke their placement.
- Marker selectors (`[data-kfc-video-root]`, `.kfc-chat-slot`) are intentionally **not** scoped under `.kfc-active`. Kick's React periodically re-renders `fsEl` and writes its own `className`, stripping `.kfc-active`. The `data-kfc-video-root` attribute is set on Kick's own nodes, so a `MutationObserver` (`videoRootObserver`) re-applies it whenever Kick swaps a layer. `.kfc-chat-slot` is on a node we created and Kick never touches.
- `[data-kfc-video-root]` sets `transform: translateZ(0)` so each marked layer acts as a containing block for Kick's `position: fixed/absolute` descendants — without this, the timeline / controls anchor to the viewport and overflow across the chat panel.
- The video element inside a marked layer is forced to `width/height: 100%` with `object-fit: contain` so it fills the shrunken area without leaving black side bars.
- The toggle button wrapper (`#kfc-toggle-wrap`) fades via the `.kfc-idle` class (`opacity: 0; pointer-events: none`) after `IDLE_MS` of no `mousemove` on the fullscreen element. Kick's own controls overlay does the same; the timing is independent (no DOM coupling) but visually synchronised.
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
- **Do not store anything in `localStorage` or cookies.** This script holds only in-memory state.
- **Do not bypass `suppressObserver`** when mutating `data-chat` from script. Doing so will cause the observer to immediately tear down the layout we just enabled, leading to flicker or infinite loops.
- **Do not remove or weaken the `looksLikePlayer` check** in `onFullscreenChange` — it stops us from injecting the toggle into unrelated fullscreen targets.

### Checks — run mentally before every commit

- Does any new code assign untrusted data to `innerHTML` or similar? → Fix it.
- Does any new code introduce a `fetch` or other remote request? → Add `@connect`, justify the domain, and document it.
- Does any new code introduce a `localStorage` key? → Reconsider; this script is intentionally stateless.
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

This script does not define its own design tokens — all visible UI inherits Kick's tokens by reusing Kick's exact class strings and SVG.

| Token | Source | Usage |
|---|---|---|
| `BTN_CLASS` | Kick's native chat-toggle button class string | The injected **Chat** button |
| `BTN_SVG` | Kick's native "Show chat" icon | The injected **Chat** button icon |
| `top: 1.75rem; right: 1.75rem` | Kick's `top-7 right-7` placement | `#kfc-toggle-wrap` positioning |
| `rgba(0,0,0,.88)` + `rgba(255,255,255,.1)` border | Neutral toast palette | `#kfc-toast` (errors only) |

### Rules

- **Re-use Kick's tokens, never invent new ones.** All inherited styling comes from `BTN_CLASS` (Tailwind classes Kick already ships). If Kick changes the class names, update `BTN_CLASS` rather than introducing a parallel design language.
- **Hide the toggle when split layout is active** — Kick's native **Hide chat** button inside the chat panel takes over. The wrapper toggles `display: none` via the `.kfc-hidden` class.
- **Disabled state via Kick's own classes.** `BTN_CLASS` already includes `disabled:pointer-events-none disabled:opacity-30` — set `btn.disabled = true`/`false`, do not paint custom disabled styling.
- **Toasts are neutral, not Kick-themed.** `#kfc-toast` uses a black-on-translucent palette for surfacing internal errors (e.g. "chat panel not found"). It is not part of Kick's design language and intentionally looks different.
- **The info overlay reuses Kick's own card markup.** `#kfc-info-overlay` is a *clone* of Kick's existing channel-info card; the script does not paint streamer name / title / viewer count on its own. The overlay container adds only positioning + a subtle gradient backdrop for readability — it must not introduce custom typography, badges, or colour tokens.
- **No new tooltips, menus, or popovers painted by the script.** The script's UI surface is intentionally limited to: one toggle button, one chat slot, one toast, one info overlay (clone of Kick's card), and a per-popover clone wrapper. Do not paint new UI from scratch — clone Kick's existing nodes instead.

### Reference implementations

- `BTN_CLASS` / `BTN_SVG` constants — the injected toggle button (Kick-themed)
- `#kfc-toggle-wrap` — the positioned wrapper for the toggle button
- `.kfc-chat-slot` — fixed-position chat dock (dark background; no Kick tokens needed because Kick's own chat renders inside)
- `[data-kfc-video-root]` — in-place marker on Kick's full-coverage player layers; CSS-only shrink to the left of the chat slot
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
