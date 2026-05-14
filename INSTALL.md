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

The script is pure DOM manipulation and uses `@grant none`, so it should work with any userscript manager, but has only been tested on Safari + Userscripts.

**[Tampermonkey](https://www.tampermonkey.net)** (Chrome, Firefox, Edge, Safari):
1. Install the Tampermonkey extension for your browser.
2. Open the Tampermonkey dashboard → **Create a new script**.
3. Replace the default content with the contents of `kick-fullscreen-chat.user.js` and save.

**[Violentmonkey](https://violentmonkey.github.io)** (Chrome, Firefox, Edge):
1. Install the Violentmonkey extension.
2. Click the Violentmonkey icon → **+** → **New script**.
3. Paste the contents of `kick-fullscreen-chat.user.js` and save.

## Usage

1. Open any Kick channel.
2. Click the player's fullscreen icon.
3. The **Chat** button appears top-right (matches Kick's native button styling).
4. Click it — the video shrinks to the left and the chat panel docks on the right.
5. To hide chat again, use Kick's native **Hide chat** button inside the chat panel. The split layout tears down and the **Chat** button reappears.
6. Exit fullscreen at any time — the DOM is restored to its original state.

## Updating

The userscript metadata includes `@updateURL` and `@downloadURL` pointing at the `main` branch on GitHub, so Tampermonkey and Userscripts auto-update when a new version is published. To update manually, replace `kick-fullscreen-chat.user.js` with the new version.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Button never appears in fullscreen | Open DevTools → Console and look for `[KickFullscreenChat]` log lines. If absent, check that the userscript is enabled for `kick.com` and that `@match https://kick.com/*` is present in the metadata block. |
| Button appears, clicking it does nothing | The chat selector did not match Kick's current DOM. You will see `chat container not found` in the console. Inspect the chat panel in DevTools and add its selector to `CHAT_SELECTORS` near the top of the userscript. |
| Re-opening chat shows an empty dark panel | Update to **0.5.0+** — the script now sets `data-chat="true"` before moving the chat, which prevents Kick's CSS from hiding the moved chat. |
| Video doesn't fill the left side / timeline overlaps chat | Update to **0.6.0+** — the video slot now creates a containing block for Kick's `position: fixed` player layers. |
| Changing stream quality navigates Kick to a 404 page | Update to **0.7.0+** — the script tears the side-chat layout down at the first sign of a player reload to avoid React reconciliation conflicts. |
| Clicking **Chat** right after a quality change / seek still 404s | Update to **0.8.1+** — the **Chat** button is now disabled while the player is reloading and stays disabled for a short grace period after the video reports ready. |
| Want to see what the script is doing in the console | Set `const DEBUG = false;` to `true` near the top of the userscript and reload. Warnings always print; verbose logs are gated behind this flag. |
| Layout breaks after a Kick update | Kick may have changed the chat container class or the `data-chat` attribute. Open an issue with the relevant class names from the browser inspector. |
