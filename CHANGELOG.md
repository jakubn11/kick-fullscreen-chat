  # Changelog

  All notable changes to this project will be documented in this file.

  The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

  ## [0.8.2] - 2026-05-14

  ### Changed
  - Repository moved to `github.com/jakubn11/kick-fullscreen-chat`. `@namespace`, `@updateURL`, and `@downloadURL` in the userscript metadata header now point at the new location, so Tampermonkey / Userscripts auto-update fetches from the new repo. Added `INSTALL.md` (extracted from `README.md`) covering setup per userscript manager, usage, update notes, and the troubleshooting table. `README.md` now links out to it instead of duplicating the content.

  ## [0.8.1] - 2026-05-14

  ### Fixed
  - The **Chat** button could still navigate to Kick's 404 page when clicked right after the side chat had torn itself down due to a quality change, seek, or "go to live" click while the player was reloading. The 0.8.0 disabled-while-loading check only ran on `fullscreenchange`, so its listeners stayed on the now-dead `<video>` element after Kick re-mounted the player tree, and the old element could briefly still report `readyState=4` in the gap before Kick wiped it — letting the button look enabled. Now: a `videoReloading` flag is raised synchronously in the capture-phase quality / seekbar / go-live handlers (and by the monitor's `loadstart` / `emptied` listeners for reloads we didn't trigger ourselves) and only cleared when the (possibly new) `<video>` fires `canplay` / `loadeddata`. The monitor also installs a `MutationObserver` on the fullscreen element so it re-attaches its listeners to whatever video element Kick mounts next. `enableSideChat` additionally bails out when no `<video>` is present and defers when the flag is set, as a last line of defense against clicks that slip through the disabled state.

  ### Changed
  - The **Chat** button no longer re-enables instantly when the video fires `canplay`/`loadeddata`. Even when the video reports ready, React can still be mid-commit on Kick's player tree, and a click that lands in that window can still hit the 404. The button now waits `VIDEO_READY_GRACE_MS` (750ms) after the ready event before becoming clickable; if another `loadstart`/`emptied` fires during the grace, the timer is canceled and the button stays disabled until the next stable ready event. Initial-fullscreen-enter with an already-loaded video is unaffected (no reload conflict to worry about).

  ## [0.8.0] - 2026-05-14

  ### Changed
  - The **Chat** button is now disabled while the video is loading. Once the video reaches `HAVE_CURRENT_DATA` (readyState ≥ 2), the button is automatically enabled. This prevents users from attempting to enable side chat before the player is fully initialized, which could lead to layout issues. The button's `aria-label` also updates to show "Loading video..." while disabled.

  ## [0.7.8] - 2026-05-14

### Fixed
- Clicking the **Chat** button to open the side chat *while the video was still loading* (e.g. right after entering fullscreen, after a quality change, or after seeking) navigated to Kick's 404 page. Cause: wrapping fsEl's children mid-load collides with React's in-progress reconciliation as Kick mounts the player tree, so the very next commit phase throws and the error boundary navigates away. The script now checks `video.readyState` before wrapping; if the video hasn't reached `HAVE_CURRENT_DATA` (readyState ≥ 2), the wrap is deferred until the video fires `loadeddata` or `canplay`. A 10-second timeout abandons the pending enable so a stalled load doesn't leave the user with a stuck button. The pending state is also cleared on fullscreen exit.

## [0.7.7] - 2026-05-14

### Fixed
- Clicking "Go to live" while in timeline history (DVR mode) with the side chat open navigated to Kick's 404 page. Exiting DVR back to live re-mounts the player tree the same way quality changes and seeking do, so it triggers the same React reconciliation conflict against our wrapped layout. The script now also catches capture-phase clicks whose textContent matches `go to live` / `jump to live` / `back to live` / `skip to live` / `go live` (case-insensitive, walking up a few levels from the click target) and tears down before Kick's onClick handler runs.

## [0.7.6] - 2026-05-14

