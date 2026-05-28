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
| Enter fullscreen on a Kick channel | Script injects a top-right control cluster — a **Chat** toggle plus icon buttons for layout mode, showing/hiding the stream-info overlay, and opening fullscreen settings — styled to match the sibling kick-emotes userscript. |
| Click **Chat** | Marks Kick's full-coverage player layers in place with `data-kfc-video-root` so they shrink to `calc(100% - var(--kfc-chat-width))`, and docks the chat panel in a fixed `.kfc-chat-slot` on the right (340px by default). Kick's player nodes stay parented to the fullscreen element so background React refreshes can reconcile without 404-ing the page. |
| Drag the video/chat divider | `#kfc-resize-handle` updates the `--kfc-chat-width` CSS variable live (clamped 260–640px, ≤60vw), resizing both the chat panel and the video area. The width is persisted to `localStorage` and restored on reload. |
| Double-click the video/chat divider | Resets chat width to the default 340px. |
| Click the layout-mode toggle | The chat floats semi-transparently over the full-width video instead of shrinking it. |
| Click the info toggle | Hides / shows the top-left streamer-info overlay. |
| Click the settings gear | Opens settings for overlay opacity, chat-width presets, hide delay, chat dock side (left/right), userscript control auto-hide, overlay-chat idle auto-hide, opening chat directly as overlay, auto-opening chat whenever you enter fullscreen, and resetting to defaults. Preferences persist via `localStorage`. |
| Click Kick's native **Hide chat** inside the chat panel | A `MutationObserver` on `data-chat` (and a click listener for the chat-slot button) tears the split layout down. |
| Stop moving the mouse for the hide delay (2–8s, default 4s) | The control cluster and stream-info overlay fade out in sync with Kick's controls/timeline. Any mouse movement brings them back instantly. |
| Change stream quality / seek / "Go to live" | Capture-phase click handlers tear the layout down before Kick's React remounts the player tree, avoiding the 404 you'd otherwise hit. The **Chat** button stays disabled until the player finishes reloading. |
| Exit fullscreen | The chat node is restored to its original parent and `nextSibling` position; the chat slot, resize divider, video-root markers, and control cluster are removed. |

- The script uses `@grant none` and makes no network requests — purely DOM manipulation against the Kick page.
- A `transform`-based containing block on the marked video layers keeps Kick's `position: fixed` video and controls anchored to the shrunken video area instead of stretching across the chat panel.

## Updating

The userscript metadata includes `@updateURL` and `@downloadURL` pointing at the `main` branch on GitHub. Most managers (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) honour these and auto-update when a new `@version` is published. Greasemonkey uses a longer default check interval (set in its preferences). To update manually in any manager, replace `kick-fullscreen-chat.user.js` with the new version.

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
| Want to see what the script is doing in the console | Set `const DEBUG = false;` to `true` near the top of the userscript and reload. Warnings always print; verbose logs are gated behind this flag. |
| Layout breaks after a Kick update | Kick may have changed the chat container class or the `data-chat` attribute. Open an issue with the relevant class names from the browser inspector. |
