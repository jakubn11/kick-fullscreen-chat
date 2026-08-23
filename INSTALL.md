# Kick Fullscreen Chat — Installation

Adds a Twitch-style **side-by-side fullscreen-with-chat** toggle to Kick.com.

## Safari (recommended)

Safari requires a userscript host app. **[Userscripts](https://apps.apple.com/app/userscripts/id1463298887)** (free, by Justin Wasack) is the recommended one.

1. Install **[Userscripts](https://apps.apple.com/app/userscripts/id1463298887)** from the Mac App Store.

2. Open Safari → **Settings** → **Extensions** → enable **Userscripts**.

3. Click the Userscripts toolbar icon and choose a folder to store your scripts  
   (e.g. `~/Documents/Userscripts`).

4. Copy `kick-fullscreen-chat.user.js` into that folder — Userscripts picks it up automatically.

   Alternatively, click the Userscripts icon while on any page and use  
   **"Open Scripts Directory"** to locate the right folder.

## Other browsers (untested)

The script is pure DOM manipulation and uses `@grant none`, so it should work with **any** userscript manager — none of the manager-specific GM_* APIs are needed. Tested only on Safari + Userscripts; the rest are listed for reference.

**[Tampermonkey](https://www.tampermonkey.net)** (Chrome, Firefox, Edge, Safari, Opera):
1. Install the Tampermonkey extension for your browser.
2. Open the Tampermonkey dashboard → **Create a new script**.
3. Replace the default content with the contents of `kick-fullscreen-chat.user.js` and save.

**[Violentmonkey](https://violentmonkey.github.io)** (Chrome, Firefox, Edge):
1. Install the Violentmonkey extension.
2. Click the Violentmonkey icon → **+** → **New script**.
3. Paste the contents of `kick-fullscreen-chat.user.js` and save.

**[Greasemonkey](https://www.greasespot.net)**:
1. Install the Greasemonkey add-on from [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/greasemonkey/).
2. Click the Greasemonkey icon → **New user script…**.
3. Fill in any name, click **OK**, then paste the contents of `kick-fullscreen-chat.user.js` over the template and save.

**[ScriptCat](https://scriptcat.org)** (Chrome, Firefox, Edge):
1. Install the ScriptCat extension.
2. Open the ScriptCat manager → **+** → **New script**.
3. Paste the contents of `kick-fullscreen-chat.user.js` and save.

**Other managers** (e.g. AdGuard, Stay for Safari, Userscript Loader): the install flow is the same — create a new script in the manager's UI and paste the file contents. Auto-update via `@updateURL` works in any manager that honours that directive.

## How it works

| Trigger | Behaviour |
|---------|-----------|
| Enter fullscreen on a Kick channel | Script injects a top-right control cluster — a **Chat** toggle plus icon buttons for layout mode, showing/hiding the stream-info overlay, and opening fullscreen settings — styled to match the sibling kick-third-party-emotes userscript. |
| Click **Chat** | Marks Kick's full-coverage player layers in place with `data-kfc-video-root` so they shrink to `calc(100% - var(--kfc-chat-width))`, and docks the chat panel in a fixed `.kfc-chat-slot` on the right (340px by default). Kick's player nodes stay parented to the fullscreen element so background React refreshes can reconcile without 404-ing the page. |
| Drag the video/chat divider | `#kfc-resize-handle` updates the `--kfc-chat-width` CSS variable live (clamped 260–640px, ≤60vw), resizing both the chat panel and the video area. The width is persisted to `localStorage` and restored on reload. |
| Double-click the video/chat divider | Resets chat width to the default 340px. |
| Click / double-click the video itself | Resumes a paused stream, and exits fullscreen, respectively. The click is one-way — it never pauses a playing stream, so a mis-aimed click can't stop the stream — and the pointer cursor is shown only while a click would actually resume it. Kick handles both on the `<video>` element, which the side-chat layout makes click-through (`pointer-events: none`) so clicks reach the player controls underneath, so the script re-implements them on the fullscreen element while side chat is active. Clicks on the chat panel, on the script's own controls, and on anything interactive are excluded, as are synthetic clicks from other userscripts. |
| Click the layout-mode toggle | The chat floats semi-transparently over the full-width video instead of shrinking it. |
| Click the info toggle | Hides / shows the top-left streamer-info overlay. |
| Click the settings gear | Opens settings for overlay opacity, stream-info backdrop opacity, chat-width presets, hide delay, chat dock side (left/right), userscript control auto-hide, overlay-chat idle auto-hide, opening chat directly as overlay, auto-opening chat whenever you enter fullscreen, and resetting to defaults. The panel caps at 76% of the screen height and scrolls, so every row stays reachable on short displays. Preferences persist via `localStorage`. |
| Click Kick's native **Hide chat** inside the chat panel | A capture-phase click listener recognises Kick's chat-toggle buttons (both of them — the **Hide chat** one in the chat header and the floating **Show chat** one) and tears the split layout down on the click itself, so it closes on the first click whatever Kick's own state is doing. A `MutationObserver` on `data-chat` catches the same thing as a fallback. |
| Stop moving the mouse for the hide delay (2–8s, default 4s) | The control cluster and stream-info overlay fade out in sync with Kick's controls/timeline. The docked chat is never part of that fade — the lookup that finds Kick's controls is scoped to the player's own layers and refuses to return anything belonging to this script. Any mouse movement brings them back instantly. While the cluster is fading back in (~0.2s) it stays click-through, so a click aimed at the player isn't swallowed by a button that is still invisible. |
| Switch to another app or tab and come back | The controls stop accepting clicks and keypresses the moment the window is left. They start again 350ms after focus returns *and* once the mouse has actually moved — so neither the click that re-activates the window, nor a click made later with the pointer still parked where you left it, can land on whichever control it happens to be sitting on. Nudge the mouse, or just click again, and the controls respond normally. Leaving also drops keyboard focus from any control that held it, so the reflexive Space/Enter to pause the stream goes to the player rather than to a button the browser refocused. |
| Change stream quality / seek / "Go to live" | Capture-phase click handlers tear the layout down before Kick's React remounts the player tree, avoiding the 404 you'd otherwise hit. The **Chat** button stays disabled until the player finishes reloading. |
| Exit fullscreen | The chat node is restored to its original parent and `nextSibling` position; the chat slot, resize divider, video-root markers, and control cluster are removed. |

- The script uses `@grant none` and makes no network requests — purely DOM manipulation against the Kick page.
- A `transform`-based containing block on the marked video layers keeps Kick's `position: fixed` video and controls anchored to the shrunken video area instead of stretching across the chat panel.

## Updating

The userscript metadata includes `@updateURL` and `@downloadURL` pointing at the `main` branch on GitHub. Most managers (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) honour these and auto-update when a new `@version` is published. Greasemonkey uses a longer default check interval (set in its preferences). **Safari's Userscripts extension is the exception** — it runs from a local folder and does not fetch `@updateURL`, so you must re-copy the latest `kick-fullscreen-chat.user.js` into your scripts folder to update. To update manually in any manager, replace `kick-fullscreen-chat.user.js` with the new version.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Button never appears in fullscreen | Open DevTools → Console and look for `[KickFullscreenChat]` log lines. If absent, check that the userscript is enabled for `kick.com` and that `@match https://kick.com/*` is present in the metadata block. |
| Button appears, clicking it does nothing | The chat selector did not match Kick's current DOM. You will see `chat container not found` in the console. Inspect the chat panel in DevTools and add its selector to `CHAT_SELECTORS` near the top of the userscript. |
| Re-opening chat shows an empty dark panel | Update to **0.5.0+** — the script now sets `data-chat="true"` before moving the chat, which prevents Kick's CSS from hiding the moved chat. |
| Video doesn't fill the left side / timeline overlaps chat | Update to **0.6.0+** — the marked video layers now create a containing block for Kick's `position: fixed` player layers. |
| Changing stream quality navigates Kick to a 404 page | Update to **0.7.0+** — the script tears the side-chat layout down at the first sign of a player reload to avoid React reconciliation conflicts. |
| Clicking **Chat** right after a quality change / seek still 404s | Update to **0.8.3+** — the **Chat** button is now disabled while the player is reloading and stays disabled for a short grace period after the video reports ready. |
| Kick 404s after the side chat sits open in fullscreen for a while (background tab / virtual screen) | Update to **0.9.2+** — the script no longer wraps Kick's player nodes in its own slot, so background React refreshes can reconcile without throwing into Kick's error boundary. |
| Want to see what the script is doing in the console | Run `KickFullscreenChat.debug()` in the console to toggle verbose logging, then reload. The choice is saved with the rest of your settings. Warnings always print; verbose logs are gated behind this flag. |
| The settings panel opens on its own, or a setting changes by itself (often after switching back to the browser) | Update to **0.21.6+** — after you leave the page, the controls ignore the first click that arrives with the mouse still parked where you left it, so returning to the stream and clicking can't land on the gear (or on a panel switch). Nudge the mouse first, or just click again, and the controls work normally. Earlier versions only ignored clicks for 350ms after focus came back, which missed every return where focus is restored on its own — Cmd-Tab, the dock icon, swiping back to a fullscreen Space — and the click follows a second or two later. That timed guard is still there as well (0.21.3, fixed in 0.21.5 so the ordering of the events can't defeat it). Other causes were fixed earlier: 0.21.1 stopped the faded-out cluster from being clickable while still invisible, and 0.20.1/0.21.1 made the controls drop keyboard focus after a mouse click so Space and the arrow keys go to the video. |
| The settings panel flickers open and shut by itself, typically right after you enter fullscreen | Update to **0.21.9+**. Another userscript was clicking this script's gear: kick-quality-saver looks for Kick's player settings button by `aria-label`, and the old label "Open fullscreen settings" matched its pattern — on fullscreen entry Kick's own controls aren't mounted yet, so its lookup fell through to ours and clicked it several times a pass while trying to set the video quality. The controls are now labelled "Open/Close fullscreen chat settings", which that lookup skips, and the buttons ignore any click that wasn't made by a real user. (Both scripts still work as before; only the label changed.) |
| The settings panel flickers open and closed by itself in fullscreen, especially while the mouse is moving | If **0.21.9+** didn't fix it, the other cause is two copies of this userscript installed — typically a manual install left in place next to the auto-updating one, or two managers both enabled for `kick.com`. Both copies share the same element ids, so they adopt the same control cluster and each keeps overwriting the other's idea of whether the panel is open. From **0.21.8+** a later copy stands down with a `[KickFullscreenChat] … is standing down` warning in the console naming both versions — but only if *that* copy is 0.21.8 or newer, since older ones don't check. Remove or disable the duplicate. |
| Closing the side chat with Kick's own **Hide chat** button needs two clicks | Update to **0.21.7+** — Kick has two separate chat-toggle buttons with two separately drawn icons, and the script only recognised the floating **Show chat** one, so clicks on the **Hide chat** button in the chat header weren't seen and the teardown had to infer them from Kick's own state instead. When that state disagreed with what the script had set, the first click only brought the two back into agreement and the second did the closing. |
| The settings panel is cut off at the bottom of the screen and **Reset settings** can't be reached | Update to **0.21.3+** — the panel now caps its height and scrolls, like the sibling kick-quality-saver panel already did. Previously it had no height limit, so on a 720p display or at browser zoom past ~110% the last rows fell off the bottom edge. |
| In the docked chat, the channel-points icon looks half-size and the points value spills out of its button | Update to **0.21.4+** — one of Kick's inner wrappers was crushing that button inside the narrower chat panel. The bar now measures identically docked and windowed. |
| `KickFullscreenChat.version` reports an older version than your script manager shows | Update to **0.21.2+** — the version constant behind the console API had fallen out of sync with the metadata header, so a correctly updated 0.21.1 install answered `"0.21.0"`. Only the reported string was wrong; the installed script was the right one. |
| Clicking a paused stream doesn't resume it while the side chat is open, and the cursor stays an arrow over the video | Update to **0.21.10+** — the side layout makes the video click-through so clicks reach Kick's controls underneath, which also stopped them reaching Kick's own play handler on the `<video>`. The script now handles the click itself. It only ever *resumes*: a click on a playing stream does nothing, so a mis-aimed click can't stop the stream, and the pointer cursor shows only while a click would actually resume it. |
| The docked chat turns black about a second after the timeline and controls fade out | Update to **0.21.10+** — when the hide delay is shorter than Kick's own, the script fades Kick's controls itself, and the lookup that found them could re-target the chat panel once Kick had unmounted its controls, blanking it. The lookup is now scoped to the player's own layers and refuses to return anything belonging to this script. |
| Kick's buffering spinner appears right of centre over the video | Update to **0.21.10+** — Kick's loading overlays kept the full screen width while the player was shrunk beside the chat, so what they centred landed at the centre of the screen. They are now sized to the video area. |
| Your chat width resets to a narrower value on its own | Update to **0.21.11+** — the saved width was clamped against the *windowed* browser viewport when the page loaded, not the fullscreen one it is actually used in, and the shrunken number was then written back to storage by the next settings change. Opening Kick once in a narrow window therefore shrank a width you had set on a wide display, permanently. The load-time clamp is now the 260–640px bounds only; the 60%-of-viewport limit still applies while you drag the divider. A width already shrunk by an earlier version needs setting once more. |
| Layout breaks after a Kick update | Kick may have changed the chat container class or the `data-chat` attribute. Open an issue with the relevant class names from the browser inspector. |
