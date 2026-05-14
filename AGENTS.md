# Kick Fullscreen Chat — Agent Context

Browser userscript that adds a Twitch-style side-by-side fullscreen-with-chat mode to Kick.com.

## Project Overview

**Type:** Single-file JavaScript userscript  
**Primary file:** `kick-fullscreen-chat.user.js`  
**Install docs:** `INSTALL.md`  
**Target:** Any userscript manager (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, Safari Userscripts, etc.) on any browser; developed and tested on Safari + Userscripts  
**Git:** `git@github.com:jakubn11/kick-fullscreen-chat.git` (default branch: `main`).

## Commands

There is no package manager, build step, linter, or automated test suite configured.

Useful local checks:

```bash
sed -n '1,80p' kick-fullscreen-chat.user.js
wc -l kick-fullscreen-chat.user.js INSTALL.md
```

Manual testing is required in a browser with a userscript manager installed:

1. Install the userscript via your manager (e.g. drag the `.user.js` file into Tampermonkey / Violentmonkey / Greasemonkey / ScriptCat, or copy it into the folder configured in the Userscripts extension on Safari).
2. Open a Kick channel page.
3. Click the player's fullscreen button.
4. Verify the **Chat** button appears top-right.
5. Click it — video should shrink, chat should dock to the right.
6. Click Kick's native **Hide chat** inside the chat panel — split layout should tear down and the **Chat** button should reappear.
7. Click **Chat** again — chat should reappear in the split layout (not stay empty).
8. Change stream quality / seek / "Go to live" with side chat open — layout should tear down and the **Chat** button should stay disabled until the new stream is playing.
9. Exit fullscreen — DOM should be restored to its original state, chat back in its original location.
10. Check the browser developer console for `[KickFullscreenChat]` log lines if something doesn't work.

## Userscript Metadata

The userscript header controls permissions and host access. Keep it valid across all common userscript managers (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, Userscripts, etc.):

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
- Style injection — `injectStyles()` adds the `.kfc-active` flex layout, slot rules, and button wrapper positioning
- Split-layout state — `savedChatParent`, `savedChatNextSibling`, `chatSlot`, `videoSlot`, `active`, `suppressObserver`
- Reload-resilience state — `videoReloading`, `videoReadyTimer`, `fullscreenVideoEl`, `videoSwapObserver`, `pendingVideoEl`
- Capture-phase teardown handlers — `onDocClickCapture` (quality / seekbar / go-live), `onDocPointerDownCapture` (seekbar), `onChatSlotClick` (Kick's hide-chat button)
- Layout toggle — `enableSideChat()`, `disableSideChat()`
- Button — `ensureButton()`, `removeButton()`, `updateBtnLabel()`
- Idle auto-hide — `startIdleTracking()`, `stopIdleTracking()`, `onFsMouseMove()`, `setIdle()`, `IDLE_MS`
- Video monitor — `startVideoLoadingMonitor()`, `stopVideoLoadingMonitor()`, `attachVideoListeners()`, `detachVideoListeners()`
- Observers and listeners — `dataChatObserver` (watches for Kick toggling `data-chat="false"`), `videoSwapObserver` (watches for Kick replacing the `<video>` element), and the `fullscreenchange` / `webkitfullscreenchange` handlers

The central state that drives the split layout is:

```js
let active = false;             // split layout currently mounted
let videoReloading = false;     // player is reloading; Chat button must stay disabled
let savedChatParent = null;     // where to put chat back on teardown
let savedChatNextSibling = null;
let chatSlot = null;            // .kfc-chat-slot we created
let videoSlot = null;           // .kfc-video-slot we created
```

The core idea: when the user activates the side chat, the chat node is **moved** into a new `.kfc-chat-slot` inside the fullscreen element, and the existing fullscreen children are wrapped in a `.kfc-video-slot`. On tear-down, the chat node is restored to its original parent (and original `nextSibling` insertion point if still present).

## External APIs

None. This userscript does not perform any network requests and does not depend on third-party services. All work is DOM manipulation inside the Kick page.

## DOM And Routing Notes

Kick is a single-page app and may change class names. The fragile selectors live near the top of the userscript:

- `VIDEO_WRAPPER_SELECTORS` — candidates for the fullscreened player container (`#injected-channel-player`, `[data-testid="player"]`, etc.)
- `CHAT_SELECTORS` — candidates for the chat panel (`#chatroom`, `[data-testid="chatroom"]`, etc.)

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

- The fullscreen element is laid out via `display: flex; flex-direction: row` (`.kfc-active` class), with `.kfc-video-slot` (`flex: 1 1 auto`) on the left and `.kfc-chat-slot` (`flex: 0 0 340px`) on the right.
- Slot CSS is intentionally **not** scoped under `.kfc-active`. Kick's React periodically re-renders the fullscreen element and writes its own `className`, stripping `.kfc-active`. Targeting the slot classes directly keeps the rules applied for as long as the slot nodes exist.
- `.kfc-video-slot` sets `transform: translateZ(0)` so it acts as a containing block for Kick's `position: fixed` video and controls layers — without this, the timeline / controls overflow across the chat panel.
- The video element inside the slot is forced to `width/height: 100%` with `object-fit: contain` so it fills the slot without leaving black side bars.
- The toggle button wrapper (`#kfc-toggle-wrap`) fades via the `.kfc-idle` class (`opacity: 0; pointer-events: none`) after `IDLE_MS` of no `mousemove` on the fullscreen element. Kick's own controls overlay does the same; the timing is independent (no DOM coupling) but visually synchronised.

## Reload-Resilience Notes

When Kick's React reconciler re-mounts the player tree (quality change, seek, DVR exit, popstate), our wrapped layout collides with the reconciliation and the page navigates to Kick's 404 error page. The script defends against this in three layers:

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
- **No tooltips, no menus, no popovers** — the script's UI surface is intentionally limited to one button + one slot + one toast.

### Reference implementations

- `BTN_CLASS` / `BTN_SVG` constants — the injected toggle button (Kick-themed)
- `#kfc-toggle-wrap` — the positioned wrapper for the toggle button
- `.kfc-chat-slot` / `.kfc-video-slot` — split-layout slots (transparent / dark backgrounds; no Kick tokens needed because Kick's own chat and player chrome render inside them)
- `#kfc-toast` — neutral error toast

## Documentation

Update `INSTALL.md` when installation steps, supported browsers, troubleshooting guidance, or user-visible behavior changes.

Keep docs browser-agnostic. When mentioning installation steps, cover the general flow and call out manager-specific differences (Userscripts for Safari, Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, etc.) where they matter.

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