### Fixed
- Changing stream quality from the player's quality popover while the side chat was open still navigated to Kick's 404 page. The proactive teardown added in 0.7.2 required `target.closest('button, [role="menuitem"], [role="option"], li, a')` to match the click target — but Kick's quality items in the popover are plain `<div>`s with no role attribute, so `closest()` returned `null` and the teardown never fired. The detector now walks up a few levels from the click target and matches by `textContent` (`Auto` / `Source` / `Original` / `<digits>p[<digits>]`) regardless of tag.
- Seeking on the timeline (clicking the seekbar to go back in time) also navigated to Kick's 404 page, because Kick's player re-mounts on the live→DVR transition and our wrapped layout triggered the same React reconciliation conflict. The script now also tears down the side-chat layout on capture-phase `click` and `pointerdown` events targeting the seekbar (matched via Tailwind's `group/seekbar` class).

## [0.7.5] - 2026-05-14

### Fixed
- Opening the player's quality dialog while the side chat was active rendered the dialog stretched across the full width of the video area, with the menu items pinned to the top-left of a giant black overlay. Cause: the defensive guard introduced in 0.7.3 / rewritten with `:has()` in 0.7.4 matched the quality dialog as a sibling of our slots and forced `right: 340px; max-width: calc(100% - 340px)` on it. That guard was added to defend against a theorized stray controls overlay, but the 0.7.4 DOM dump proved the actual overflow was caused by `.kfc-active` being stripped from fsEl — already fixed independently by scoping slot CSS to the slot classes. The guard is no longer needed and has been removed.

## [0.7.4] - 2026-05-14

### Fixed
- The player's bottom timeline / control row would spontaneously start overflowing across the full viewport (under the chat panel, leaving a black strip on the right of chat) after the side chat had been open for a while, even with no user input. Hide-chat + show-chat fixed it temporarily until it broke again. Root cause discovered via DOM dump: Kick's React periodically re-renders the fullscreen element and writes its own `className`, which **strips the `.kfc-active` class we added**. Once stripped, our slot rules `.kfc-active > .kfc-video-slot { position: relative; transform: translateZ(0); }` no longer matched, so `.kfc-video-slot` lost its containing-block superpowers. The controls overlay (`absolute inset-0`) inside the slot then resolved to the next positioned ancestor — fsEl itself, full viewport — so its grid stretched across the chat. Slot CSS is now scoped to the slot classes directly (`.kfc-video-slot`, `.kfc-chat-slot`) instead of `.kfc-active > .kfc-video-slot`, so the rules stay applied for as long as our slot nodes exist regardless of fsEl's className churn. The defensive guard added in 0.7.3 was also rewritten with `:has()` so it survives the same className stripping.

## [0.7.3] - 2026-05-14

### Fixed
- The player's bottom control bar (pause/timeline/LIVE indicator + the right-hand player icons) sometimes overflowed across the full viewport, drawing under the chat panel and leaving a black strip on the right of chat. Root cause: Kick re-mounts the controls overlay (the `absolute inset-0 grid grid-cols-1 grid-rows-[1fr_auto]` div) at some point after we've wrapped the original children, and the new overlay lands as a direct child of the fullscreen element instead of inside our `.kfc-video-slot`. Because it's `absolute inset-0`, its grid then sizes to fsEl (the full viewport) and the bottom row of that grid is what extended under the chat. Added a CSS guard `.kfc-active > *:not(.kfc-video-slot):not(.kfc-chat-slot):not(#kfc-toggle-wrap):not(#kfc-toast) { right: <CHAT_WIDTH> !important; max-width: calc(100% - <CHAT_WIDTH>) !important; }` so any stray positioned sibling of our slots is confined to the video area. Static-positioned siblings are unaffected.

## [0.7.2] - 2026-05-14

### Fixed
- Changing stream quality with the side chat open still navigated to Kick's 404 / "Oops, something went wrong" page in some cases. The previous teardown relied on `emptied`/`loadstart` events on the `<video>` element, which fire too late (or not at all if Kick replaces the element entirely) — by then React's reconciler has already thrown synchronously and Kick's error boundary has navigated away. The script now also listens for clicks on quality menu items (button/menuitem/option/li/a whose trimmed text matches `auto`, `source`, `original`, or a `<digits>p[<digits>]` pattern) in the capture phase and tears the side-chat layout down synchronously, so the DOM is back in Kick's expected shape before its onClick handler runs.

## [0.7.1] - 2026-05-14

### Fixed
- Clicking Kick's native **Hide chat** button inside the chat panel sometimes required two clicks to actually tear the side-chat layout down. Root cause: when chat starts hidden in normal browsing (`data-chat="false"`) and the user enables our side layout, our `setKickDataChat('true')` overrides the DOM but doesn't update Kick's internal React state. The first click on Kick's hide button then toggles Kick's state from `hidden → shown` (so `data-chat` stays `"true"` and the MutationObserver doesn't fire), and only the second click toggles back to `hidden` and triggers teardown. The script now also listens for clicks on any button inside the chat slot whose text or `aria-label` matches `hide chat` / `close chat` / `collapse chat`, and schedules a teardown after Kick's own handler runs — so one click always tears down, regardless of Kick's internal state.

## [0.7.0] - 2026-05-14

### Fixed
- Changing stream quality with the side chat open used to navigate Kick to its 404 / "Oops, something went wrong" page because our wrapped player layout interfered with React's reconciliation when the player reloaded. The script now listens for `emptied` and `loadstart` on the video element and for `popstate`, and tears the side-chat layout down at the first sign of a reload. After teardown the user can re-open chat with the **Chat** button.
- Removed `[data-chat-entry]` from `CHAT_SELECTORS` — it matches a single chat message, not the chat panel, and would have caused the script to move one message instead of the whole panel if the earlier selectors ever stopped matching.
- Replaced the blocking `alert()` on "chat panel not found" with a non-blocking on-screen toast (`#kfc-toast`). The previous `alert()` could break fullscreen mode in some browsers and stole focus from the player.

