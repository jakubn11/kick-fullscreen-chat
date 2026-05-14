<div align="center">

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
- Click it to shrink the video and dock the chat panel on the right (340px wide)
- Re-uses Kick's own button markup and design tokens — visually identical to Kick's native buttons
- Hides itself when chat is open — Kick's native **Hide chat** button inside the chat panel takes over
- Auto-teardown: clicking Kick's native **Hide chat** restores fullscreen video and re-shows the **Chat** button so chat can be re-opened
- Forces a containing block on the video slot so Kick's `position: fixed` player layers (video + timeline + controls) stay inside the video area instead of overlapping the chat
- Restores the original DOM on exit — chat returns to its original location, no leftover wrappers
- No network requests, no `localStorage`, no GM_* permissions

## Installation & Usage

See [INSTALL.md](INSTALL.md) for setup instructions (Safari + Userscripts, Tampermonkey, Violentmonkey), usage walkthrough, update notes, and a troubleshooting table.

**Tested on:** Safari + [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) extension. Other browsers / userscript managers should work (the script uses `@grant none` and is pure DOM manipulation) but are untested.

## How it works

The userscript listens for `fullscreenchange` events. When Kick's player enters fullscreen, it injects a button using Kick's own class string and SVG so it inherits the native design tokens automatically.

Toggling the button moves the chat DOM node into a `.kfc-chat-slot` flexed alongside a `.kfc-video-slot` that wraps the player. The video slot is given a `transform`-based containing block so Kick's `position: fixed` video and controls layers stay inside the slot instead of stretching across the chat.

A `MutationObserver` watches the `data-chat` attribute Kick uses to drive chat visibility. When Kick sets `data-chat="false"` (its native hide button), the script tears down the split layout cleanly.

On fullscreen exit, the chat node is returned to its original parent and original `nextSibling` position, the slot wrappers are removed, and the button is destroyed.

## Troubleshooting

See the troubleshooting table in [INSTALL.md](INSTALL.md#troubleshooting).

## License

Licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
