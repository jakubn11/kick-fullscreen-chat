<div align="center">

<img src="icon.svg" width="108" height="108" alt="Kick Fullscreen Chat">

<h1>Kick Fullscreen Chat</h1>

<p>
  Twitch-style side-by-side fullscreen-with-chat for Kick.com.<br>
  Native button styling · Auto teardown · Zero network requests.
</p>

<p>
  <img alt="Userscript" src="https://img.shields.io/badge/Userscript-Any%20Manager-22c55e?style=flat-square&labelColor=101013">
  &nbsp;
  <img alt="License GPLv3" src="https://img.shields.io/badge/license-GPLv3-55d2ce?style=flat-square&labelColor=555555">
  &nbsp;
  <img alt="Tested on Safari" src="https://img.shields.io/badge/Tested%20on-Safari-22c55e?style=flat-square&logo=safari&logoColor=fff&labelColor=101013">
  &nbsp;
  <img alt="No network" src="https://img.shields.io/badge/Network-None-22c55e?style=flat-square&labelColor=101013">
  &nbsp;
  <img alt="Single file" src="https://img.shields.io/badge/Footprint-Single%20file-22c55e?style=flat-square&labelColor=101013">
</p>

</div>

## Features

- Adds a **Chat** toggle button in the top-right of the fullscreen Kick player
- Twitch-style streamer info overlay (avatar / name / title / game / viewer count) in the top-left of the fullscreen player, fading in and out with Kick's own controls/timeline; overlay text is selectable and profile/category links remain clickable
- Click the button to shrink the video and dock the chat panel on the right (340px wide)
- Re-uses Kick's own button markup and design tokens — visually identical to Kick's native buttons
- Hides itself when chat is open — Kick's native **Hide chat** button inside the chat panel takes over
- Auto-fades after 4 seconds of mouse inactivity, mirroring Kick's own controls overlay; reappears instantly on mouse movement
- Auto-teardown: clicking Kick's native **Hide chat** restores fullscreen video and re-shows the **Chat** button so chat can be re-opened
- Disables the **Chat** button while the player is reloading (quality change, seek, "go to live") with a short grace period after the video reports ready, so a click can never land mid-reload and trigger Kick's 404 page
- Leaves Kick's player nodes parented to the fullscreen element and shrinks them with a CSS marker, so background React refreshes (e.g. while the stream plays on a background macOS Space) can reconcile without 404-ing the page
- Forces a containing block on the marked player layers so Kick's `position: fixed` video and timeline / controls stay inside the shrunken video area instead of overlapping the chat
- Restores the original DOM on exit — chat returns to its original location, no leftover wrappers
- No network requests, no `localStorage`, no GM_* permissions

## Requirements

The script works with any userscript manager (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat or other) but is developed and tested on **Safari + Userscripts** only. Other browsers and managers may work but are untested.

**Recommended setup:**
- macOS with Safari
- [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) extension (free, by Justin Wasack)

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step instructions.

**Safari (recommended):**
1. Install the **[Userscripts](https://apps.apple.com/app/userscripts/id1463298887)** extension from the Mac App Store
2. Configure a scripts folder in the extension settings
3. Copy `kick-fullscreen-chat.user.js` into that folder

**Other browsers (untested):**
1. Install [Tampermonkey](https://www.tampermonkey.net), [Violentmonkey](https://violentmonkey.github.io), [Greasemonkey](https://www.greasespot.net), [ScriptCat](https://scriptcat.org) or other
2. Open `kick-fullscreen-chat.user.js` and paste it into a new script, or drag the file into the extension dashboard

See [INSTALL.md](INSTALL.md) for full per-manager steps.

## Usage

Open any Kick channel and enter fullscreen with the player's fullscreen icon. The **Chat** button appears in the top-right corner.

| Action | Result |
|--------|--------|
| Click **Chat** | Video shrinks to the left, chat panel docks on the right (340px) |
| Click Kick's native **Hide chat** inside the chat panel | Split layout tears down, fullscreen video restored, **Chat** button reappears |
| Change stream quality / seek / "Go to live" | Side chat tears down automatically; **Chat** button is disabled until the player finishes reloading |
| Exit fullscreen | DOM restored to its original state — chat returns to its original location |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Button never appears in fullscreen | Open DevTools → Console and look for `[KickFullscreenChat]` log lines. If absent, check that the userscript is enabled for `kick.com` and that `@match https://kick.com/*` is present in the metadata block. |
| Button appears, clicking it does nothing | The chat selector did not match Kick's current DOM. You will see `chat container not found` in the console. Inspect the chat panel in DevTools and add its selector to `CHAT_SELECTORS` near the top of the userscript. |
| Re-opening chat shows an empty dark panel | Update to **0.5.0+** — the script now sets `data-chat="true"` before moving the chat, which prevents Kick's CSS from hiding the moved chat. |
| Timeline shrinks but video still sits behind chat | Update to **0.9.6+** — the script now constrains both direct video layers and Kick's inner video wrapper chain. |
| Stream becomes blurred/loading and controls cannot be clicked after sitting in the background | Update to **0.9.7+** — the script avoids marking Kick's transient loading overlays and lets clicks pass through the video surface to the controls. |
| Emote-name tooltips don't appear when hovering chat emotes in fullscreen | Update to **0.9.8+** — the script now reparents Kick's body-portaled popovers into the fullscreen element while side chat is active, so the Fullscreen API can display them. |
| Double-clicking the video to exit fullscreen does nothing while side chat is open | Update to **0.9.9+** — the script attaches its own dblclick → exit-fullscreen handler on the fullscreen element while side chat is active, since the side-chat layout sets `pointer-events: none` on the video and blocks Kick's native double-click handler. |
| Streamer info overlay doesn't appear in fullscreen | The streamer-card selector did not match Kick's current DOM. Inspect the channel-info card in DevTools and add its selector to `STREAMER_INFO_SELECTORS` near the top of the userscript. |
| Video doesn't fill the left side / timeline overlaps chat | Update to **0.6.0+** — the video slot now creates a containing block for Kick's `position: fixed` player layers. |
| Changing stream quality navigates Kick to a 404 page | Update to **0.7.0+** — the script tears the side-chat layout down at the first sign of a player reload to avoid React reconciliation conflicts. |
| Clicking **Chat** right after a quality change / seek still 404s | Update to **0.8.3+** — the **Chat** button is now disabled while the player is reloading and stays disabled for a short grace period after the video reports ready. |
| Kick 404s after the side chat sits open in fullscreen for a while (background tab / virtual screen) | Update to **0.9.2+** — the script no longer wraps Kick's player nodes in its own slot, so background React refreshes can reconcile without throwing into Kick's error boundary. |
| Layout breaks after a Kick update | Kick may have changed the chat container class or the `data-chat` attribute. Open an issue with the relevant class names from the browser inspector. |

## License

Licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
