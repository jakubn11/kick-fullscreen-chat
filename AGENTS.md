# Kick Fullscreen Chat — Agent Context

Browser userscript that adds a Twitch-style side-by-side fullscreen-with-chat mode to Kick.com.

## Project Overview

**Type:** Single-file JavaScript userscript
**Primary file:** `kick-fullscreen-chat.user.js`
**Target:** Any userscript manager (Tampermonkey, Violentmonkey, Greasemonkey, Safari Userscripts, etc.) on any browser
**Git:** `git@github.com:jakubn11/kick-fullscreen-chat.git` (default branch: `main`).

## Commands

There is no package manager, build step, linter, or automated test suite configured.

Useful local checks:

```bash
sed -n '1,80p' kick-fullscreen-chat.user.js
wc -l kick-fullscreen-chat.user.js
```

Manual testing is required in a browser with a userscript manager installed:

1. Install the userscript via your manager (e.g. drag the `.user.js` file into Tampermonkey/Violentmonkey, or copy it into the folder configured in the Userscripts extension on Safari).
2. Open a Kick channel page.
3. Click the player's fullscreen button.
4. Verify the **Chat** button appears top-right.
5. Click it — video should shrink, chat should dock to the right.
6. Click Kick's native **Hide chat** inside the chat panel — split layout should tear down and the **Chat** button should reappear.
7. Click **Chat** again — chat should reappear in the split layout (not stay empty).
8. Exit fullscreen — DOM should be restored to its original state, chat back in its original location.
9. Check the browser developer console for `[KickFullscreenChat]` log lines if something doesn't work.

## Userscript Metadata

The userscript header controls permissions and host access. Keep it valid across all common userscript managers (Tampermonkey, Violentmonkey, Greasemonkey, Userscripts, etc.):

- `@match` should remain scoped to `https://kick.com/*` unless the target changes.
- `@grant none` — this userscript does not need any GM_* APIs. Do not add grants unless a feature actually requires one.
- Bump `@version` when changing user-facing behavior or DOM logic.

Do not add `Co-Authored-By:` trailers to git commits.

## Implementation Map

`kick-fullscreen-chat.user.js` is organized into these areas:

- Userscript metadata header
- Constants — element IDs (`BTN_ID`, `WRAP_ID`, `STYLE_ID`), `CHAT_WIDTH`, the inlined Kick button SVG (`BTN_SVG`), and Kick's button class string (`BTN_CLASS`)
- Fragile DOM selectors — `VIDEO_WRAPPER_SELECTORS`, `CHAT_SELECTORS`
- Chat discovery — `pick()`, `findChatByInput()`, `findChat()`
- Kick state helpers — `setKickDataChat()` toggles the `data-chat` attribute Kick uses to drive chat visibility via Tailwind `group-data-[chat=false]/main` rules
- Style injection — `injectStyles()` adds the `.kfc-active` flex layout, slot rules, and button wrapper positioning
- Split-layout state — `savedChatParent`, `savedChatNextSibling`, `chatSlot`, `videoSlot`, `active`, `suppressObserver`
- Layout toggle — `enableSideChat()`, `disableSideChat()`
- Button — `ensureButton()`, `removeButton()`, `updateBtnLabel()`
- Observers and listeners — `dataChatObserver` (watches for Kick toggling `data-chat="false"`) and the `fullscreenchange` / `webkitfullscreenchange` handlers

The core idea: when the user activates the side chat, the chat node is **moved** into a new `.kfc-chat-slot` inside the fullscreen element, and the existing fullscreen children are wrapped in a `.kfc-video-slot`. On tear-down, the chat node is restored to its original parent (and original `nextSibling` insertion point if still present).

## External APIs

None. This userscript does not perform any network requests and does not depend on third-party services. All work is DOM manipulation inside the Kick page.

## DOM And Routing Notes

Kick is a single-page app and may change class names. The fragile selectors live near the top of the userscript:

- `VIDEO_WRAPPER_SELECTORS` — candidates for the fullscreened player container (`#injected-channel-player`, `[data-testid="player"]`, etc.)
- `CHAT_SELECTORS` — candidates for the chat panel (`#chatroom`, `[data-testid="chatroom"]`, etc.)

When fixing Kick DOM breakage, prefer adding fallback selectors rather than replacing working selectors. `findChat()` already falls back to walking up from a chat input/textarea whose placeholder matches `chat|message|send a message` — extend that heuristic before resorting to brittle class-name matching.

`data-chat` is the attribute Kick uses on a player ancestor to drive chat visibility through Tailwind variants like `group-data-[chat=false]/main:block`. The script:

1. Sets `data-chat="true"` when entering the split layout, so chat is not hidden by Kick's own CSS once it has been moved into our chat slot.
2. Observes `data-chat` mutations and tears down the split layout when Kick sets it to `"false"` (e.g. when the user clicks Kick's native **Hide chat** button).
3. Uses a `suppressObserver` flag so our own writes do not immediately re-trigger the observer.

Always test after selector or attribute changes:

- Entering fullscreen — **Chat** button appears
- Activating split layout — chat moves in, video shrinks
- Clicking Kick's native **Hide chat** — split layout collapses, **Chat** button reappears
- Re-activating split layout — chat content is visible (not an empty dark slot)
- Exiting fullscreen — chat returns to its original DOM location

## UI Design Notes

The injected button intentionally re-uses Kick's own button markup so it inherits Kick's design tokens automatically:

- The toggle button uses Kick's exact class string (`BTN_CLASS`) — `bg-surface-base`, `betterhover:hover:!bg-surface-highest`, `text-white`, `rounded`, etc.
- The toggle button SVG is the exact icon Kick uses on its native "Show chat" button.
- The wrapper is positioned with `top: 1.75rem; right: 1.75rem` to match Kick's `top-7 right-7` placement.
- When the split layout is active, the toggle button is hidden via `display: none` — Kick's native **Hide chat** button inside the chat panel takes over.

Do not introduce custom button styling or palette tokens. If Kick changes their button classes, update `BTN_CLASS` to match the new ones rather than introducing a parallel design language.

## Security

### Rules — always follow these

- **Never use `innerHTML`, `outerHTML`, or `insertAdjacentHTML` with untrusted data.** The single existing use of `innerHTML` writes a hardcoded SVG + `<span>Chat</span>` template. Any future button content must remain hardcoded — never interpolate provider responses, DOM text, URL fragments, or user input.
- **Never use `eval`, `new Function(string)`, `setTimeout(string)`, or `setInterval(string)`.**
- **Do not introduce network requests** without explicit reason. There are currently no `fetch`, `XMLHttpRequest`, `GM_xmlhttpRequest`, or remote image loads. Adding one would require a `@connect` entry and a security review of the destination.
- **Do not store anything in `localStorage` or cookies.** This script holds only in-memory state.
- **Do not bypass `suppressObserver`** when mutating `data-chat` from script. Doing so will cause the observer to immediately tear down the layout we just enabled, leading to flicker or infinite loops.
- **Do not remove or weaken the `looksLikePlayer` check** in `onFullscreenChange` — it stops us from injecting the toggle into unrelated fullscreen targets.

### Checks — run mentally before every commit

- Does any new code assign untrusted data to `innerHTML` or similar? → Fix it.
- Does any new code introduce a `fetch` or other remote request? → Add `@connect`, justify the domain, and document it.
- Does any new code introduce a `localStorage` key? → Reconsider; this script is intentionally stateless.
- Does any new code mutate `data-chat` without raising `suppressObserver` first? → Wrap the write.
- Does any new code use string-based dynamic execution (`eval`, etc.)? → Remove it.

## Documentation

The repo carries these user-facing docs:

- `README.md` — high-level overview, features, "how it works", links out.
- `INSTALL.md` — installation per userscript manager, usage walkthrough, update notes, and the troubleshooting table.
- `LICENSE` — full GPLv3 text.

Update rules:

- When installation steps, supported browsers, troubleshooting guidance, or user-visible behavior change → update `INSTALL.md`.
- When features, "how it works" copy, or top-level positioning changes → update `README.md`. Do not duplicate installation or troubleshooting content from `INSTALL.md` here; link to it.
- Keep docs browser-agnostic. Cover the general flow and call out manager-specific differences (Userscripts for Safari, Tampermonkey, Violentmonkey, etc.) where they matter.

## Before Every Commit

Before committing any change, always:

1. **Bump `@version`** in the `kick-fullscreen-chat.user.js` metadata header using these rules:

   | Change | Bump | Example |
   |---|---|---|
   | New user-facing feature — new toggle, new layout, new keyboard shortcut | **minor** `x.+1.0` | `0.5.x → 0.6.0` |
   | Bug fix, selector tweak, refactor, internal change | **patch** `x.x.+1` | `0.5.x → 0.5.x+1` |
   | Breaking change or full rewrite | **major** `+1.0.0` | `0.x.x → 1.0.0` |

2. **Update `CHANGELOG.md`** — add an entry under the new version with a short summary of what changed.
3. **Update `INSTALL.md`** if installation steps, supported browsers, usage flow, or troubleshooting guidance change. Update `README.md` only if features or top-level positioning change. Internal refactors and bug fixes that don't change user-facing behaviour don't require either.
4. **Suggest a GitHub Release** after every commit if any of the following apply — say "this looks like a good point to publish a GitHub Release":
   - A security fix was made
   - A user-facing feature was added (new toggle, new layout, new keyboard shortcut)
   - A bug affecting core functionality was fixed (button missing in fullscreen, split layout broken, chat not rendering)

   Do NOT suggest a release for: docs-only changes, internal refactors, formatting, style tweaks the user won't notice.