### Changed
- Console logging is now gated behind a `DEBUG = false` flag at the top of the script. The default is silent; warnings (e.g. "chat container not found") still print via `console.warn`. Flip the flag to `true` for development.
- Children moves in `enableSideChat` and `disableSideChat` now stage through a `DocumentFragment` so the slot wrap/unwrap reflows once instead of once per child.
- Set `active = false` at the top of `disableSideChat` so re-entrant teardown calls (e.g. a `popstate` firing while we are already cleaning up) short-circuit cleanly.

### Added
- `@updateURL` and `@downloadURL` in the userscript metadata so Tampermonkey / Userscripts can auto-update the script when a new version is published to the repo's `main` branch.

## [0.6.0] - 2026-05-14

### Fixed
- Kick's player draws its video and bottom controls (timeline, volume, LIVE indicator, native chat-toggle button) using `position: fixed` against the viewport, which made them overflow the video slot and overlap the chat panel in the split layout. The video slot now sets `transform: translateZ(0)` to become a containing block for `position: fixed` descendants, plus `overflow: hidden` to clip stragglers. The video element is also forced to `width/height: 100%` with `object-fit: contain` so it fills the slot without leaving black side bars.
- Replaced the single in-line `window.dispatchEvent(new Event('resize'))` after layout swaps with `nudgePlayerResize()` which fires immediately, on the next animation frame, and after a 150ms timeout — Kick's player misses a single resize event on the same tick as a DOM swap, leaving the video stuck at the pre-swap size.

## [0.5.0] - 2026-05-14

### Fixed
- Re-opening the side chat after Kick's native **Hide chat** button no longer renders an empty dark slot. Before moving the chat node, the script now sets `data-chat="true"` on every ancestor carrying that attribute so Kick's Tailwind `group-data-[chat=false]/main` rules stop hiding the chat once it lives inside our slot.
- Force `display: flex !important; visibility: visible !important;` on the chat slot's child element to defeat any leftover `hidden` / `display: none` from Kick's own classes.
- Added a `suppressObserver` flag so the script's own `data-chat` writes do not immediately re-trigger the tear-down observer.

## [0.4.0] - 2026-05-14

### Changed
- Hide our injected **Chat** button while the split layout is active — Kick already exposes a native **Hide chat** button inside the chat panel, and showing both is redundant.

### Added
- `data-chat` MutationObserver: when Kick's native hide button sets `data-chat="false"` on a player ancestor, the script tears down the split layout automatically. Net result: clicking Kick's native hide button returns the user to fullscreen video and re-shows our **Chat** button so chat can be re-opened.

## [0.3.0] - 2026-05-14

### Changed
- Replaced the custom **Show chat** / **Hide chat** button styling with Kick's exact native button markup. The injected button now uses Kick's own class string (`bg-surface-base`, `betterhover:hover:!bg-surface-highest`, `text-white`, `rounded`, etc.) and the same inline SVG icon Kick uses on its native chat-toggle button, so it inherits Kick's design tokens automatically.
- Wrapper is positioned with `top: 1.75rem; right: 1.75rem` to match Kick's `top-7 right-7` placement.
- The arrow SVG mirrors (`scaleX(-1)`) when the split layout is active so it visually points the opposite direction.

## [0.2.0] - 2026-05-14

### Added
- Console logging under the `[KickFullscreenChat]` prefix on button click, chat-discovery failure, and toggle errors to make it easier to diagnose issues in the browser console.
- Broader `CHAT_SELECTORS` list covering more class-name and `data-testid` variants.
- `findChatByInput()` fallback: locates the chat panel by walking up from a chat input/textarea whose placeholder matches `chat|message|send a message`, so the script survives Kick removing or renaming the chat container class.
- User-facing `alert` when no chat container can be found, with a pointer to the developer console for the attempted selectors.

### Fixed
- `try/catch` around the toggle handler so any error in the layout swap is surfaced as a `[KickFullscreenChat] toggle failed:` log line instead of silently failing.

## [0.1.0] - 2026-05-14

### Added
- Initial release.
- Injects a **Show chat** toggle button into the top-right of Kick's fullscreen player.
- On toggle, the script wraps the fullscreen element's children in a `.kfc-video-slot` and moves the chat panel into a `.kfc-chat-slot` flexed to a fixed `340px` width on the right, producing a Twitch-style fullscreen-with-chat layout.
- On second toggle (or when fullscreen exits), the chat node is restored to its original parent and original `nextSibling` insertion point, and the video children are unwrapped back into the fullscreen element.
- Listens to both `fullscreenchange` and `webkitfullscreenchange`, and only injects the button when the fullscreen target looks like the Kick player.
- `@grant none` — no GM_* APIs required; the script is pure DOM manipulation against `https://kick.com/*`.
