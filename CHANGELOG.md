# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.21.11] - 2026-08-23

### Fixed
- **A chat width set on a wide display could be permanently shrunk by opening Kick once in a narrow window.** The saved width is clamped on load, and the clamp includes a "never wider than 60% of the viewport" term — but at load time the only viewport available is the **windowed** one, which is the wrong one to measure a fullscreen layout against. Nothing re-clamps on fullscreen entry, and the fullscreen viewport is never narrower than the windowed one, so that term could only ever clamp too aggressively. On its own that would have been harmless (the width would come back next time), except the clamped-down number is what the next `persistSettings()` writes to storage — and that fires from *any* unrelated toggle, opacity nudge or dock-side switch. So a 640px chat set on a wide monitor, opened once in a 700px window, became 420px and stayed 420px. The load-time clamp is now the static 260–640px bounds only; the viewport term still applies on every divider drag and preset chip, where there is a live viewport to measure. Widths saved by earlier versions are unaffected — they were already within bounds — but a width already shrunk by this has to be set again once. A non-finite value in storage is now also rejected outright rather than being written through into `--kfc-chat-width`.
- **The error toast was the one node left behind in Kick's DOM when fullscreen exited.** `showToast` parents the toast to whatever element is fullscreen at the time, and nothing ever removed it — the chat slot, the resize divider, the stream-info overlay and the control cluster are all torn down on the way out, but the toast stayed. There was no visible symptom, since it settles back to `opacity: 0` a few seconds after it appears; the problem is that it is a foreign node stranded inside Kick's React-managed player subtree, which is the exact situation the rest of the script is built to avoid (moving nodes React owns, or leaving nodes where React doesn't expect them, is what trips its error boundary and 404s the page). It is now removed with the control cluster, along with its pending fade timer so nothing fires against a detached node. Only reachable at all if a toast had been shown — Kick's chat throwing, or the chat panel not being found — which is also exactly when the DOM is least worth leaving in an odd state.

## [0.21.10] - 2026-08-22

### Fixed
- **Clicking the video to resume a paused stream did nothing while the side chat was open.** It works everywhere else — windowed, and in plain fullscreen without the side layout — because Kick handles click-to-play/pause on the `<video>` element itself. The side-chat layout sets `pointer-events: none` on the marked video (0.9.7) so clicks fall through the video surface to Kick's controls underneath, which is what stops the player becoming unclickable after a background refresh; the same rule also stops any click ever reaching Kick's own play/pause handler. This is exactly the hole 0.9.9 patched for the *double*-click-to-exit-fullscreen gesture, which lives on the same element — the single-click half was simply never noticed. The script now attaches its own `click` handler on the fullscreen element while side chat is active, alongside the existing `dblclick` one. **It only ever resumes: a click on a playing stream does nothing.** Kick's own handler toggles, but a click that pauses is the one nobody means — it is what a mis-aimed click on the player, or the click that re-activates the window, turns into — and leaving it out also means the double-click that exits fullscreen has nothing to undo. Both handlers share one gate (`isVideoSurfaceClick`), so neither fires on the chat panel, on this script's own controls / settings panel / info overlay / divider / toast, on anything Kick makes interactive (buttons, links, sliders, menu items, inputs), or on the seekbar — whose click has to reach the teardown path instead. Only trusted clicks with `detail >= 1` count, so a sibling userscript driving the player's controls with synthetic clicks can't start playback; that is the same `isTrusted` rule 0.21.9 put on the control cluster.
- **The cursor stayed a plain arrow over a paused stream, so there was nothing to say it could be clicked.** Same root cause, one layer along: Kick sets `cursor: pointer` on the `<video>`, and the cursor comes from whichever element the pointer actually *hits* — which, with the video click-through, is whatever Kick has stacked under or over it, carrying its own cursor. An inherited cursor loses to an explicit one on the element that takes the hit, so a CSS rule on the marked video layers isn't enough on its own; the cursor is instead driven from the same two conditions the click uses. On each real `mousemove` inside fullscreen, and again whenever playback starts or stops under a stationary pointer, whatever the pointer is over gets `cursor: pointer` inline **if clicking it would resume the stream** — and the property is removed as soon as that stops being true (and on teardown), so nothing of Kick's is left rewritten. The pointer hand therefore appears exactly when there is something to click: while the stream is playing the cursor stays an arrow, because a click there is deliberately inert.
- **The docked chat went black about a second after the timeline and the script's own controls faded out.** When the configured hide delay is shorter than Kick's own, the script fades Kick's controls itself, and it locates them by finding the seekbar and climbing to the top of the subtree that doesn't contain the `<video>`. That search ran over the whole fullscreen element — which, with the side layout up, also contains the docked chat. Kick unmounts its controls while they're hidden, so at the moment the reapply pass runs there is often no seekbar left to find, and the next `[role="slider"]` in document order can be inside the chat; the climb then returns the *chat slot* itself, and it gets `opacity: 0 !important` like a controls overlay would. The one-second gap is the giveaway: the reapply is driven by DOM churn under the fullscreen element, and with the chat docked there its own message stream supplies that churn — so the mis-target lands a beat after the fade rather than with it. The lookup is now scoped to the marked player layers (with the whole fullscreen element kept only as a last-resort fallback), candidates inside this script's own UI are skipped, and whatever the climb produces is refused outright if it is the chat slot, one of our nodes, or an ancestor of the chat — logged when it happens, rather than silently blanking the panel. The reapply observer is scoped the same way, so ordinary chat traffic no longer wakes it at all.
- **The buffering spinner was centred on the screen instead of on the video.** The script marks Kick's full-coverage player layers so they shrink to the left of the chat, but it deliberately skips the ones that hold no controls — Kick's transient loading and blur overlays — because 0.9.7 turned those into transformed hit targets sitting above the timeline. Skipped entirely, though, they kept the full viewport's width while the player around them had been shrunk, so the spinner they centre landed at the middle of the screen: visibly off to the right of the video, drifting further the wider the chat. Those overlays are now marked separately (`data-kfc-video-overlay`) and given exactly two things — the player's current width and the docked-left shift — with no height, no overflow clipping and no restacking, so they are sized to the video area without getting the treatment that caused the 0.9.7 regression. The shift doubles as a containing block, so a `position: fixed` spinner inside one is centred on the video as well. In overlay mode, where the video keeps the full width, the rule resolves to no change.

## [0.21.9] - 2026-08-16

### Fixed
- **The settings panel flickered open and shut on entering fullscreen — and the cause was a *sibling* userscript, not a duplicate of this one.** 0.21.8 reasoned correctly that nothing inside one instance can move `settingsOpen` on its own, and then drew the wrong conclusion from it: that the only remaining explanation was a second copy of this script. It isn't. Traced on a live channel by instrumenting `DOMTokenList.prototype.toggle` for the `kfc-settings-open` class, the stack behind every unwanted flip was `toggleSettingsPanel ← wireControlButton's click handler ← dispatchEvent ← clickQuietly ← applyPreferredQuality ← tick` — kick-quality-saver, driving Kick's player controls to re-apply the preferred quality. Its gear lookup tries `button[aria-label*="settings" i]:not([aria-label*="chat" i])`, and this script labelled its own gear **"Open fullscreen settings"**: contains "settings", doesn't contain "chat", so it matched. On fullscreen entry Kick's own controls haven't mounted yet, so that lookup's first (icon-based) selector finds nothing and falls through to ours — and quality-saver then clicks what it believes is the quality menu up to three times a pass, toggling the panel with every click. The panel's ✕ ("Close fullscreen settings") matched the same selector. Two changes, either of which stops it: the controls' aria-labels are now **"Open/Close fullscreen chat settings"**, which is both more accurate and no longer a match for that selector; and `wireControlButton` now ignores any click with `isTrusted === false`. The second is the general fix — a script-dispatched `MouseEvent` carries `detail === 0`, which this script reads as a *keyboard* activation and deliberately waves past the parked-pointer guard, so any sibling script clicking its way around the player could fire our controls. A keyboard Enter/Space produces a **trusted** click, so Tab users are unaffected, and nothing in this script clicks its own controls. Verified: quality-saver's selector list matches the old labels and neither new one; a `MouseEvent` dispatched exactly as `clickQuietly` does is `isTrusted=false detail=0` and is ignored; a real mouse click is `isTrusted=true detail=1` and still activates.
- Note for anyone who read the 0.21.8 entry: the single-instance guard added there is still worth having, but it was not what this bug needed, and it cannot stop a *pre-0.21.8* duplicate — a copy without the guard neither sets nor reads `data-kfc-running` and simply runs anyway. The word "chat" in the two new aria-labels is load-bearing; it must also stay away from the leading verb, since `CHAT_TOGGLE_RE` / `SHOW_CHAT_RE` match `open|close|…` immediately followed by "chat" and a label like "Open chat settings" would make this script mistake its own gear for Kick's chat toggle.

## [0.21.8] - 2026-08-14

### Fixed
- **The settings panel flickered open and closed in fullscreen when two copies of the script were installed.** Nothing in a single instance can open or close the panel on its own — only a click on the gear moves `settingsOpen` — so the cause was outside it: a second copy of the userscript running on the same page. Every node the script owns is addressed by a fixed id, so the second instance's `ensureButton()` finds the *first* instance's `#kfc-toggle-wrap` and adopts it instead of building its own. From then on both instances write their own state onto the same element. `syncControlState()` runs on every idle tick and every mousemove, and it rewrites `kfc-settings-open` from whichever instance's `settingsOpen` flag it belongs to — so the copy that never saw the gear click slams the panel shut, the copy that did re-opens it on the next pointer movement, and the panel visibly flickers for as long as the mouse keeps moving. Reproduced on a live channel: with one instance the class is written once and stays; with two, a single mousemove produces `kfc-settings-open` on and off again inside the same millisecond. The script now marks the document root with `data-kfc-running` when it starts and any later copy stands down immediately, logging a `[KickFullscreenChat]` warning naming both versions so a duplicate install is visible in the console rather than showing up as UI that fights itself. The marker is a DOM attribute rather than a `window` property because userscript managers disagree on whether scripts share a JS context, but they always share the DOM.

## [0.21.7] - 2026-08-13

### Fixed
- **Closing the side chat with Kick's own hide-chat button took two clicks.** The script watches for clicks on Kick's chat toggle so it can put the chat node back before Kick's React re-renders around it, and because that button is icon-only — no text, no `aria-label`, no `title` — it has to recognise it by its SVG path data. The code assumed there was a single toggle whose icon was mirrored in CSS depending on the state. There are actually two separate buttons with two separately drawn icons: the floating **Show chat** one over the player, and the **Hide chat** one in the chat panel's own header. Only the "show" icon was ever in the signature list, so the hide button went unrecognised and the teardown fell back to watching Kick's `data-chat` attribute flip to `false`. That works only while Kick's internal state agrees with the attribute — and the script deliberately forces the attribute to `true` when it opens the chat, so if Kick's React still thinks chat is hidden the first click merely re-syncs the two (attribute goes to `true`, nothing tears down) and only the second click actually closes it. The hide button's icon is now in the signature list, so the teardown fires on the click itself and no longer depends on which way the attribute happens to move. Verified against Kick's live markup: the two toggles are the only matches on a 135-button page, and Kick's visually similar sidebar-collapse button is not one of them.
- **The lookup that re-syncs Kick when it thinks chat is hidden could have started clicking the wrong button.** Both toggles are in the DOM at the same time in both states — whichever one is inactive is either zero-sized or parked off-screen, never removed — so now that the script recognises both icons, the "click Kick's toggle to make it agree with us" lookup would have taken whichever came first in document order. It is now restricted to the show direction, by icon and by a narrower text match, so it can only ever drive Kick's state towards showing the chat.

## [0.21.6] - 2026-08-13

### Fixed
- **The settings panel could still open by itself on returning to the stream, because the guard against it was a stopwatch and the sequence it was timing isn't the only one.** 0.21.3 and 0.21.5 both assumed that coming back and clicking are a single gesture: the click that re-activates a backgrounded window lands within a frame of the focus event, so ignoring activations for 350ms after focus returns covers it. That is true when you click straight into a background window — but focus frequently comes back on its own first, with no click at all. Cmd-Tab, the dock icon, swiping back to a fullscreen Space, or simply an activating click that landed on the video all restore focus, and the click the user actually meant follows a second or two later, with the pointer still parked exactly where they left it. By then the 350ms have long expired and the guard doesn't just fail to block — it explicitly *allows* the activation, so whatever the pointer happens to be parked on takes the click, and near the top-right corner that is the gear. This is why the panel kept opening even after 0.21.5 closed the ordering race it was aimed at. There is now a second, untimed half to the guard: the controls ask whether the pointer has *moved* since the page was left, not how long ago focus came back. Nothing the user does in another app moves the pointer over this page, so an activation arriving with the pointer still sitting where it was left was aimed at whatever was last under it — not at the control the return parked it on. It has no window to lose a race against, since it is armed on the way out and cleared only by real pointer movement, and it swallows a single activation before disarming, so nudging the mouse or simply clicking again works normally. The settings panel's own controls are gated the same way, on the press as well as the click, so a cursor parked on a switch or slider can't flip it either.
- **An activation could slip through when the window's `blur` was never seen.** Focus can move into an iframe or the browser's own chrome without the top-level window getting a `blur`, which left the 0.21.5 latch unarmed for the whole trip. A focus regain the page *did* see is now enough on its own to distrust an activation landing right behind it, rather than only counting when the matching departure was also observed.

## [0.21.5] - 2026-08-09

### Fixed
- **The settings panel could still open by itself after an app or tab switch, because the guard meant to stop it was armed too late.** 0.21.3 added a 350ms window after the window regains focus during which the controls ignore activations, which is the right idea — but it started that window from the `focus` / `visibilitychange` handler, so the guard only existed once the return event had actually been delivered to the page. That assumes the return event always arrives before the click that re-activated the window, and it usually does; the focus change and the mouse event travel to the page by different routes, though, so the order isn't guaranteed. On the frames where the click won that race the guard was still unarmed and the click sailed through to the gear exactly as it did before 0.21.3 — which is why this stayed an occasional, unpredictable "it just opened again" rather than something reproducible on demand. The guard is now latched when the window or tab is *left*, which is unambiguously before anything else in the sequence, and it stays latched until the 350ms have been observed to pass, no matter when the return event turns up (or whether one turns up at all). Verified against every ordering: with the click delivered before the focus event, before the `visibilitychange`, or with no return event at all, the activation is dropped in each case, while an ordinary deliberate click — and a second click straight after it — still goes through.
- **A control left focused while the window sat in the background is now disarmed on the way out.** The browser restores focus to whatever was focused when you left, so returning to the stream and hitting Space to un-pause it could fire that control instead of the video. Pointer clicks have dropped focus since 0.20.1, but keyboard activations deliberately keep it so Tab users can operate the cluster, and for those the 350ms guard was the only thing standing in the way — wait longer than that before pressing Space and the control fired. Focus is now dropped as the window is left, which is the one point where doing so costs keyboard users nothing.

## [0.21.4] - 2026-08-08

### Fixed
- **The channel-points icon was rendered at half size in the docked chat, and the points value spilled out of its button.** This — not spacing — was the real reason the fullscreen action bar didn't match the windowed one. Measured on the live page, the icon came out at 8.5px against 16px windowed, and the value sat about 10px past its own button's right edge; 0.21.3's spacing work was correct but was fixing the wrong thing. Kick nests a second `w-full` wrapper between the channel-points button and the gift-shop button, and it asks for 100% of its parent. Windowed, the points button shrugs that off because flex items floor at `min-width: auto`; inside the chat slot the script forces `min-width: 0` on every descendant — which the chat message rows genuinely need in order to shrink — and that removes the floor, so the wrapper crushes the button. 0.21.3 released the forced width on the outer group and on the gift-shop's own span but never on that middle wrapper. It now does, and every measurement matches windowed exactly: 16px icons, 24px from the points value to the Kicks icon, 8px between the buttons, and the value back inside its button.

## [0.21.3] - 2026-08-08

### Fixed
- **The fullscreen settings panel could still open "randomly" after an app or tab switch — the third and last cause.** 0.20.1 fixed the keyboard-focus half and 0.21.1 fixed the fade half, but the fade guard only gates the case where the control cluster had actually faded away: switch back within the hide delay (2s by default), or turn **Auto-hide controls** off, and the cluster is still fully shown and armed, so there is nothing for that guard to gate. The click that re-activates a backgrounded window or tab is delivered straight into whatever sits under the parked cursor, and near the top-right corner that is the gear. The controls now ignore activations for 350ms after the window regains focus — the refocus click arrives within a frame, while a deliberate click takes far longer to aim — matching the guard kick-quality-saver's launcher has had. The same guard also swallows the reflexive Space/Enter (pausing the stream on return) that would otherwise fire whichever button the browser restored focus to.
- **Control buttons could stay focused after a press whose click never arrived.** Focus was dropped from the `click` handler, so a press that ended in a hover- or pointer-retargeted click — no `click` on the button — left it focused and armed for the next Space/Enter. The blur now happens on `pointerdown` as well, unconditionally, so a press always disarms the button whether or not it goes on to activate it.
- **Settings-panel controls could flip by themselves on return from another app.** With the panel open and the cursor parked over a switch or slider, the refocus click landed on that control and changed the setting. The panel now applies the same 350ms guard, on `pointerdown` as well as `click` because a slider's thumb jumps on the press rather than the click.
- **The chat's action bar was cramped in fullscreen compared to normal mode.** The row holding channel points, the Kicks gift-shop button, the settings gear and the green **Chat** send button had its padding and gaps squeezed — both buttons down to `.375rem` horizontal padding and every gap in the row to `.25rem` — so the channel-points value sat almost against the Kicks icon, noticeably tighter than the same bar outside fullscreen. Only one override was ever load-bearing: Kick's left button group carries a `lg:w-full` that keys off the *viewport*, which stays wide in fullscreen even when the chat panel is at its 260px minimum, so the group claimed the whole row and pushed the send button out of sight. Releasing that forced width is enough on its own; measured against Kick's markup at 260px the extra squeeze was reclaiming 29px the row never needed, and without it there is still ~9px spare with the send button at full size. Padding and gaps are now Kick's own — measured against Kick's markup, the gap from the points value to the Kicks icon (24px), between the two buttons (8px) and from the gear to the send button (8px) are identical docked and windowed, at every chat width and points value. The one gap that still differs is the elastic space between the Kicks button and the gear: that is leftover room, so it simply tracks how wide you've made the chat (~30px at the 260px minimum against ~89px for a windowed sidebar).
- **The settings panel ran off the bottom of the screen instead of scrolling.** It had no height cap and no overflow, so its ~660px of content — starting ~76px below the top of the fullscreen player — needed about 735px of room. That fits a 1080p or 900px-tall display, but on a 1280×720 screen, or at any browser zoom past ~110%, **Reset settings** sat below the bottom edge with no way to reach it, and each settings row added since made it worse. The panel now caps at `76vh` and scrolls, with the same thin translucent scrollbar the sibling kick-quality-saver panel uses. Both numbers are copied from that panel verbatim: it already scrolled, including the variant it docks into this script's own control cluster, so on the same screen and in the same fullscreen wrap one panel scrolled while the other clipped.

## [0.21.2] - 2026-07-31

### Fixed
- **`KickFullscreenChat.version` reported the wrong build.** The version lives in two places — the `@version` line in the metadata header (what your script manager shows) and a `VERSION` constant inside the script (what the console API returns) — and 0.21.1 bumped only the header. So a correctly updated 0.21.1 install answered `"0.21.0"` in the console, which is precisely the question the console API was added in 0.21.0 to answer. The constant now matches the header, and the agent notes carry a check for both so they can't drift apart again.

## [0.21.1] - 2026-07-30

### Fixed
- **The fullscreen settings panel could still open "randomly", for a second reason 0.20.1 didn't cover.** That release fixed the keyboard-focus half of the problem (the gear kept focus after a click, so a later Space/Enter re-activated it). The other half is a hit-testing one: the control cluster fades out when you go idle via `opacity: 0` plus `pointer-events: none`, but `pointer-events` is a discrete property — it flips back the instant the idle class is dropped, while `opacity` still has its full 200ms fade ahead of it, and an `opacity: 0` element is hit-tested normally. So from the first frame of the fade-in the cluster was fully clickable while still invisible. Any click arriving in that window landed on whichever control sat under the cursor instead of on the player — most often the gear, which sits in the middle of the cluster. The usual trigger is the click that re-activates the browser window on macOS: moving the pointer over the window un-idles the controls, and if the cursor happened to be parked near the top-right corner, the activating click opened the settings panel. The cluster now stays click-through until the fade has actually finished, so those clicks reach the player as intended. Panel children — this script's settings panel and the one kick-quality-saver mounts into the shared wrap — are exempt and stay interactive throughout.
- **Settings-panel controls kept keyboard focus after a mouse click**, so with the panel open the keys meant for the video were captured by the last control you touched. 0.20.1 taught the gear/mode/info/Chat buttons to drop focus after a pointer click but did not extend the rule to the panel's own controls. The visible effects: after clicking **Reset settings**, pressing Space to play/pause re-ran the reset; after clicking a switch such as **Dock chat on left**, Space toggled it straight back; after touching a slider, the arrow keys moved the slider instead of seeking. As with the gear, the browser also restored that focus when the window was re-activated, so a settings change could appear to happen on its own after an app switch. Width chips, switches, sliders, **Reset settings** and the ✕ now all drop focus after a pointer click. Keyboard (Tab) users keep their focus, and clicking a switch's label row — which reaches the checkbox as a synthetic keyboard-looking click — is handled too.

## [0.21.0] - 2026-07-19

### Added
- **Console API.** `KickFullscreenChat.debug()` toggles verbose logging at runtime and `KickFullscreenChat.version` reports the running build, matching the hooks the sibling kick-* scripts already expose. Debug logging previously required editing `const DEBUG` in the script and re-installing it.

### Changed
- The debug flag is persisted in the existing `kfc-settings` localStorage entry alongside your other preferences. Settings blobs saved by earlier versions have no `debug` key and load unchanged, defaulting to off.

## [0.20.3] - 2026-07-19

### Fixed
- **The viewer-count content fallback silently failed for five of its thirteen languages.** `VIEWER_COUNT_RE` — the pattern `findViewerCountSource()` falls back to when none of the `VIEWER_COUNT_SELECTORS` match — ended in `\b`. Outside the `/u` flag JavaScript's `\w` is ASCII-only, so a word boundary after a token ending in a non-ASCII letter can never match at the end of the string, which made the Russian (`зрителей`, `просмотров`), Czech (`diváků`) and Arabic (`مشاهد`) alternatives dead on arrival. Two more were corrupted script hybrids that matched no real text: `视聴者` mixed simplified-Chinese 视 with Japanese 聴 (Japanese is `視聴者`), and `시청者` mixed Korean 시청 with Chinese 者 while the correct `시청자` was already the next alternative. The guard is now `(?!\p{L})` with the `/u` flag and the two CJK tokens are corrected, so all thirteen locales match; as a bonus the lookahead also rejects `"770 viewership"`, which the old `\b` accepted. This was only reachable once Kick's direct viewer-count selectors stop matching, so in practice the badge would have gone missing from the fullscreen info overlay for those locales rather than misbehaving visibly.

## [0.20.2] - 2026-07-19

### Changed
- **The error toast now uses the kick-\* family surface.** Its background was pure black (`rgba(0,0,0,.88)`), the only surface in the family that wasn't `#101013` or a transparency of it — noticeably cooler than the sibling scripts' toasts sitting on the same page. It is now `rgba(16,16,19,.88)`: the same colour, same opacity, so it reads as the same material as kick-quality-saver's apply pill, kick-chat-utils' notices, and kick-vod-resume's resume toast. Border, radius and type are unchanged.

## [0.20.1] - 2026-07-15

### Fixed
- The fullscreen settings panel would sometimes open "randomly" after switching windows (notably on macOS). The control buttons (gear/mode/info/Chat) are native `<button>`s that keep keyboard focus after a mouse click, so after you clicked the gear the browser would restore focus to it when the window regained focus — and the next Space/Enter (e.g. pressing Space to pause the video) activated the still-focused gear and re-opened the panel. Control buttons now drop focus after a mouse click, so a later keypress goes to the player instead. Keyboard (Tab) users keep their focus.
- Settings panel toggle rows had uneven vertical spacing — the label/toggle rode high in each row with a large gap beneath it. The inset group added a `0.6rem` gap between every row on top of each toggle's own `7px` padding, so the spacing stacked up only below each row. Toggle rows are now grouped in a gap-less container (matching the sibling kick-quality-saver panel's switch list), so each row's `7px` top and bottom padding is the only spacing and the hairline separator sits centered between rows with equal padding above and below. When the toggle block ends a group its last row's bottom padding is pulled back so the group has equal padding at its top and bottom edges.

