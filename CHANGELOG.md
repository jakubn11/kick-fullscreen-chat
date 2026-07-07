# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.19.4] - 2026-07-07

### Changed
- The userscript's `@description` metadata (the description shown in script managers) no longer ends with a stray trailing period. No functional changes.

## [0.19.3] - 2026-06-09

### Fixed
- Dragging the divider to resize the side chat felt laggy. Every pointer move re-ran a full player relayout (a synthetic window `resize` that makes Kick's React player re-measure) and re-read the viewport width *after* the move had already dirtied the chat's layout — forcing repeated synchronous reflows of Kick's tall chat subtree, several per frame on high-polling-rate mice / high-refresh displays. The divider drag now coalesces width updates to one per animation frame, snapshots the viewport width at pointer-down so it never reads layout mid-drag, and defers the heavy player relayout to release, so resizing stays smooth.

## [0.19.2] - 2026-06-09

### Fixed
- The green **Chat** send button (and the rest of Kick's chat input action bar — channel points, gift shop, settings) was clipped at the right edge when the side chat was docked at its narrowest width. That action bar is sized for a wide chat (its left group spans the full width), so at the minimum panel width the send button was pushed off the row and clipped. The left group is now allowed to shrink and the buttons' padding/gaps are tightened at narrow widths, so the whole bar — including the send button — stays on one row and fully visible.

## [0.19.1] - 2026-06-09

### Fixed
- A horizontal scrollbar appeared at the bottom of the chat panel / message list when chat was resized to its minimum width. Kick's flex message rows weren't allowed to shrink below their content (badges + long username + emote cluster), and long words / URLs or oversized emotes overflowed the message scroll container, surfacing an unwanted horizontal scrollbar. The chat slot now lets descendants shrink, wraps long words / URLs, and constrains emotes and images to the panel width, so horizontal overflow is prevented at its source without affecting vertical message scroll.

## [0.19.0] - 2026-06-09

### Added
- **Drag-to-close on the resize divider.** Dragging the chat-width divider well past the minimum width (180px from the docked edge) now arms a release-to-close gesture: the chat slot dims while the gesture is armed, and letting go tears the side chat down. Pulling back above the threshold disarms it. Gives a quick mouse-only way to hide chat without aiming for Kick's Hide-chat button.

## [0.18.7] - 2026-06-09

### Fixed
- Side chat occasionally got stuck on Kick's "We are sorry, but something went wrong. Please try again later." error fallback after the stream had been running for a while, forcing a full page reload to recover. The script now watches for the chat error boundary while side chat is mounted, automatically tears the side layout down when it appears, and surfaces a "Kick chat errored. Click Chat to reopen." toast so the user can re-dock without reloading.

## [0.18.6] - 2026-05-28

### Changed
- The **Reset settings** button now turns red on hover/focus (keeping its shape) to signal it's a destructive action, instead of the default green hover.

## [0.18.5] - 2026-05-28

### Added
- A **Stream-info backdrop** opacity slider (0–90%, default 60%) in fullscreen settings, controlling the darkness of the streamer-info overlay's gradient backdrop. At 0% the backdrop is fully transparent (text stays readable via its shadow). Persisted across reloads.

## [0.18.4] - 2026-05-28

### Fixed
- **Open chat on fullscreen** (renamed from "Reopen chat on fullscreen") now works: when enabled, the side chat opens automatically every time you enter fullscreen. Previously it only reopened chat if it had been open when you last *exited* fullscreen in the same page session, so it never triggered after a page reload or on a first fullscreen entry. The behaviour no longer depends on an in-memory flag, so it honours the persisted setting.

## [0.18.3] - 2026-05-28

### Changed
- The settings panel's on/off options (dock left, auto-hide overlay chat, auto-hide controls, open chats as overlay, reopen chat on fullscreen) are now toggle switches instead of checkboxes, with the label on the left and the switch on the right. The underlying control stays a native checkbox for state and accessibility.

## [0.18.2] - 2026-05-28

### Added
- The chat-width preset buttons (Compact / Default / Wide / Max) now show which one is selected when it matches the current width, and the selection is restored after a page reload (the width is persisted). Resizing via the divider clears the highlight when the width no longer matches a preset.

## [0.18.1] - 2026-05-28

### Changed
- The **Overlay opacity** slider now has a custom gradient track that previews the effect — a transparency checkerboard on the low end fading into the near-opaque panel colour on the high end — so the difference between settings is visible at a glance.

## [0.18.0] - 2026-05-28

### Added
- **Settings now persist across reloads.** Chat width, dock side, overlay opacity, hide delay, and all the auto-hide / open-as-overlay / reopen / stream-info toggles are saved to `localStorage` and restored on the next page load. **Reset settings** clears them back to defaults.
- **Dock chat on the left.** A new setting moves the chat panel (and its resize divider) to the left edge; the video, bottom controls, and stream-info overlay shift to clear it. Works in both side-by-side and overlay modes.

### Changed
- Dropped the "no `localStorage`" guarantee — the script now writes a single `kfc-settings` key to remember preferences (still no network requests and no `GM_*` grants).

## [0.17.2] - 2026-05-28

### Fixed
- When the hide delay is set below Kick's native ~4s, Kick's timeline/controls no longer linger after our overlay fades. On idle the script now fades Kick's controls layer itself (opacity + pointer-events only — no height/layout changes, so the timeline stays anchored to the bottom) in sync with our overlay. The controls layer is located from the seekbar without ever touching the video layer, and a childList-only observer re-applies the fade if Kick re-mounts the controls mid-idle.

## [0.17.1] - 2026-05-28

### Fixed
- When the hide delay is set above ~4s, Kick's native timeline/controls no longer fade before our overlay. While the idle timer is pending, the script now resets Kick's own idle timer with untrusted synthetic `mousemove`s on the player (rather than overriding Kick's styles), timing the final nudge so Kick's controls fade together with our overlay at the configured delay.

## [0.17.0] - 2026-05-28

### Removed
- Removed **Auto-hide Kick controls** and all native Kick timeline/control overrides. The feature was unreliable against Kick's height-animated controls layer and could move the timeline away from the bottom of the player.

## [0.16.9] - 2026-05-28

### Fixed
- **Auto-hide Kick controls** keep-alive now preserves previously marked native-control nodes and restores their saved height before rescanning, so longer hide delays do not lose control of Kick's already-collapsed timeline row.

## [0.16.8] - 2026-05-28

### Fixed
- **Auto-hide Kick controls** now keeps native controls alive with a small re-apply loop while waiting for longer hide-delay values, preventing Kick's own shorter timer from winning before the userscript timer expires.

## [0.16.7] - 2026-05-28

### Fixed
- **Auto-hide Kick controls** now uses inline important styles plus a fullscreen controls MutationObserver, so Kick class/style changes during its own idle timer are re-overridden until the configured userscript hide delay expires.

## [0.16.6] - 2026-05-28

### Fixed
- **Auto-hide Kick controls** now marks the full chain of likely native controls ancestors, so Kick's inner height-animated timeline row is kept visible until the configured hide delay.

## [0.16.5] - 2026-05-28

### Fixed
- **Auto-hide Kick controls** now preserves the marked native control layer's measured height until the configured hide delay expires, preventing Kick's own height-collapse animation from hiding the timeline early.

## [0.16.4] - 2026-05-28

### Fixed
- **Auto-hide Kick controls** now marks the actual native controls nodes at runtime instead of relying on broad CSS selector guesses, so Kick's own delayed fade is overridden by the configured userscript hide delay.

## [0.16.3] - 2026-05-28

### Fixed
- **Auto-hide Kick controls** now targets Kick controls anywhere inside the fullscreen subtree, not only controls inside marked video-root layers, so the timeline and bottom controls hide on the configured userscript delay when Kick mounts them separately.

## [0.16.2] - 2026-05-28

### Fixed
- **Auto-hide Kick controls** now also forces Kick's native timeline/control layer visible before the configured hide delay expires, so Kick's own shorter idle timeout does not hide it early.

## [0.16.1] - 2026-05-28

### Fixed
- The opt-in **Auto-hide Kick controls** setting now also hides Kick's separate bottom seekbar container, preventing the green progress line from remaining after controls fade.

## [0.16.0] - 2026-05-28

### Added
- Added an opt-in **Auto-hide Kick controls** setting that hides Kick's native fullscreen timeline / bottom control row on the same hide-delay timer as the userscript UI.

## [0.15.0] - 2026-05-28

### Added
- Added settings to reset all session UI options, keep the fullscreen control cluster visible while idle, and choose whether the **Chat** button opens directly into overlay mode.

## [0.14.1] - 2026-05-28

### Changed
- Removed the precise chat-width slider plus the overlay-mode and stream-info checkboxes from the fullscreen settings popover; those remain controlled by the divider and top-level buttons.

## [0.14.0] - 2026-05-28

### Added
- Extended the fullscreen settings popover with a precise chat-width slider, a hide-delay slider, and checkboxes for overlay chat mode and stream-info visibility.

## [0.13.1] - 2026-05-28

### Fixed
- Overlay-chat auto-hide now also fades the resize divider, so no vertical divider line remains over the video after the chat fades out.

## [0.13.0] - 2026-05-28

### Added
- Added a fullscreen settings popover behind a new gear button. It controls overlay-chat opacity, chat-width presets, overlay-chat idle auto-hide, and whether an open chat should reopen on the next fullscreen entry in the same page session.
- Double-clicking the video/chat divider now resets chat width to the default 340px.
- Chat lookup failures now show a more actionable toast and log selector/input diagnostics to the console.

## [0.12.1] - 2026-05-28

### Fixed
- Fullscreen controls now track the chat divider immediately while resizing instead of lagging behind the drag animation, and Kick's own player controls receive live resize nudges during the drag.

## [0.12.0] - 2026-05-28

### Added
- **Resizable chat width.** A draggable divider sits between the video and the side chat; drag it left/right to set how wide the chat panel is. The width is clamped (260–640px, never past 60% of the screen) and remembered for the rest of the session (resets on page reload).
- **Overlay chat mode.** A new layout-mode toggle (top-right, shown while chat is open) switches between side-by-side (video shrinks) and overlay (chat floats semi-transparently over the full-width video, Twitch-style). The button shows a pressed/green state while overlay mode is on.
- **Show/hide stream info.** A new toggle (top-right) hides or shows the fullscreen streamer-info overlay for a cleaner picture.

## [0.11.26] - 2026-05-28

### Changed
- The category link (e.g. "IRL") in the fullscreen streamer-info overlay is now rendered at a heavier font weight so it matches the streamer name, title, and viewer-count text instead of looking thin.

## [0.11.25] - 2026-05-28

### Changed
- Redesigned the fullscreen **Chat** toggle button to match the sibling `kick-emotes` userscript's design language: a dark `#101013` glass surface with a translucent border, blur backdrop, layered shadow, and a single green (`#22c55e`) icon accent — instead of reusing Kick's native button classes. Disabled and hover states are now painted by the script.

## [0.11.24] - 2026-05-28

### Changed
- The fullscreen streamer-info overlay now sits on a subtle dark gradient backdrop (with padding and rounded corners) instead of being fully transparent, so the streamer name / title / category / viewer count stay readable over bright video.

## [0.11.23] - 2026-05-27

### Fixed
- The fullscreen side chat no longer collapses immediately after enabling when Kick's internal React state thinks chat is hidden (which happens after the first close, on streams where the user previously hid chat, etc.). `enableSideChat()` now synchronises Kick's state by programmatically clicking Kick's own chat-toggle button (`findKickChatToggleBtn()`) before moving the chat node into our slot. As a safety net for sessions where the button can't be located, the `dataChatObserver` now ignores a single React-reconcile flip back to `data-chat="false"` within a 500ms window after enable and re-asserts `"true"`, so the layout survives the initial reconcile pass.

## [0.11.22] - 2026-05-27

### Fixed
- Closing the fullscreen side chat on a re-opened session (chat opened → closed → opened again) used to require two clicks: after the first close Kick's internal "is chat shown" state is "hidden", so when our side layout re-opens Kick renders the toggle as a floating button **outside** the chat panel — which our chatSlot-scoped click listener never saw. The capture-phase click handler now listens at the document level (still gated on `active`), so it catches the chat-toggle button wherever Kick mounts it and tears down on the first click.

## [0.11.21] - 2026-05-27

### Fixed
- Closing the fullscreen side chat now reliably tears down on a single click even when Kick's chat-toggle button renders as an icon-only control (no text, aria-label, or title). The capture-phase click handler now also identifies the button by its SVG path signature, on top of the existing text/aria/title match across both `hide`/`close`/`collapse` and `show`/`open`/`expand` directions.

## [0.11.19] - 2026-05-26

### Removed
- Removed the `C` keyboard shortcut for toggling fullscreen side chat; the **Chat** button is now the only side-chat toggle.

### Fixed
- The fullscreen viewer-count badge now syncs Kick's rolling digit `style` / `class` attribute updates into the existing cloned badge, so the number updates more promptly without recloning the whole overlay or interfering with tooltip portal clones.

## [0.11.18] - 2026-05-26

### Changed
- Fullscreen overlay clicks on streamer avatar/name/category now exit fullscreen and then dispatch a click on Kick's original in-page element, preserving Kick's native SPA/miniplayer behavior instead of routing by URL directly.

## [0.11.17] - 2026-05-26

### Fixed
- Popover clones now take a couple of delayed one-shot re-clones after adoption, so native Kick emote-name tooltips that become visible/positioned via attribute-only updates still appear in fullscreen without observing animation attributes forever.
- Popover clone descendants now inherit the top fullscreen z-index so nested tooltip content cannot sit behind the info overlay or chat slot.

## [0.11.16] - 2026-05-26

### Fixed
- Native Kick popover clones, including emote-name tooltips, are now explicitly stacked above the fullscreen info overlay.
- Viewer-count observers no longer watch inline attribute animation on Kick's rolling digits, avoiding constant overlay reclones that could interfere with tooltip portal cloning.

## [0.11.15] - 2026-05-26

### Changed
- Clicking streamer avatar/name or the category link inside the fullscreen overlay now exits fullscreen before navigating, matching Kick's normal non-fullscreen behavior where the stream minimizes into the page view.

## [0.11.14] - 2026-05-26

### Changed
- The fullscreen info overlay text is now selectable, and cloned links/buttons inside the card can receive pointer events.
- Streamer avatar/name affordances in the cloned overlay now navigate to the current channel when Kick rendered them as non-link buttons, while category links remain clickable through their cloned `href`.

## [0.11.13] - 2026-05-26

### Changed
- The fullscreen category link now strips inherited background, box shadow, and text shadow so it renders transparently over the video.

## [0.11.12] - 2026-05-26

### Changed
- The fullscreen viewer-count badge now strips inherited text shadow and box shadow from the badge subtree so the green count renders over a transparent background.

## [0.11.11] - 2026-05-26

### Changed
- The fullscreen viewer-count badge now keeps Kick's `Viewers` label visible next to the green count and forces the label to white for contrast.

## [0.11.10] - 2026-05-26

### Fixed
- The fullscreen viewer-count badge no longer overrides Kick's animated digit descendants with custom font weight or line height, preventing the rolling digits from splitting vertically.

## [0.11.9] - 2026-05-26

### Fixed
- The fullscreen viewer-count badge now preserves Kick's own animated digit component instead of rebuilding the number from `textContent`, which was unreliable because the source contains hidden rolling digits.
- Viewer-count updates now observe attribute changes on the compact badge so Kick's inline transform-based digit updates are reflected in the fullscreen overlay.

## [0.11.8] - 2026-05-26

### Fixed
- The fullscreen viewer-count badge is now normalized to a cloned icon plus a freshly rendered green number, matching Kick's compact non-fullscreen badge and avoiding stale/nested text-node glitches when the count updates.

## [0.11.7] - 2026-05-26

### Fixed
- The fullscreen info overlay now detects the first numeric run anywhere inside the cloned viewer-count badge, so the viewer number turns green even when Kick wraps or prefixes the badge text differently.

## [0.11.6] - 2026-05-26

### Changed
- The fullscreen info overlay now colors only the viewer-count number green while keeping the label and icon white.
- The separator between category and viewer count is now a CSS-drawn white circle instead of a text glyph, so it renders as a round dot rather than a square.

## [0.11.5] - 2026-05-26

### Changed
- The fullscreen info overlay separator dot between the category and viewer count is now larger, fully white, and uses the same shadow as the surrounding overlay text.

## [0.11.4] - 2026-05-26

### Changed
- The fullscreen info overlay now forces the inlined viewer-count badge text and icon to white and strips the badge background/border to transparent, including cloned child nodes whose Kick styles were overriding the overlay CSS.

## [0.11.2] - 2026-05-26

### Changed
- Streamer-name font-size in the overlay reduced from `1.4em` to `1.15em`. The 1.4em was overshadowing the rest of the card on layouts with a longer username; 1.15em + `font-weight: 700` keeps the visual hierarchy without dominating the overlay.
- Overlay max-width bumped from `min(50%, 600px)` to `min(60%, 720px)`, and the title's truncate / line-clamp container is now forced to `max-width: 100%; width: 100%` so the 2-row title clamp fills the wider container instead of inheriting Kick's tighter `max-w-*` utility (which they use because the in-page layout shares space with follow / subscribe buttons that aren't in our overlay).
- `transformClonedCard` now also hides the chevron / dropdown-indicator button next to the title (a `<button>` containing only an `<svg>` — no text, no image). On Kick's page that button opens an "expand title / description" popover; in our detached overlay clone the popover isn't wired up so the button does nothing, and it looked broken sitting next to the title. Verified-badge buttons (those with aria-label "verified") and avatar-wrapping buttons (containing an `<img>`) are exempted from the hide rule.

## [0.11.1] - 2026-05-26

### Changed
- The fullscreen info overlay no longer renders Kick's tag row (e.g. `Czech`, `irl`, `czech`, `vanlife`) below the title, and the standalone viewer-count badge that was added in 0.10.6 has been moved inline. The bottom row now reads `IRL · 682 Viewers` — the category link with the viewer count appended after a `·` separator, sharing the same row. A `transformClonedCard` pass runs after every clone/reclone: it locates the category link, hides each of its tag-pill-shaped siblings (short text, no images / headings — leaves the category and any structural content alone), and inserts a separator + the viewer-count clone right after it.

## [0.11.0] - 2026-05-26

### Added
- Keyboard shortcut `C` toggles the side chat while the Kick player is fullscreen, matching Twitch's convention. Skipped when the user is typing (input / textarea / contenteditable — covers Kick's chat input so typing the letter 'c' in chat doesn't close it), when a modifier key is held (so `Cmd+C` / `Ctrl+C` copy still works), when the fullscreen target isn't a Kick player container, and while the video is mid-reload (mirrors the **Chat** button's disabled state so the shortcut can't trigger the 404 the button protects against).

### Fixed
- The fullscreen info overlay would freeze on stale data if Kick re-mounted the channel-info card or the viewer-count badge while we were still in fullscreen (SPA channel navigation, React reconciler swap). Our `MutationObserver` was stuck on the orphaned original. A new body-level observer (`startInfoSourceWatcher` / `stopInfoSourceWatcher`) now detects when our tracked sources detach from `document.body` and, on the next animation frame, re-runs `findStreamerInfoSource` / `findViewerCountSource`, re-attaches the per-source sync observers, and re-clones into the overlay. The watcher starts when the overlay mounts and stops when fullscreen exits. The viewer source is only refound if one was present at mount time — we don't keep searching when Kick never rendered a viewer-count badge in the first place.

## [0.10.6] - 2026-05-26

### Added
- The fullscreen info overlay now also includes Kick's viewer-count badge (e.g., `770 Viewers`). The badge is cloned from a separate DOM element via `VIEWER_COUNT_SELECTORS` (data-testid first, then a content-based fallback matching a number followed by a viewer-y label in common languages — English, Czech, French, German, Polish, Russian, Spanish, Italian, Japanese, Korean, Arabic) and appended below the streamer card clone as a sibling. A dedicated `MutationObserver` on the badge source feeds into the same rAF-debounced reclone path as the streamer card, so viewer-count ticks update the overlay live without re-finding the source.

## [0.10.5] - 2026-05-26

### Fixed
- The streamer info overlay was still missing the avatar and streamer name on some Kick layouts. The category-link walk landed on the title+tags sub-row whenever that row contained both a profile link back to the streamer (used to make the title clickable) and an `<img>` (an emote or status icon), satisfying the `hasStreamerNameSignal + img` check earlier than the actual card row above. The heuristic now runs an **avatar-anchored search first**: it locates the streamer's avatar via `a[href="/${username}"] img/picture` (case-insensitive), then walks up until it hits an ancestor that also contains a category link. The avatar is unique to the full card, so this finds the avatar + name + title + game + tags row reliably. The older category-link walk remains as a fallback.

### Changed
- The streamer name is now visually dominant in the overlay. Headings (`h1` / `h2` / `h3`) and common name-class patterns (`[class*="username"]`, `[class*="streamer-name"]`, `[class*="channel-name"]`) are forced to `font-size: 1.4em; font-weight: 700; color: #fff` so the name reads as the top element with the title in smaller text below, matching the visual hierarchy of Kick's own compact channel-info card.
- The 2-row title clamp now explicitly excludes headings (`[class*="truncate"]:not(h1):not(h2):not(h3)` etc.), so a long username doesn't wrap to a second line.
- The follow / subscribe / share / notification hide rule no longer uses the broad `button:not(:has(img))` pattern. It now targets buttons by `aria-label` (follow / subscribe / notif / share) plus `a[href*="/follow"]` / `a[href*="/subscribe"]`. The older rule was unintentionally hiding text-only buttons that wrapped the streamer name on some Kick layouts.

## [0.10.4] - 2026-05-26

### Changed
- The stream title inside the fullscreen info overlay is no longer clipped to a single row with an ellipsis. Kick applies Tailwind's `truncate` / `line-clamp-1` utility class to the title in their normal page layout because horizontal space is tight there; in the fullscreen overlay there's more room, so the overlay now overrides those classes to allow up to 2 rows before clipping. Short titles still fit on 1 row (no extra space reserved); long titles wrap to a second row and only get the `…` ellipsis past row 2.

## [0.10.3] - 2026-05-26

### Fixed
- The content-based streamer-card heuristic added in 0.10.2 returned the title + tags sub-row instead of the full card on Kick's current layout, so the overlay rendered without the avatar / streamer name / viewer count. The heuristic now requires the matched ancestor to contain a streamer-name signal — an `h1` / `h2` / `h3`, *or* a link back to the streamer's own profile (derived from the URL path, e.g. `a[href="/spajKK"]`) — in addition to the existing avatar-image and category-link requirements. The walk skips the title-only row and returns the full card.

### Changed
- The streamer info overlay no longer renders a black-to-transparent gradient backdrop. The cloned card is now drawn directly over the video with a Twitch-style text shadow propagated to all descendants (`0 1px 3px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)`), so the overlay stays readable on bright scenes without the rectangular shaded panel users found visually distracting.
- The CSS rule that hides follow / subscribe / share controls inside the clone now uses `button:not(:has(img)):not(:has(picture))`, so a button that wraps the avatar image (Kick sometimes does this for the "go to profile" affordance) is kept and the avatar renders correctly. The previous broad `button { display: none }` plus `[class*="follow" i]` rule could clip the avatar on some Kick variants.

## [0.10.2] - 2026-05-26

### Fixed
- The streamer info overlay added in 0.10.0 didn't appear in fullscreen because none of the static selectors in `STREAMER_INFO_SELECTORS` matched Kick's current channel-page markup. The script now falls back to a content-based heuristic: it walks up from any `a[href*="/categories/"]` link (every live channel page has one inside the streamer card next to the avatar / title / viewer count) until it finds an enclosing element that has reasonable card dimensions, contains an avatar `<img>` / `<picture>` / `[class*="avatar"]`, and doesn't wrap the player itself (so we don't accidentally clone the player). The first such ancestor on the walk-up is the smallest valid match, which is the streamer card. The known selectors are still tried first, so the heuristic only runs as a fallback.
- The "no streamer info source found" path now logs via `console.warn` (always visible) instead of `log` (DEBUG-only), so users know why the overlay didn't appear and where to add a selector if Kick changes markup again.

## [0.10.1] - 2026-05-26

### Fixed
- Popover sync observer was watching attribute mutations on cloned popovers despite the design doc and changelog (added in 0.9.8) saying attribute mutations are deliberately not synced. Radix / Floating UI flip `data-state` / inline `style` on every animation tick, so the observer was firing dozens of times per second per visible popover and re-cloning the whole popover subtree on each tick — wasteful even though CSS transitions don't restart on element replacement. The sync observer now only listens for `childList` + `characterData` mutations (matching the documented intent), so re-clones only happen when the popover's actual content changes.

### Performance
- `videoSwapObserver` (watches for Kick swapping the `<video>` element on quality / DVR exit) was attached to the whole fullscreen subtree with `subtree: true`, so every chat-message DOM mutation while side chat was active fired the callback and ran a fresh `fsEl.querySelector('video')` and equality check. Busy streams could trigger this hundreds of times per minute. The observer now skips mutation batches whose targets are all inside `chatSlot`, mirroring the filter `videoRootObserver` already uses. Video-element swaps still re-attach the monitor as before; chat-message churn is ignored.

## [0.10.0] - 2026-05-26

### Added
- Twitch-style streamer info overlay in fullscreen. While the Kick player is fullscreen, the avatar / streamer name / verified badge / stream title / game + viewer count from Kick's channel-info card is cloned into the top-left of the fullscreen element so the user can see who they're watching without exiting fullscreen. The overlay fades in and out together with the **Chat** button via the existing `kfc-idle` class — so it appears when the timeline / controls appear (on mouse move) and disappears with them after 4 seconds of inactivity, matching Twitch's overlay behaviour. The overlay is non-interactive (`pointer-events: none`) so clicks pass through to the player, and follow / subscribe / share / notification controls inside the cloned card are hidden via CSS so the overlay stays compact. A debounced `MutationObserver` on the source card re-clones when its content changes (title edit, viewer count tick, etc.), so the overlay stays in sync without restarting any animations.

  Cloning rather than moving the card mirrors the popover approach added in 0.9.8: Kick's React reconciler may unmount or replace the channel-info card in the background, and moving the original would leave it where React doesn't expect it. The clone in fsEl is what the user sees; the original stays in its normal DOM location for React to manage.

## [0.9.9] - 2026-05-24

### Fixed
- Double-clicking the video to exit fullscreen worked in the plain fullscreen layout but did nothing once the side chat was open. Kick's native double-click handler lives on the `<video>` element, and the marked `<video>` runs with `pointer-events: none` while side chat is active (introduced in 0.9.7 so clicks pass through to the controls), which also blocks the native dblclick. The script now attaches its own `dblclick` listener on the fullscreen element while side chat is active and calls `document.exitFullscreen()` on it. Double-clicks inside the chat slot (text selection, message UI) and on interactive controls (buttons, sliders, links, inputs) are ignored, so only video-area double-clicks tear fullscreen down. The listener is removed in `disableSideChat`, so Kick's native handler resumes responsibility once side chat closes.

## [0.9.8] - 2026-05-24

### Fixed
- Emote-name tooltips no longer appeared when hovering chat emotes inside the fullscreen side-chat layout. Kick renders those popovers as direct children of `document.body`, and the Fullscreen API only displays descendants of the fullscreen element, so the popovers were invisible even though Kick was still rendering them. While the side chat is active, the script now watches `document.body` for new popover-shaped elements (matching `[role="tooltip"]`, `[data-radix-popper-content-wrapper]`, `[data-radix-portal]`, `[data-floating-ui-portal]`, or `[data-popper-placement]`) and renders a deep-cloned copy of each one inside the fullscreen element. The clone inherits Kick's class names and viewport-relative inline styles, so it picks up the same global / Tailwind styling and renders at the same screen position as the (hidden) original. A per-popover sync observer re-clones whenever the original's subtree changes (`childList` / `characterData` mutations), because React often mounts the popover wrapper first and writes the tooltip content into it on a later commit — without the sync, the initial clone would be the empty wrapper. Attribute mutations are deliberately not synced, so the fade-in animation Kick drives via `data-state` / `style` attributes isn't restarted on every animation tick. The clone is removed when the original is removed from `document.body`. The observer is torn down — and any tracked clones / sync observers are removed — when side chat closes or fullscreen exits.

  Cloning was chosen over moving the popover because Kick uses React `createPortal` to render tooltips with `document.body` as the portal container. React's unmount path calls `body.removeChild(popover)` on cleanup. A moved popover is no longer in `body`, so `removeChild` throws `NotFoundError`, Kick's error boundary catches it, and the page navigates to its 404 / "We are sorry, something went wrong" page (with the moved popover stranded on top of the 404). Cloning leaves the original in place where React expects it.

## [0.9.7] - 2026-05-16

### Fixed
- After the stream sat in the background with side chat open, Kick's loading/blur overlay could remain above the player and block clicks on the play button and timeline. The script now marks only the video owner and likely control layers, instead of every large fullscreen overlay, and the marked `<video>` ignores pointer events so clicks can reach Kick's controls.
- Removed the aggressive viewport-sized rule added in 0.9.6 for marked videos. Video sizing now comes from the shrunken player root and frame chain, which avoids leaving the video/loading surface as a top-level hit target after Kick refreshes the player.

## [0.9.6] - 2026-05-16

### Fixed
- The video picture could still remain full-width while the timeline shrank when Kick exposed the `<video>` itself as a direct fullscreen layer. The direct video layer now keeps the shrunken root width instead of being reset to `width: 100%`, and the script marks direct video roots with the same video-sizing guard used for nested videos.
- The video layer refresh now watches player subtree changes, not only direct fullscreen-child swaps, so late-mounted or replaced video elements are constrained while chat is open.

## [0.9.5] - 2026-05-16

### Fixed
- Opening side chat could shrink Kick's timeline / controls correctly while leaving the actual video picture full-width behind the chat panel. Kick can size inner video wrapper elements from the viewport, so the script now marks the wrapper chain around the `<video>` and constrains those frames to the same shrunken player area.

## [0.9.4] - 2026-05-15

### Fixed
- Chat messages couldn't be selected (and therefore couldn't be copied) inside the fullscreen side-chat layout. Kick's fullscreen player container has `user-select: none` to keep the video / controls non-selectable, and once we moved the chat panel into our slot inside the fullscreen element, it inherited that. CSS now forces `-webkit-user-select: text` / `user-select: text` on `.kfc-chat-slot` and its descendants, so chat messages are selectable and copyable again.

## [0.9.3] - 2026-05-15

### Fixed
- Other Kick userscripts that re-parent floating overlays into `document.fullscreenElement` (e.g. `kick-emotes`' autocomplete popup and emote-name tooltip) rendered *behind* the side-chat panel. Our `.kfc-chat-slot` was `position: fixed; z-index: 2147483646`, and any sibling overlay with a normal `z-index` (kick-emotes uses 9999 / 99999) lost the stacking comparison. The huge value was a copy-paste from the toggle button (where it has to sit on top of the video) and unnecessary on the chat slot — `position: fixed` already creates a stacking context, and the slot is appended after Kick's player layers so it renders on top by DOM order. Dropping the explicit `z-index` lets sibling overlays appear in front of the chat panel as expected.

## [0.9.2] - 2026-05-15

### Fixed
- The **Chat** button was only disabled by `loadstart`/`emptied`/`canplay`/`loadeddata` listeners, so it stayed clickable through other "video not ready" states — mainly mid-playback buffering (`waiting`, `stalled`) and seeks. The video monitor now also listens for `waiting`, `stalled`, `seeking`, `seeked`, `playing`, and `pause` and re-runs `updateBtnLabel`, which already reads `video.readyState` directly. The result: the **Chat** button is disabled whenever the video is loading or buffering in fullscreen, not just during full reloads.
- The **Chat** button stayed clickable through a quality change / seek / "Go to live" when the side chat was *not* yet open, because the capture-phase reload-detection handlers (`onDocClickCapture`, `onDocPointerDownCapture`) bailed out on `!active` before raising the `videoReloading` flag. The button only disabled later, once the `<video>` fired `loadstart` — leaving a window where a user could click **Chat** mid-reload and trigger the 404. The handlers now raise `videoReloading = true` synchronously regardless of chat state (and still tear down the layout preemptively when chat is active). A 5s safety timeout (`RELOAD_SAFETY_MS`) releases the flag if the click doesn't actually reload the player (e.g. clicking the already-selected quality), so the button isn't stuck disabled.
- The side-chat layout could navigate to Kick's 404 / "Oops, something went wrong" page after sitting open in fullscreen for a while (typical trigger: leaving the stream playing in fullscreen on a background macOS Space for a few minutes). Root cause: the script wrapped Kick's fullscreen children in a `.kfc-video-slot`, and a later background React refresh would try to remove a node from its original parent (`fsEl`), find it inside our wrapper, throw, and Kick's error boundary navigated to 404. The script now leaves Kick's player nodes parented to `fsEl` and marks the full-coverage player layers in place with `data-kfc-video-root` — CSS shrinks them to `calc(100% - 340px)` and creates a containing block for their fixed/absolute descendants. The chat panel docks as a `position: fixed` slot on the right. A small `MutationObserver` re-marks replacement layers when Kick swaps them. Selection is restricted to direct `fsEl` children that cover ≥70% of the viewport in *both* dimensions, so popovers (quality / settings menu) aren't dragged into the shrink.

## [0.9.1] - 2026-05-15

### Fixed
- The **Chat** button faded out a touch earlier than Kick's own timeline / controls overlay, leaving the button gone while the timeline was still visible. Bumped `IDLE_MS` 3000 → 4000 so the fade lines up with Kick's controls.

## [0.9.0] - 2026-05-15

### Added
- The **Chat** toggle button now fades out when the user is idle on the fullscreen player, mirroring how Kick's own controls overlay disappears after a few seconds of no mouse movement. Any `mousemove` on the fullscreen element brings the button back instantly. Idle timeout is `IDLE_MS = 3000` (3 seconds). Only applies while in fullscreen and while the side chat is *not* active (when chat is open Kick's native **Hide chat** button takes over and our toggle is hidden via `display: none` regardless of idle state).

## [0.8.5] - 2026-05-14

### Added
- `icon.svg` — a green chat-bubble icon on Kick's near-black background. Wired into the userscript header via `@icon` so userscript managers display it next to the install dialog and update banner, and embedded at the top of `README.md`.

## [0.8.4] - 2026-05-14

### Changed
- Added `@author jakubnl94@gmail.com` and `@license GPL-3.0-only` to the userscript metadata header so userscript managers show author and license info next to the install dialog and update banner.

## [0.8.3] - 2026-05-14

### Fixed
- The **Chat** button stayed clickable across a quality change, defeating the 0.8.1 protection. Root cause: when `disableSideChat` ran from the capture-phase quality handler, it called `startVideoLoadingMonitor`, which unconditionally detached the previous video listeners (nulling `fullscreenVideoEl`) and then re-attached to the same `<video>` element. The "video element changed and is already past readyState 2" branch in `tryAttach` then mistakenly synthesized an `onVideoLoaded()` call against the *stale* `readyState=4` the old element still reported, starting the 750ms grace timer and re-enabling the button before Kick had even begun the reload. The synthesize-on-already-ready path now compares against the *previous* video element captured before the detach, so re-attaching to the same element waits for the real `loadstart` → `loadeddata`/`canplay` sequence and only genuine element swaps go through the synthetic fast path.

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
