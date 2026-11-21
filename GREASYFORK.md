# Kick Fullscreen Chat

Adds a Twitch-style **side chat** to the **fullscreen Kick player**: one click shrinks the video and docks the live chat beside it, with a **streamer-info overlay** on top.

## Latest changes

**0.26.1** — Mute Kick's ads, automatically or one ad at a time

- **Mute ads** — a new switch in fullscreen settings (**Ads → Mute ads**, off by default) silences the player while Kick plays an ad and brings the sound back when it ends. It works on the regular channel page too. Kick's ads are part of the stream, so they can't be skipped.
- **Ad mute button** — in fullscreen, a speaker button appears in the bottom-left corner of the video while an ad plays, above Kick's own controls. Press it to mute or unmute that one ad; it's green while the ad has sound and red while it's muted.
- **Your sound settings are respected** — a stream you muted before the ad stays muted, unmuting during an ad is kept, and the volume level is never changed.

Full history: [CHANGELOG.md](https://github.com/jakubn11/kick-fullscreen-chat/blob/main/CHANGELOG.md)

## Features

- **Chat button** in the top-right of the fullscreen player — docks chat on the right (340px wide by default), or on the left via a setting
- **Resizable chat** — drag the divider to set the width (260–640px, at most 60% of the screen); drag past the minimum and release to close chat in one gesture
- **Overlay mode** — switch between side-by-side and chat floating semi-transparently over the full-width video
- **Stream-info overlay** — avatar, name, title, category, tags and viewer count in the top-left, with Kick's follow / subscribe / gift / share / report buttons under it, fading with Kick's own controls; Kick's buttons work right there in fullscreen, and the profile / category links take you to the page
- **Fullscreen settings** — overlay and stream-info opacity, which parts of the stream info to show (follow / sub / share buttons, tags), width presets, hide delay, dock side, control and overlay auto-hide, default overlay mode, auto-open chat on fullscreen, mute ads, reset to defaults
- **Mute ads** — optional: the player goes silent while Kick plays an ad and the sound comes back after it (ads are part of the stream, so they can't be skipped), plus a speaker button in fullscreen to mute or unmute a single ad
- **Auto-fade** — the controls hide after 2–8s of mouse inactivity (default 4s) and come back as soon as you move the mouse
- **Player gestures kept** — click a paused stream to resume it, double-click to exit fullscreen
- **Safe around reloads** — the Chat button is disabled while the player reloads (quality change, live-stream seek, "go to live"), so a click can't trigger Kick's 404 page; seeking a VOD or clip keeps the chat open
- **Clean exit** — leaving fullscreen puts chat back exactly where it was
- **Chat crash recovery** — if Kick's chat breaks while docked, the side chat closes so you can reopen it with one click, and the console lists the errors that led up to the crash
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
| Kick's buttons in the stream info | Work as on Kick's page, without leaving fullscreen |
| Settings gear | Opens fullscreen settings |
| Speaker button (bottom-left, during an ad) | Mutes or unmutes that ad |
| Kick's **Hide chat** | Closes the side chat and restores the fullscreen video |

## Privacy & permissions

- `@grant none` and **no network requests**.
- Your preferences are stored in one `localStorage` key, `kfc-settings`, and never leave your machine. No analytics, no tracking.
- The page's last 15 errors are kept in memory for crash diagnostics (`console.error` calls only while side chat is open) — never stored or sent anywhere.

## Compatibility

Developed and tested on **Safari** with the [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) extension. Tampermonkey, Violentmonkey, ScriptCat and other managers should work too.

## Links

- Source code, changelog and issues: [github.com/jakubn11/kick-fullscreen-chat](https://github.com/jakubn11/kick-fullscreen-chat)
- What's new: [CHANGELOG.md](https://github.com/jakubn11/kick-fullscreen-chat/blob/main/CHANGELOG.md)

Licensed under GPL-3.0.
