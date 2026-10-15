# Kick Fullscreen Chat

Adds a Twitch-style **side chat** to the **fullscreen Kick player**: one click shrinks the video and docks the live chat beside it, with a **streamer-info overlay** on top.

## Latest changes

**0.21.18** — visual tidy-up to match the other kick-* scripts

- **Chat button** uses the system font at 13px, so every button in the top-right row is the same 34px height.
- **Error toast** uses the shared kick-* toast style: opaque dark surface, soft shadow, regular-weight text.
- **Reduce motion:** with it on, the toast fades in place instead of sliding down.

Full history: [CHANGELOG.md](https://github.com/jakubn11/kick-fullscreen-chat/blob/main/CHANGELOG.md)

## Features

- **Chat button** in the top-right of the fullscreen player — docks chat on the right (340px wide by default), or on the left via a setting
- **Resizable chat** — drag the divider to set the width (260–640px, at most 60% of the screen); drag past the minimum and release to close chat in one gesture
- **Overlay mode** — switch between side-by-side and chat floating semi-transparently over the full-width video
- **Stream-info overlay** — avatar, name, title, category and viewer count in the top-left, fading with Kick's own controls; links stay clickable
- **Fullscreen settings** — overlay and stream-info opacity, width presets, hide delay, dock side, control and overlay auto-hide, default overlay mode, auto-open chat on fullscreen, reset to defaults
- **Auto-fade** — the controls hide after 2–8s of mouse inactivity (default 4s) and come back as soon as you move the mouse
- **Player gestures kept** — click a paused stream to resume it, double-click to exit fullscreen
- **Safe around reloads** — the Chat button is disabled while the player reloads (quality change, seek, "go to live"), so a click can't trigger Kick's 404 page
- **Clean exit** — leaving fullscreen puts chat back exactly where it was
- A dark control set with green accents that matches the other kick-* userscripts

## How to use

Open any Kick channel and enter fullscreen with the player's fullscreen icon. The **Chat** button appears in the top-right corner.

| Action | Result |
|--------|--------|
| Click **Chat** | Video shrinks and chat docks beside it |
| Drag the divider | Resizes chat; the width is remembered |
| Double-click the divider | Resets chat width to 340px |
| Layout toggle (while chat is open) | Switches between side-by-side and overlay |
| Info toggle | Hides or shows the stream-info overlay |
| Settings gear | Opens fullscreen settings |
| Kick's **Hide chat** | Closes the side chat and restores the fullscreen video |

## Privacy & permissions

- `@grant none` and **no network requests**.
- Your preferences are stored in one `localStorage` key, `kfc-settings`, and never leave your machine. No analytics, no tracking.

## Compatibility

Developed and tested on **Safari** with the [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) extension. Tampermonkey, Violentmonkey, ScriptCat and other managers should work too.

## Links

- Source code, changelog and issues: [github.com/jakubn11/kick-fullscreen-chat](https://github.com/jakubn11/kick-fullscreen-chat)
- What's new: [CHANGELOG.md](https://github.com/jakubn11/kick-fullscreen-chat/blob/main/CHANGELOG.md)

Licensed under GPL-3.0.