## [0.20.0] - 2026-07-10

### Changed
- **The fullscreen settings panel has been redesigned** to match the sibling kick-quality-saver panel. It now opens on a 14px-radius card with a titled header (icon mark, "Fullscreen Chat", and a ✕ close button styled like the Reset settings chip — a red glyph on the neutral chip surface, red tint on hover), and its rows are collected into three inset groups — **Chat** (width presets, dock side, overlay/fullscreen open behaviour), **Overlay** (opacity, stream-info backdrop, auto-hide overlay chat) and **Controls** (hide delay, auto-hide controls) — instead of one flat list. Reset settings stays at the bottom.
- **The panel's controls got a visual pass.** Chips have a green ring when selected and a press animation, switches animate their thumb, each row's live value (`340px`, `55%`, `4s`) reads as a green tag, and the panel rises into place when opened (respecting `prefers-reduced-motion`).
- The hide-delay and stream-info-backdrop sliders now use the same custom track and thumb as the overlay-opacity slider, so no native-looking control is left sitting among the styled ones. The opacity slider keeps its checkerboard track, which previews the transparency it controls.
- **The panel no longer applies `backdrop-filter: blur(10px)` to itself**, and no blurred backdrop was introduced behind it. Its surface is opaque, so the blur only cost a compositing layer over the video.

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
