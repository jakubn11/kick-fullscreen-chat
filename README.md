<div align="center">

<img src="icon.svg" width="108" height="108" alt="Kick Fullscreen Chat">

<h1>Kick Fullscreen Chat</h1>

<p>
  Twitch-style side-by-side fullscreen-with-chat for Kick.com.<br>
  Clean overlay button · Auto teardown · Zero network requests.
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
- Click the button to shrink the video and dock the chat panel on the right, or the left per the dock-side setting (340px wide by default)
- **Resizable chat:** drag the divider between the video and chat to set the panel width — drag well past the minimum and release to close the side chat in one gesture (the slot dims while the close is armed)
- **Dock left or right:** a setting moves the chat panel (and divider) to either edge; the video, controls, and stream-info overlay shift to clear it
- **Overlay mode:** a layout toggle switches between side-by-side (video shrinks) and chat floating semi-transparently over the full-width video, Twitch-style
- **Show/hide stream info:** a toggle hides or shows the streamer-info overlay for a cleaner picture
- **Fullscreen settings:** a gear button opens controls for overlay opacity, stream-info backdrop opacity, width presets, hide delay, chat dock side, userscript control auto-hide, overlay auto-hide, default overlay opening, auto-opening chat on fullscreen entry, and resetting to defaults
- **Settings persist:** preferences are saved to `localStorage`, restored on the next page load, and kept in step across every open Kick tab (no network, no `GM_*` grants)
- A clean dark glass control set with green icon accents, matching the sibling [kick-quality-saver](https://github.com/jakubn11/kick-quality-saver), [kick-third-party-emotes](https://github.com/jakubn11/kick-third-party-emotes), [kick-chat-utils](https://github.com/jakubn11/kick-chat-utils), and [kick-vod-resume](https://github.com/jakubn11/kick-vod-resume) userscripts' design language
- Hides itself when chat is open — Kick's native **Hide chat** button inside the chat panel takes over
- Auto-fades after a configurable delay of mouse inactivity (2–8s, default 4s), kept in sync with Kick's own controls/timeline; reappears instantly on mouse movement
- Auto-teardown: clicking Kick's native **Hide chat** restores fullscreen video and re-shows the **Chat** button so chat can be re-opened
- Disables the **Chat** button while the player is reloading (quality change, seek, "go to live") with a short grace period after the video reports ready, so a click can never land mid-reload and trigger Kick's 404 page
- Leaves Kick's player nodes parented to the fullscreen element and shrinks them with a CSS marker, so background React refreshes (e.g. while the stream plays on a background macOS Space) can reconcile without 404-ing the page
- Forces a containing block on the marked player layers so Kick's `position: fixed` video and timeline / controls stay inside the shrunken video area instead of overlapping the chat
- **Player gestures kept working:** clicking a paused stream resumes it and double-clicking exits fullscreen, both of which Kick handles on the `<video>` element that the side layout has to make click-through. The click is one-way — it never pauses a playing stream — and the pointer cursor appears only while a click would actually resume
- Restores the original DOM on exit — chat returns to its original location, no leftover wrappers
- **Console hook** — a persisted `KickFullscreenChat.debug()` switch, and the running version as `KickFullscreenChat.version`
- No network requests and no `GM_*` permissions — the only persistence is a single `localStorage` key (`kfc-settings`) holding your UI preferences and that switch

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

**Updates:** The script carries `@updateURL` / `@downloadURL` pointing at this repo, so managers that support remote updates (Tampermonkey, Violentmonkey, ScriptCat, …) pick up new versions automatically — no reinstall needed. Safari's Userscripts extension runs from a local folder and does **not** auto-update; re-copy the latest `kick-fullscreen-chat.user.js` to update there.

See [INSTALL.md](INSTALL.md) for full per-manager steps.

## Usage

Open any Kick channel and enter fullscreen with the player's fullscreen icon. The **Chat** button appears in the top-right corner.

| Action | Result |
|--------|--------|
| Click **Chat** | Video shrinks, chat panel docks on the right (340px) — or on the left, per the dock-side setting |
| Drag the divider between video and chat | Resizes the chat panel (260–640px, capped at 60% of the screen); width is saved and restored on the next visit |
| Drag the divider past the minimum width and release | Closes the side chat (slot dims while the close is armed; pull back above the threshold to cancel) |
| Double-click the divider | Resets chat width to 340px |
| Click the video | Resumes a paused stream. Clicking a playing stream does nothing — the click can only ever start playback, never pause it |
| Double-click the video | Exits fullscreen, as it does without the side chat (the script provides both gestures, since the side layout blocks Kick's own handlers on the `<video>`) |
| Click the layout-mode toggle (top-right, while chat is open) | Switches between side-by-side and overlay (chat floats over the video) |
| Click the info toggle (top-right) | Hides or shows the streamer-info overlay |
| Click the settings gear (top-right) | Opens fullscreen settings, grouped into **Chat** (width presets, dock side left/right, default overlay opening, auto-open chat on fullscreen), **Overlay** (opacity, stream-info backdrop opacity, overlay auto-hide) and **Controls** (hide delay, userscript control auto-hide), plus resetting to defaults. The panel caps at 76% of the screen height and scrolls, so every row stays reachable on short displays. Close it with the ✕, the gear, or a click outside |
| Click Kick's native **Hide chat** inside the chat panel | Split layout tears down, fullscreen video restored, **Chat** button reappears |
| Change stream quality / seek / "Go to live" | Side chat tears down automatically; **Chat** button is disabled until the player finishes reloading |
| Exit fullscreen | DOM restored to its original state — chat returns to its original location |

A couple of things are available from the browser console:

```js
KickFullscreenChat.debug(true);     // persisted verbose logging (no argument toggles it)
KickFullscreenChat.version;         // the running version
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Button never appears in fullscreen | Open DevTools → Console and look for `[KickFullscreenChat]` log lines — the first is `[KickFullscreenChat] v<version> active`. If absent, check that the userscript is enabled for `kick.com` and that `@match https://kick.com/*` is present in the metadata block. |
| Button appears, clicking it does nothing | Kick has probably changed its chat markup: a "chat panel not found" toast appears and the console logs `chat container not found` with lookup diagnostics. Open an issue with them. |
| Something else misbehaves | Most past problems — settings opening on their own, Kick 404s, a setting reverting, the chat going black — were fixed in a specific release. Run `KickFullscreenChat.version` in the console, update if you're behind, then check the full list in [INSTALL.md → Troubleshooting](INSTALL.md#troubleshooting). |

## How it works

When Kick's player goes fullscreen, the script adds its control cluster to the fullscreen element. Opening chat **moves Kick's own chat node** into a fixed slot beside the video and marks Kick's full-coverage player layers so CSS shrinks them to the remaining width — the player nodes themselves are never re-parented, so React can keep reconciling them (wrapping them is what used to send Kick to its 404 page). A quality change, seek or "Go to live" is caught in the capture phase, before Kick handles it, and tears the layout down first; the **Chat** button then stays disabled until the new stream has loaded. Leaving fullscreen puts the chat back exactly where it came from and removes everything the script added. Preferences live in one `localStorage` key, `kfc-settings`, and the script makes **no network requests** (`@grant none`).

## License

Licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
