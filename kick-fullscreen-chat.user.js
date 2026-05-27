// ==UserScript==
// @name         Kick Fullscreen Chat
// @namespace    https://github.com/jakubn11/kick-fullscreen-chat
// @version      0.11.23
// @description  Adds a Twitch-style "side chat" toggle button when watching a Kick stream in fullscreen.
// @author       jakubnl94@gmail.com
// @license      GPL-3.0-only
// @icon         https://raw.githubusercontent.com/jakubn11/kick-fullscreen-chat/main/icon.svg
// @match        https://kick.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/jakubn11/kick-fullscreen-chat/main/kick-fullscreen-chat.user.js
// @downloadURL  https://raw.githubusercontent.com/jakubn11/kick-fullscreen-chat/main/kick-fullscreen-chat.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Flip to true to enable verbose console logging.
  const DEBUG = false;

  const BTN_ID = 'kfc-toggle-btn';
  const WRAP_ID = 'kfc-toggle-wrap';
  const TOAST_ID = 'kfc-toast';
  const STYLE_ID = 'kfc-style';
  const INFO_ID = 'kfc-info-overlay';
  const VIDEO_ROOT_ATTR = 'data-kfc-video-root';
  const VIDEO_FRAME_ATTR = 'data-kfc-video-frame';
  const VIDEO_EL_ATTR = 'data-kfc-video-el';
  const CHAT_WIDTH = '340px';
  const INFO_MAX_WIDTH = '720px';
  const VIEWER_COUNT_COLOR = '#53fc18';

  const BTN_SVG = `<svg width="32" height="32" viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M8.79052 14.6146L10.9377 12.4674L8.46758 10.0061L2 16.4737L8.46758 22.9413L10.9377 20.4799L8.57232 18.1058H30V14.6146H8.79052Z"></path><path d="M29.9643 6H12.5079V9.49127H29.9643V6Z"></path><path d="M29.9643 23.4564H12.5079V26.9476H29.9643V23.4564Z"></path></svg>`;
  const BTN_CLASS = 'group inline-flex gap-1.5 items-center justify-center rounded font-semibold box-border relative transition-all betterhover:active:scale-[0.98] disabled:pointer-events-none select-none whitespace-nowrap [&_svg]:size-[1em] outline-transparent outline-2 outline-offset-2 disabled:text-disabled-onSurface focus-visible:outline-outline-decorative text-white [&_svg]:fill-current focus-visible:bg-secondary-base/40 disabled:opacity-30 px-3 py-2 text-base bg-surface-base betterhover:hover:!bg-surface-highest';

  // Selectors — Kick changes its markup occasionally, so we try a few.
  const VIDEO_WRAPPER_SELECTORS = [
    '#injected-channel-player',
    '[data-testid="player"]',
    '.video-player',
    '.vjs-tech',
  ];
  const CHAT_SELECTORS = [
    '#chatroom',
    '[data-testid="chatroom"]',
    '#channel-chatroom',
    'aside[class*="chat" i]',
    'div[class*="Chatroom" i]',
    'div[class*="chatroom" i]',
    'section[class*="chat" i]',
  ];
  // Twitch-style channel info overlay (avatar / streamer name + verified badge /
  // title with emotes / game + viewer count). We clone Kick's existing
  // streamer card into the fullscreen element so the user can see who they're
  // watching while the player is fullscreen. Tried in order; first match wins.
  // Add fallback selectors at the end as Kick's markup changes.
  const STREAMER_INFO_SELECTORS = [
    '[data-testid="streamer-info"]',
    '[data-testid="channel-info"]',
    '[data-testid="user-channel-info"]',
    '[data-testid="channel-header"]',
    '#channel-header',
    '#streamer-info',
    '#channel-info',
  ];
  // Viewer-count badge (e.g., "770 Viewers"). Cloned into the overlay as a
  // separate child below the streamer card, since Kick renders it as its
  // own element outside the compact streamer card we clone.
  const VIEWER_COUNT_SELECTORS = [
    '[data-testid="viewer-count"]',
    '[data-testid="viewers-count"]',
    '[data-testid*="viewer-count" i]',
    '[aria-label*="viewer" i][aria-label*="count" i]',
  ];
  // Matches "770 Viewers" / "1,250 Viewers" / "1 234 sledujících" / etc.
  // Used by the content-based fallback to locate the viewer-count badge
  // when no direct selector matches. Common languages covered; add more
  // tokens if Kick localises into a script not listed here.
  const VIEWER_COUNT_RE =
    /\b\d[\d, . ]*\s*(?:viewers?|sledujících|diváků|spectateurs|zuschauer|widzów|зрителей|просмотров|espectadores|spettatori|视聴者|시청者|시청자|مشاهد)\b/i;

  const log = (...args) => {
    if (DEBUG) console.log('[KickFullscreenChat]', ...args);
  };
  const warn = (...args) => console.warn('[KickFullscreenChat]', ...args);

  const getCurrentChannelPath = () => {
    const slug = (window.location.pathname || '').split('/').filter(Boolean)[0];
    if (!slug || slug.includes('.')) return null;
    return `/${slug}`;
  };

  const exitFullscreenBeforeAction = (action) => {
    if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
      action();
      return;
    }
    if (document.exitFullscreen) {
      document.exitFullscreen().then(action).catch(action);
      return;
    }
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
      setTimeout(action, 50);
      return;
    }
    action();
  };

  const clickNativeOrNavigate = (nativeEl, fallbackUrl) => {
    exitFullscreenBeforeAction(() => {
      if (nativeEl && document.body.contains(nativeEl)) {
        nativeEl.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          })
        );
        return;
      }
      if (fallbackUrl) window.location.href = fallbackUrl;
    });
  };

  const shouldHandleOverlayNavigation = (event) => {
    return (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    );
  };

  const wireOverlayNavigation = (el, getNativeEl, fallbackUrl) => {
    if (!el || el.dataset.kfcNavWired === 'true') return;
    el.dataset.kfcNavWired = 'true';
    el.addEventListener('click', (event) => {
      if (!shouldHandleOverlayNavigation(event)) return;
      event.preventDefault();
      event.stopPropagation();
      clickNativeOrNavigate(getNativeEl?.(), fallbackUrl);
    });
  };

  // Non-blocking on-screen toast for surfacing errors without an `alert()` modal,
  // which would steal focus and can break fullscreen mode in some browsers.
  const showToast = (message) => {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
    }
    toast.textContent = message;
    const host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (toast.parentNode !== host) host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('kfc-toast-show'));
    clearTimeout(toast._kfcTimer);
    toast._kfcTimer = setTimeout(() => {
      toast.classList.remove('kfc-toast-show');
    }, 4000);
  };

  const pick = (selectors) => {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  // Fallback: locate the chat container by walking up from the chat input/textarea.
  const findChatByInput = () => {
    const candidates = document.querySelectorAll(
      'textarea, [contenteditable="true"], input[type="text"]'
    );
    for (const inp of candidates) {
      const placeholder = (inp.getAttribute('placeholder') || '').toLowerCase();
      const aria = (inp.getAttribute('aria-label') || '').toLowerCase();
      const text = placeholder + ' ' + aria;
      if (/chat|message|send a message/.test(text)) {
        // Walk up to a sizable ancestor that looks like a panel.
        let node = inp;
        for (let i = 0; i < 10 && node && node.parentElement; i++) {
          node = node.parentElement;
          const rect = node.getBoundingClientRect();
          if (rect.height > 300 && rect.width > 200 && rect.width < window.innerWidth * 0.6) {
            return node;
          }
        }
      }
    }
    return null;
  };

  const findChat = () => pick(CHAT_SELECTORS) || findChatByInput();

  // Kick toggles a `data-chat` attribute on a player ancestor to drive chat visibility
  // via CSS (Tailwind `group-data-[chat=false]/main:*` rules). Set it to "true" before
  // we move the chat node, otherwise the chat stays hidden inside our split layout.
  const setKickDataChat = (value) => {
    const els = document.querySelectorAll('[data-chat]');
    els.forEach((el) => el.setAttribute('data-chat', value));
    return els.length;
  };

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${WRAP_ID} {
        position: absolute;
        top: 1.75rem;
        right: 1.75rem;
        z-index: 2147483647;
        pointer-events: auto;
        opacity: 1;
        transition: opacity 0.2s ease;
      }
      #${WRAP_ID}.kfc-hidden { display: none; }
      /* Mirrors Kick's own controls-overlay fade so the toggle button
         disappears alongside the timeline / play controls when the user is
         idle, and reappears as soon as the mouse moves. */
      #${WRAP_ID}.kfc-idle {
        opacity: 0;
        pointer-events: none;
      }
      #${BTN_ID} svg { transition: transform 0.15s ease; }
      .kfc-active #${BTN_ID} svg { transform: scaleX(-1); }

      .kfc-active { background: #000; }
      /* We mark Kick's full-coverage player layers in place rather than moving
         them into a wrapper. Wrapping fsEl's children caused React's reconciler
         to throw on background re-renders (it tried to remove a node from fsEl
         that we'd reparented into our wrapper) and navigate to Kick's 404 page.
         Non-video layers are filtered further in JS so transient loading/blur
         overlays do not become transformed hit targets above the controls. */
      [${VIDEO_ROOT_ATTR}] {
        width: calc(100% - ${CHAT_WIDTH}) !important;
        max-width: calc(100% - ${CHAT_WIDTH}) !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden;
        box-sizing: border-box !important;
        /* Containing block for any position:fixed/absolute descendants so the
           controls/timeline grid anchors to the shrunken area instead of the
           viewport. */
        transform: translateZ(0);
      }
      /* Kick can keep the actual <video> inside one or more inner wrappers that
         are sized from the viewport rather than from the marked player layer.
         Constrain that wrapper chain too so the picture follows the timeline
         into the left-side video area when chat opens. */
      [${VIDEO_FRAME_ATTR}] {
        width: 100% !important;
        max-width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden;
        box-sizing: border-box !important;
      }
      [${VIDEO_ROOT_ATTR}] video {
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        object-fit: contain !important;
      }
      video[${VIDEO_ROOT_ATTR}] {
        object-fit: contain !important;
        object-position: center center !important;
      }
      video[${VIDEO_EL_ATTR}] {
        object-fit: contain !important;
        object-position: center center !important;
        pointer-events: none !important;
      }
      .kfc-chat-slot {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: ${CHAT_WIDTH};
        background: #0e0e10;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        /* No explicit z-index. position:fixed already creates a stacking
           context, and the slot is appended after Kick's player layers so it
           renders on top by DOM order. Avoid a high z-index — it stacked over
           sibling overlays appended by other Kick userscripts (e.g. the
           kick-emotes autocomplete popup and tooltip, which the Fullscreen API
           forces those scripts to re-parent into fsEl, and which previously
           landed below our slot's background). */
      }
      /* Kick's player container (fsEl) typically has user-select: none so the
         video / controls aren't selectable. Once chat moves into our slot
         inside fsEl, it inherits that — making chat messages uncopyable.
         Force text selection back on inside the chat slot. The selector
         covers descendants so a chat ancestor with its own user-select:none
         can't block us. */
      .kfc-chat-slot,
      .kfc-chat-slot * {
        -webkit-user-select: text;
        user-select: text;
      }
      .kfc-chat-slot > * {
        flex: 1 1 auto;
        min-height: 0;
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        max-height: none !important;
        width: 100% !important;
        visibility: visible !important;
      }
      [${POPOVER_CLONE_ATTR}] {
        z-index: 2147483647 !important;
        pointer-events: none !important;
      }
      [${POPOVER_CLONE_ATTR}] * {
        z-index: 2147483647 !important;
      }

      /* Twitch-style streamer info overlay. A clone of Kick's existing
         channel-info card pinned to the top-left of the fullscreen element,
         tied to the same idle fade as the toggle button so it appears with
         the controls/timeline and disappears with them. Mostly click-through
         so empty overlay space still passes clicks to the player.
         Background is fully transparent — readability comes from a text
         shadow propagated to all descendants, the same trick Twitch uses
         for its fullscreen channel-info overlay. The wrapper itself remains
         click-through, while the cloned card content opts back into pointer
         events so links work and text can be selected. */
      #${INFO_ID} {
        position: absolute;
        top: 1.75rem;
        left: 1.75rem;
        z-index: 2147483646;
        max-width: min(60%, ${INFO_MAX_WIDTH});
        pointer-events: none;
        opacity: 1;
        transition: opacity 0.2s ease;
        color: #fff;
        background: transparent;
        padding: 0;
        box-sizing: border-box;
        user-select: text;
        -webkit-user-select: text;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85), 0 0 8px rgba(0, 0, 0, 0.5);
      }
      #${INFO_ID} *,
      #${INFO_ID} *::before,
      #${INFO_ID} *::after {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      #${INFO_ID}.kfc-idle {
        opacity: 0;
      }
      /* Reset positioning on the clone's root so a card that was originally
         absolutely positioned within its page layout doesn't escape the
         overlay frame. Inherited Tailwind utility classes (flex / gap /
         text-* / etc.) on descendants are preserved. */
      #${INFO_ID} > * {
        position: static !important;
        margin: 0 !important;
        width: auto !important;
        max-width: 100% !important;
        background: transparent !important;
        pointer-events: auto !important;
      }
      #${INFO_ID} a,
      #${INFO_ID} button {
        pointer-events: auto !important;
      }
      #${INFO_ID} a {
        cursor: pointer !important;
      }
      /* Viewer-count badge inlined next to the category link, e.g.
         "IRL • 682 Viewers". The cloned badge is forced to inline-flex so
         it sits on the same row as the category. The separator is drawn
         as a CSS circle so it doesn't depend on font glyph rendering. */
      #${INFO_ID} .kfc-info-separator {
        display: inline-block !important;
        width: 0.38em !important;
        height: 0.38em !important;
        margin: 0 0.4rem !important;
        border-radius: 9999px !important;
        background: #fff !important;
        background-color: #fff !important;
        opacity: 1 !important;
        vertical-align: middle !important;
        flex: 0 0 auto !important;
      }
      #${INFO_ID} .kfc-info-viewer-inline {
        display: inline-flex !important;
        align-items: center !important;
        gap: 0.25rem !important;
        margin: 0 !important;
        vertical-align: middle !important;
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      #${INFO_ID} .kfc-info-viewer-inline * {
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      #${INFO_ID} .kfc-info-viewer-inline svg,
      #${INFO_ID} .kfc-info-viewer-inline svg * {
        fill: #fff !important;
        stroke: #fff !important;
      }
      #${INFO_ID} .kfc-info-viewer-inline [class~="text-primary-base"] {
        color: ${VIEWER_COUNT_COLOR} !important;
      }
      #${INFO_ID} .kfc-info-viewer-inline [class~="text-subtle"] {
        color: #fff !important;
      }
      #${INFO_ID} .kfc-info-category-inline,
      #${INFO_ID} .kfc-info-category-inline * {
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      /* Hide follow / subscribe / share / notification controls so the
         overlay stays compact. Use aria-label / href patterns instead of
         a broader 'button:not(:has(img))' rule — Kick wraps the
         streamer-name text in a plain text button on some layouts, and
         the broad rule was hiding it. Verified badges render as inline
         SVG / span and remain visible. */
      #${INFO_ID} button[aria-label*="follow" i]:not([aria-label*="followers" i]):not([aria-label*="following" i]),
      #${INFO_ID} button[aria-label*="subscribe" i]:not([aria-label*="subscriber" i]),
      #${INFO_ID} button[aria-label*="notif" i],
      #${INFO_ID} button[aria-label*="share" i],
      #${INFO_ID} a[href*="/follow" i],
      #${INFO_ID} a[href*="/subscribe" i] {
        display: none !important;
      }
      /* Boost streamer name prominence. The cloned card's headings (or
         heading-shaped class patterns) get bolder white text so the name
         reads as the top element above the title. Size is only slightly
         larger than body text so a long username doesn't dominate the
         overlay (Kick's own compact card uses a similar restrained
         hierarchy). */
      #${INFO_ID} h1,
      #${INFO_ID} h2,
      #${INFO_ID} h3,
      #${INFO_ID} [class*="username" i],
      #${INFO_ID} [class*="streamer-name" i],
      #${INFO_ID} [class*="channel-name" i] {
        font-size: 1.15em !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
        color: #fff !important;
      }
      /* Allow the stream title to wrap to 2 rows. Kick applies Tailwind's
         'truncate' / 'line-clamp-1' classes to the title in their normal
         page layout because horizontal space is tight there; in our
         overlay we have more room, so let long titles use a second line
         and only clip with an ellipsis past row 2. The override targets
         any descendant carrying those utility classes — covers the title
         specifically and is a no-op on shorter text that already fits.
         Headings (the streamer name) are excluded so a long username
         doesn't sprawl across two lines. */
      #${INFO_ID} [class*="truncate"]:not(h1):not(h2):not(h3),
      #${INFO_ID} [class*="line-clamp"]:not(h1):not(h2):not(h3) {
        display: -webkit-box !important;
        -webkit-box-orient: vertical !important;
        -webkit-line-clamp: 2 !important;
        line-clamp: 2 !important;
        white-space: normal !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        /* Let the title use the overlay's full available width — Kick's
           own card constrains it tighter (max-w-* utility) for the in-page
           layout where space is shared with follow / subscribe buttons,
           but in our overlay the row has more room. */
        max-width: 100% !important;
        width: 100% !important;
      }

      #${TOAST_ID} {
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 2147483647;
        background: rgba(0, 0, 0, 0.88);
        color: #fff;
        padding: 10px 14px;
        border-radius: 8px;
        font: 600 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
        border: 1px solid rgba(255, 255, 255, 0.1);
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity 0.2s ease, transform 0.2s ease;
        pointer-events: none;
        max-width: 360px;
      }
      #${TOAST_ID}.kfc-toast-show {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
  };

  let savedChatParent = null;
  let savedChatNextSibling = null;
  let chatSlot = null;
  let videoRoots = [];
  let videoFrames = [];
  let markedVideos = [];
  let videoRootHost = null;
  let videoRootObserver = null;
  let infoOverlay = null;
  let infoOverlaySource = null;
  let infoOverlayObserver = null;
  let infoViewerSource = null;
  let infoViewerObserver = null;
  let infoOverlayPending = false;
  let infoViewerAttrSyncPending = false;
  let active = false;
  let suppressObserver = false;
  // Timestamp guarded by RECONCILE_GUARD_MS in dataChatObserver: a `data-chat`
  // flip back to "false" within this window after enableSideChat is treated
  // as Kick's React reconciler reverting our optimistic write (rather than a
  // real user "hide chat" action), and we re-assert "true" instead of tearing
  // down. Falls back from the primary fix (clicking Kick's own chat-toggle
  // button to sync React state) when that button isn't findable.
  let enableSyncUntil = 0;
  let videoEl = null;
  let enabledAt = 0;
  let fullscreenVideoEl = null;
  let onVideoLoaded = null;
  let onVideoBuffering = null;
  let onVideoStateChange = null;
  let videoSwapObserver = null;
  // Set true synchronously by triggers we know cause Kick to reload the player
  // (quality change, seekbar, go-to-live). The old <video> element can briefly
  // still report readyState=4 in the gap between our teardown and Kick wiping
  // the element, which would otherwise let updateBtnLabel re-enable the Chat
  // button. With the flag set, the button stays disabled until the monitor's
  // canplay/loadeddata handler clears it. The monitor's loadstart/emptied
  // handler raises the flag too, so reloads we *didn't* trigger ourselves
  // (e.g. a backend-driven re-mount) are also covered as soon as the video
  // fires the corresponding event.
  let videoReloading = false;
  // Grace delay (ms) between the video firing canplay/loadeddata and the Chat
  // button becoming clickable again. canplay can fire while React is still
  // mid-commit on Kick's player tree, and a click that lands in that window
  // can still trip the 404. The delay gives the reconciler time to settle.
  const VIDEO_READY_GRACE_MS = 750;
  let videoReadyTimer = 0;
  const clearVideoReadyTimer = () => {
    if (videoReadyTimer) {
      clearTimeout(videoReadyTimer);
      videoReadyTimer = 0;
    }
  };
  // Safety net for the capture-phase handlers: when we mark videoReloading on a
  // user click that *should* re-mount the player (quality option, seekbar,
  // go-live), we still need to recover if Kick decides not to reload (e.g. the
  // user clicked the already-selected quality). Without this, the flag stays
  // true, the grace timer never starts, and the button is stuck disabled until
  // fullscreen is exited.
  const RELOAD_SAFETY_MS = 5000;
  let reloadSafetyTimer = 0;
  const clearReloadSafetyTimer = () => {
    if (reloadSafetyTimer) {
      clearTimeout(reloadSafetyTimer);
      reloadSafetyTimer = 0;
    }
  };

  // Pending-enable state: when the user clicks Chat while the video is still
  // loading (readyState < 2), we defer the layout change until the video reaches
  // a stable state. Changing the fullscreen DOM mid-load can trip React's
  // reconciler (Kick is re-mounting parts of the player tree right then) and
  // end with a 404.
  let pendingVideoEl = null;
  let pendingOnReady = null;
  let pendingTimeoutId = 0;
  const clearPendingEnable = () => {
    if (pendingVideoEl && pendingOnReady) {
      pendingVideoEl.removeEventListener('loadeddata', pendingOnReady);
      pendingVideoEl.removeEventListener('canplay', pendingOnReady);
    }
    if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
    pendingVideoEl = null;
    pendingOnReady = null;
    pendingTimeoutId = 0;
  };

  const isKfcOwnedChild = (el) =>
    el === chatSlot ||
    el.id === WRAP_ID ||
    el.id === TOAST_ID ||
    el.classList?.contains('kfc-chat-slot');

  const coversFullscreen = (el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.width >= window.innerWidth * 0.7 &&
      rect.height >= window.innerHeight * 0.7
    );
  };

  const looksLikePlayerControls = (el) =>
    !!el.querySelector?.(
      'button, [role="button"], [role="slider"], [class*="group/seekbar"], [class*="seekbar"]'
    );

  // Mark direct children of fsEl that are likely to be player layers. The video
  // owner is always marked, even before it has measured. Other large layers are
  // only marked when they contain controls, which avoids turning Kick's transient
  // loading/blur overlays into transformed hit targets above the timeline.
  const looksLikeFullscreenLayer = (el) => {
    if (el.matches?.('video')) return true;
    if (el.querySelector?.('video')) return true;
    return coversFullscreen(el) && looksLikePlayerControls(el);
  };

  const refreshVideoRoots = (fsEl) => {
    if (!fsEl) return;
    const roots = Array.from(fsEl.children).filter(
      (child) =>
        child instanceof Element &&
        !isKfcOwnedChild(child) &&
        looksLikeFullscreenLayer(child)
    );
    const nextRoots = new Set(roots);
    videoRoots.forEach((root) => {
      if (!nextRoots.has(root)) root.removeAttribute(VIDEO_ROOT_ATTR);
    });
    roots.forEach((root) => root.setAttribute(VIDEO_ROOT_ATTR, ''));
    videoRoots = roots;
    refreshVideoFrames(roots);
  };

  const refreshVideoFrames = (roots) => {
    const frames = [];
    const videos = [];
    roots.forEach((root) => {
      if (root.matches?.('video')) videos.push(root);
      root.querySelectorAll?.('video').forEach((video) => {
        videos.push(video);
        let node = video.parentElement;
        while (node && node !== root) {
          if (node instanceof Element) frames.push(node);
          node = node.parentElement;
        }
      });
    });
    const nextFrames = new Set(frames);
    videoFrames.forEach((frame) => {
      if (!nextFrames.has(frame)) frame.removeAttribute(VIDEO_FRAME_ATTR);
    });
    nextFrames.forEach((frame) => frame.setAttribute(VIDEO_FRAME_ATTR, ''));
    videoFrames = Array.from(nextFrames);

    const nextVideos = new Set(videos);
    markedVideos.forEach((video) => {
      if (!nextVideos.has(video)) video.removeAttribute(VIDEO_EL_ATTR);
    });
    nextVideos.forEach((video) => video.setAttribute(VIDEO_EL_ATTR, ''));
    markedVideos = Array.from(nextVideos);
  };

  const clearVideoRoots = () => {
    videoRoots.forEach((root) => root.removeAttribute(VIDEO_ROOT_ATTR));
    videoRoots = [];
    videoFrames.forEach((frame) => frame.removeAttribute(VIDEO_FRAME_ATTR));
    videoFrames = [];
    markedVideos.forEach((video) => video.removeAttribute(VIDEO_EL_ATTR));
    markedVideos = [];
  };

  const stopVideoRootObserver = () => {
    if (videoRootObserver) {
      videoRootObserver.disconnect();
      videoRootObserver = null;
    }
    clearVideoRoots();
    videoRootHost = null;
  };

  const startVideoRootObserver = (fsEl) => {
    stopVideoRootObserver();
    videoRootHost = fsEl;
    // Re-mark on subsequent frames — when fsEl was just made fullscreen the
    // children haven't necessarily measured to their final size yet, so a
    // single sync call can miss them.
    const isPlayerMutation = (mutation) => {
      const target = mutation.target;
      return target instanceof Node && !chatSlot?.contains(target);
    };
    const refreshSoon = (mutations = []) => {
      if (mutations.length && !mutations.some(isPlayerMutation)) return;
      if (!active || videoRootHost !== fsEl) return;
      refreshVideoRoots(fsEl);
      requestAnimationFrame(() => {
        if (active && videoRootHost === fsEl) refreshVideoRoots(fsEl);
      });
      setTimeout(() => {
        if (active && videoRootHost === fsEl) refreshVideoRoots(fsEl);
      }, 150);
    };
    videoRootObserver = new MutationObserver(refreshSoon);
    videoRootObserver.observe(fsEl, { childList: true, subtree: true });
    refreshSoon();
  };

  // When the user changes stream quality (or anything else that causes Kick to reload
  // the player), Kick's React reconciliation conflicts with our layout and can
  // navigate the page to a 404 error. Tearing the layout down at the first sign of
  // a reload prevents the conflict.
  const teardownIfActive = (reason) => {
    if (!active) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) return;
    log('teardown triggered by', reason);
    disableSideChat(fs);
  };
  const onVideoEmptied = () => teardownIfActive('video emptied');
  const onVideoLoadStart = () => {
    // Ignore the initial load that happens right after we attach the listener.
    if (Date.now() - enabledAt < 1500) return;
    teardownIfActive('video loadstart');
  };
  const onPopState = () => teardownIfActive('popstate');
  window.addEventListener('popstate', onPopState);

  // Reloading the video element (via emptied/loadstart) can be too late: React's
  // reconciler may already be mid-commit, and Kick's error boundary can navigate
  // to its 404 page before our async handlers fire. Catch the user's click on
  // actions that re-mount the player (quality change, seeking) in the capture
  // phase and tear down synchronously, so the DOM is back in Kick's expected
  // shape before its onClick runs.
  const QUALITY_OPTION_RE = /^(?:auto|source|original|\d{2,4}p(?:\d{2})?(?:\s*60)?)$/i;
  // Quality items in Kick's popover are plain divs without a button/role, so closest()
  // on tag/role selectors misses them. Walk up a few levels checking textContent.
  const isQualityOptionClick = (target) => {
    let node = target;
    for (let i = 0; i < 4 && node && node !== document.body; i++) {
      const text = (node.textContent || '').trim();
      if (text && text.length <= 16 && QUALITY_OPTION_RE.test(text)) return text;
      node = node.parentElement;
    }
    return null;
  };
  // The seekbar uses Tailwind's group/seekbar class.
  const isSeekbarClick = (target) =>
    !!target.closest('[class*="group/seekbar"], [class*="seekbar"]');
  // "Go to live" / "Jump to live" — exiting DVR mode also re-mounts the player.
  const GO_LIVE_RE = /^(?:go\s*to\s*live|jump\s*to\s*live|back\s*to\s*live|skip\s*to\s*live|go\s*live)$/i;
  const isGoLiveClick = (target) => {
    let node = target;
    for (let i = 0; i < 4 && node && node !== document.body; i++) {
      const text = (node.textContent || '').trim();
      if (text && text.length <= 24 && GO_LIVE_RE.test(text)) return text;
      node = node.parentElement;
    }
    return null;
  };
  // Raise videoReloading synchronously on known reload triggers so the Chat
  // button disables before the user can click it. When side chat is active we
  // also tear down preemptively to avoid the reconciler collision; when it is
  // not, we just flip the flag so the button reflects the impending reload.
  const markReloadAndMaybeTeardown = (fs, reason) => {
    videoReloading = true;
    clearReloadSafetyTimer();
    reloadSafetyTimer = setTimeout(() => {
      reloadSafetyTimer = 0;
      // No loadstart/emptied fired — the click didn't actually reload the
      // player (likely a no-op click on the already-selected quality). Release
      // the flag so the Chat button isn't stuck disabled.
      if (videoReloading) {
        log(reason, 'safety timeout, releasing videoReloading');
        videoReloading = false;
        updateBtnLabel();
      }
    }, RELOAD_SAFETY_MS);
    if (active) {
      log(reason, 'detected, tearing down preemptively');
      disableSideChat(fs);
    } else {
      log(reason, 'detected, disabling Chat button until reload completes');
      updateBtnLabel();
    }
  };
  const onDocClickCapture = (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) return;
    const quality = isQualityOptionClick(target);
    if (quality) return markReloadAndMaybeTeardown(fs, `quality option click (${quality})`);
    if (isSeekbarClick(target)) return markReloadAndMaybeTeardown(fs, 'seekbar click');
    const goLive = isGoLiveClick(target);
    if (goLive) return markReloadAndMaybeTeardown(fs, `go-to-live click (${goLive})`);
  };
  document.addEventListener('click', onDocClickCapture, true);
  // Seeking via keyboard (arrow keys) or pointerdown on the seekbar also re-mounts
  // the player tree without going through a click event. Cover those too.
  const onDocPointerDownCapture = (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!isSeekbarClick(target)) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) return;
    markReloadAndMaybeTeardown(fs, 'seekbar pointerdown');
  };
  document.addEventListener('pointerdown', onDocPointerDownCapture, true);

  // When chat starts hidden (data-chat="false") and the user enables our side layout,
  // Kick's internal "is chat shown" state is out of sync with the DOM. The next click
  // on Kick's "Hide chat" button toggles Kick's state from hidden→shown — so data-chat
  // doesn't change to "false" and the MutationObserver doesn't fire. Catch the click
  // directly so one click always tears down, regardless of Kick's internal state.
  // Also match "Show chat": in the out-of-sync case Kick still labels its toggle
  // "Show chat" (because it thinks chat is hidden) even though our slot is visible,
  // so the first click on what the user sees as a close button is on "Show chat".
  // Listen at document level (capture) rather than on chatSlot, because when
  // Kick's React thinks chat is hidden it renders the toggle as a floating
  // button OUTSIDE the chat panel (and therefore outside our slot). That used
  // to require two clicks — the first to flip Kick's state back to "shown"
  // (no data-chat change → observer doesn't fire), the second to actually
  // close. A document-level capture handler catches the toggle wherever Kick
  // mounts it.
  // Kick's native double-click-to-exit-fullscreen handler lives on the
  // `<video>` element, but we set `pointer-events: none` on the marked
  // video while side chat is active so clicks pass through to Kick's
  // controls (introduced in 0.9.7). That also blocks the native dblclick.
  // Provide our own dblclick → exit-fullscreen while the side chat is up,
  // so users keep the same gesture they have in the non-side-chat layout.
  const onFsDblClick = (e) => {
    if (!active) return;
    // Double-click inside the chat slot is text selection / message UI —
    // don't exit fullscreen.
    if (chatSlot?.contains(e.target)) return;
    // Let interactive controls run their own handlers (timeline scrub,
    // setting buttons, etc.) without us tearing fullscreen down on top.
    if (
      e.target instanceof Element &&
      e.target.closest('button, [role="button"], [role="slider"], a, input, textarea')
    ) return;
    log('double-click on video area, exiting fullscreen');
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  };

  const CHAT_TOGGLE_RE = /(?:hide|close|collapse|show|open|expand)\s*chat/;
  // Kick's chat-toggle button is icon-only on the current UI: no text content,
  // no aria-label, no title. Fall back to recognising the arrow-with-lines SVG
  // path data lifted into BTN_SVG (Kick's own "Show chat" icon, CSS-flipped
  // when chat is open). The signature is the first ~12 chars of the arrow
  // path's `d` attribute — distinctive enough that no other button in the
  // chat panel shares it, but short enough to survive minor minifier changes.
  const KICK_CHAT_TOGGLE_PATH_SIG = 'M8.79052 14.6146';
  const looksLikeChatToggleBtn = (btn) => {
    const paths = btn.querySelectorAll('path[d]');
    for (const p of paths) {
      if ((p.getAttribute('d') || '').startsWith(KICK_CHAT_TOGGLE_PATH_SIG)) return true;
    }
    return false;
  };
  // Best-effort lookup for Kick's own chat-toggle button anywhere on the page.
  // Used during enableSideChat to sync Kick's React state when it thinks chat
  // is hidden (otherwise React reconciles our data-chat="true" back to "false"
  // and the dataChatObserver immediately tears the layout down).
  const findKickChatToggleBtn = () => {
    const buttons = document.querySelectorAll('button');
    // Pass 1: explicit text/aria/title match — the most reliable signal.
    for (const b of buttons) {
      if (b.id === BTN_ID) continue;
      const text = (b.textContent || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const title = (b.getAttribute('title') || '').toLowerCase();
      if (
        CHAT_TOGGLE_RE.test(text) ||
        CHAT_TOGGLE_RE.test(aria) ||
        CHAT_TOGGLE_RE.test(title)
      ) return b;
    }
    // Pass 2: SVG-path signature for icon-only buttons.
    for (const b of buttons) {
      if (b.id === BTN_ID) continue;
      if (looksLikeChatToggleBtn(b)) return b;
    }
    return null;
  };

  const onDocChatToggleClickCapture = (e) => {
    if (!active) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('button');
    if (!btn) return;
    if (btn.id === BTN_ID) return; // ignore our own Chat toggle
    const text = (btn.textContent || '').trim().toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    const title = (btn.getAttribute('title') || '').toLowerCase();
    if (
      !CHAT_TOGGLE_RE.test(text) &&
      !CHAT_TOGGLE_RE.test(aria) &&
      !CHAT_TOGGLE_RE.test(title) &&
      !looksLikeChatToggleBtn(btn)
    ) return;
    log('chat-toggle button clicked, scheduling teardown');
    // Let Kick's own onClick handler run first, then tear down on the next tick.
    setTimeout(() => {
      if (!active) return;
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) disableSideChat(fs);
    }, 0);
  };
  document.addEventListener('click', onDocChatToggleClickCapture, true);

  const enableSideChat = (fsEl) => {
    if (!fsEl) {
      log('enableSideChat: no fullscreen element');
      return;
    }
    if (active || pendingVideoEl) return;

    // Defer while the video is still loading — Kick's React is in the middle
    // of mounting the player tree, and changing the fullscreen DOM mid-mount
    // can still cause reconciliation to fail and Kick to navigate to its 404
    // page.
    const probeVideo = fsEl.querySelector('video');
    if (!probeVideo) {
      log('no video element yet, ignoring click — button should be disabled');
      return;
    }
    if (videoReloading || probeVideo.readyState < 2) {
      log('video still loading (readyState=', probeVideo.readyState, '), deferring enable');
      pendingVideoEl = probeVideo;
      pendingOnReady = () => {
        clearPendingEnable();
        const currentFs = document.fullscreenElement || document.webkitFullscreenElement;
        if (currentFs && !active) enableSideChat(currentFs);
      };
      // 10s ceiling so a stalled load doesn't leave the user stuck. If we hit
      // it we silently abandon — the next Chat click can retry.
      pendingTimeoutId = setTimeout(() => {
        log('video load deadline reached, abandoning pending enable');
        clearPendingEnable();
      }, 10000);
      probeVideo.addEventListener('loadeddata', pendingOnReady);
      probeVideo.addEventListener('canplay', pendingOnReady);
      return;
    }

    const chat = findChat();
    if (!chat) {
      warn('chat container not found. Tried selectors:', CHAT_SELECTORS);
      showToast('Kick Fullscreen Chat: could not find the chat panel.');
      return;
    }
    log('enableSideChat: using chat node', chat);

    // If Kick's React state currently says chat is HIDDEN, just writing
    // data-chat="true" is not enough: React will reconcile the attribute back
    // to "false" on its next commit, our dataChatObserver fires, and the
    // side-chat layout collapses immediately. Sync Kick's state first by
    // programmatically clicking its own chat-toggle button — that flips
    // React's `isChatShown` to true so the attribute write below is what
    // React itself wants and the reconcile is a no-op.
    const dataChatHostBefore = document.querySelector('[data-chat]');
    const kickStateHidden =
      dataChatHostBefore?.getAttribute('data-chat') === 'false';
    if (kickStateHidden) {
      const kickBtn = findKickChatToggleBtn();
      if (kickBtn) {
        log('Kick state is hidden; syncing via programmatic click on Kick toggle');
        // Suppress both the dataChatObserver (Kick's onClick may set
        // data-chat="true" → no teardown wanted) and the document-level
        // chat-toggle click capture (active is still false here so it would
        // bail anyway, but be defensive).
        suppressObserver = true;
        kickBtn.click();
        // Release after Kick's React has had a tick to commit the state flip.
        setTimeout(() => { suppressObserver = false; }, 0);
      } else {
        warn('Kick state is hidden but no chat-toggle button found to sync');
      }
    }

    // Make sure Kick's CSS is in the "chat visible" state before we move the node.
    suppressObserver = true;
    const flipped = setKickDataChat('true');
    log('enableSideChat: set data-chat="true" on', flipped, 'element(s)');
    // Release the suppression on the next microtask so the observer ignores our own write.
    queueMicrotask(() => {
      suppressObserver = false;
    });
    // Open the reconcile-guard window: if React commits data-chat="false"
    // shortly after this enable (because the programmatic sync click didn't
    // find a button or didn't flip Kick's state), the observer below will
    // re-assert "true" instead of tearing the layout down.
    enableSyncUntil = Date.now() + 500;

    chatSlot = document.createElement('div');
    chatSlot.className = 'kfc-chat-slot';
    // Note: the chat-toggle click handler is attached at document level so it
    // catches Kick's floating "Show chat" button (rendered outside chatSlot
    // when Kick's internal state thinks chat is hidden), not just clicks
    // inside the panel.

    savedChatParent = chat.parentNode;
    savedChatNextSibling = chat.nextSibling;
    chatSlot.appendChild(chat);

    fsEl.appendChild(chatSlot);
    fsEl.classList.add('kfc-active');

    active = true;
    // Mark Kick's player layers in place so the CSS shrink applies without
    // moving them into a wrapper (which would break React's reconciler on
    // background refreshes and 404 the page).
    startVideoRootObserver(fsEl);
    // Adopt Kick's body-portaled popovers (emote-name tooltips, etc.) into
    // fsEl so they remain visible while in fullscreen.
    startPopoverPortal(fsEl);

    const wrap = document.getElementById(WRAP_ID);
    if (wrap) fsEl.appendChild(wrap);

    enabledAt = Date.now();
    videoEl = fsEl.querySelector('video');
    if (videoEl) {
      videoEl.addEventListener('emptied', onVideoEmptied);
      videoEl.addEventListener('loadstart', onVideoLoadStart);
    }
    fsEl.addEventListener('dblclick', onFsDblClick);
    updateBtnLabel();
    nudgePlayerResize();
  };

  const disableSideChat = (fsEl) => {
    if (!fsEl || !chatSlot) return;
    // Mark inactive immediately so re-entrant teardown attempts (e.g. popstate firing
    // while we're already cleaning up) short-circuit out.
    active = false;
    stopVideoRootObserver();
    stopPopoverPortal();
    if (videoEl) {
      videoEl.removeEventListener('emptied', onVideoEmptied);
      videoEl.removeEventListener('loadstart', onVideoLoadStart);
      videoEl = null;
    }
    fsEl.removeEventListener('dblclick', onFsDblClick);

    // Put chat back where it came from.
    const chat = chatSlot.firstChild;
    if (chat && savedChatParent) {
      if (savedChatNextSibling && savedChatNextSibling.parentNode === savedChatParent) {
        savedChatParent.insertBefore(chat, savedChatNextSibling);
      } else {
        savedChatParent.appendChild(chat);
      }
    }

    fsEl.classList.remove('kfc-active');
    chatSlot.remove();
    chatSlot = null;
    savedChatParent = null;
    savedChatNextSibling = null;

    // If we're still in fullscreen after the teardown (i.e. this wasn't an
    // exit-fullscreen teardown), re-arm the monitor so it picks up any new
    // <video> element Kick mounts. Callers that know a reload is imminent
    // (quality change, seek, go-live) set videoReloading=true *before*
    // calling here so the button stays disabled across the gap until the
    // monitor's loadstart/canplay events take over.
    const stillFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (stillFs === fsEl) {
      startVideoLoadingMonitor(fsEl);
    }

    updateBtnLabel();

    // Re-attach the toggle button wrapper to the fullscreen element so it stays visible.
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) fsEl.appendChild(wrap);

    nudgePlayerResize();
  };

  // Kick's player computes video dimensions from window size, not from its parent.
  // After we swap layouts we need to convince it to re-measure. A single resize on
  // the same tick often misses, so we fire on the next frame and once more shortly
  // after for good measure.
  const nudgePlayerResize = () => {
    const fire = () => window.dispatchEvent(new Event('resize'));
    fire();
    requestAnimationFrame(fire);
    setTimeout(fire, 150);
  };

  const updateBtnLabel = () => {
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) wrap.classList.toggle('kfc-hidden', active);
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const label = btn.querySelector('span');
    if (label) label.textContent = 'Chat';
    
    // Check video loading state to set correct disabled state and aria-label
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) {
      const video = fs.querySelector('video');
      const isLoaded = !videoReloading && video && video.readyState >= 2;
      btn.disabled = !isLoaded;
      btn.setAttribute('aria-label', isLoaded ? 'Show chat' : 'Loading video...');
    } else {
      btn.setAttribute('aria-label', 'Show chat');
    }
  };

  // Events that may change whether the button should be enabled. `loadstart`/
  // `emptied` are reload triggers (handled by onVideoBuffering, which also
  // raises videoReloading). The rest are benign state changes (buffering during
  // playback, seeking, etc.) where we just want updateBtnLabel to reflect the
  // current readyState without touching the reload flag.
  const VIDEO_STATE_EVENTS = ['waiting', 'stalled', 'seeking', 'seeked', 'playing', 'pause'];

  const detachVideoListeners = () => {
    if (fullscreenVideoEl) {
      if (onVideoLoaded) {
        fullscreenVideoEl.removeEventListener('loadeddata', onVideoLoaded);
        fullscreenVideoEl.removeEventListener('canplay', onVideoLoaded);
      }
      if (onVideoBuffering) {
        fullscreenVideoEl.removeEventListener('loadstart', onVideoBuffering);
        fullscreenVideoEl.removeEventListener('emptied', onVideoBuffering);
      }
      if (onVideoStateChange) {
        VIDEO_STATE_EVENTS.forEach((evt) =>
          fullscreenVideoEl.removeEventListener(evt, onVideoStateChange)
        );
      }
    }
    fullscreenVideoEl = null;
    onVideoLoaded = null;
    onVideoBuffering = null;
    onVideoStateChange = null;
  };

  const attachVideoListeners = (video) => {
    fullscreenVideoEl = video;
    onVideoLoaded = () => {
      // Don't clear the flag immediately — schedule it. A `loadstart`/`emptied`
      // that fires during the grace window will cancel the timer and keep the
      // button disabled until the next stable canplay.
      clearVideoReadyTimer();
      log('video reported ready, deferring button re-enable by', VIDEO_READY_GRACE_MS, 'ms');
      videoReadyTimer = setTimeout(() => {
        videoReadyTimer = 0;
        // Re-check that the video is still actually loaded — Kick may have
        // started another reload during the grace window without us seeing a
        // loadstart (e.g. element swap).
        const fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (!fs) return;
        const current = fullscreenVideoEl;
        if (!current || current.readyState < 2) {
          log('grace expired but video no longer ready, keeping button disabled');
          return;
        }
        videoReloading = false;
        updateBtnLabel();
        log('grace expired, button enabled');
      }, VIDEO_READY_GRACE_MS);
    };
    // loadstart/emptied also fire when Kick remounts/reloads the player, so
    // catch them here too — re-enabling the button only happens once we hear
    // canplay/loadeddata again and the grace timer elapses.
    onVideoBuffering = () => {
      // A real reload is underway — let the canplay/loadeddata + grace path
      // take over and stop the capture-phase safety net.
      clearReloadSafetyTimer();
      clearVideoReadyTimer();
      videoReloading = true;
      updateBtnLabel();
      log('video buffering/reloading, button disabled');
    };
    // updateBtnLabel reads video.readyState directly, so re-running it on every
    // playback state change keeps the Chat button disabled whenever the video
    // is loading/buffering — without needing the videoReloading flag for the
    // benign cases.
    onVideoStateChange = () => {
      updateBtnLabel();
    };
    video.addEventListener('loadeddata', onVideoLoaded);
    video.addEventListener('canplay', onVideoLoaded);
    video.addEventListener('loadstart', onVideoBuffering);
    video.addEventListener('emptied', onVideoBuffering);
    VIDEO_STATE_EVENTS.forEach((evt) => video.addEventListener(evt, onVideoStateChange));
  };

  const startVideoLoadingMonitor = (fsEl) => {
    // Remember which element we were on *before* the detach. Re-attaching
    // to the same element should NOT synthesize a synthetic onVideoLoaded —
    // the readyState we'd be reading is stale (the player is mid-reload),
    // and triggering the grace timer here would re-enable the button before
    // Kick has actually swapped to the new video. We only synthesize when
    // we land on a genuinely different element.
    const previousVideo = fullscreenVideoEl;
    detachVideoListeners();
    if (videoSwapObserver) {
      videoSwapObserver.disconnect();
      videoSwapObserver = null;
    }

    const tryAttach = () => {
      const video = fsEl.querySelector('video');
      if (!video) return false;
      if (video === fullscreenVideoEl) return true;
      detachVideoListeners();
      attachVideoListeners(video);
      // Synthesize the grace-delayed clear only when we attached to a
      // genuinely different <video> element than the previous one — this
      // covers the case where Kick swapped the element fast enough that the
      // new one is already past readyState 2 by the time the
      // MutationObserver wakes. For same-element re-attach (e.g. the initial
      // call inside disableSideChat right after a quality click), we wait
      // for the real loadstart → loadeddata/canplay sequence instead.
      if (video !== previousVideo && videoReloading && video.readyState >= 2 && onVideoLoaded) {
        onVideoLoaded();
      }
      updateBtnLabel();
      log('video monitor attached, readyState=', video.readyState, 'newElement=', video !== previousVideo);
      return true;
    };

    tryAttach();

    // Kick may replace the <video> element entirely on quality change or DVR
    // exit — re-attach listeners whenever the player subtree changes. Skip
    // mutations whose target is inside our chat slot: chat-message churn
    // would otherwise fire this callback hundreds of times per minute during
    // busy streams, each running a fresh querySelector('video') on the
    // whole fsEl subtree. Same filter trick videoRootObserver uses.
    videoSwapObserver = new MutationObserver((mutations) => {
      if (chatSlot && mutations.every((m) => chatSlot.contains(m.target))) return;
      const currentVideo = fsEl.querySelector('video');
      if (!currentVideo) return;
      if (currentVideo !== fullscreenVideoEl) {
        log('video element swapped, re-attaching monitor');
        tryAttach();
      }
    });
    videoSwapObserver.observe(fsEl, { childList: true, subtree: true });
  };

  const stopVideoLoadingMonitor = () => {
    clearVideoReadyTimer();
    clearReloadSafetyTimer();
    detachVideoListeners();
    if (videoSwapObserver) {
      videoSwapObserver.disconnect();
      videoSwapObserver = null;
    }
    videoReloading = false;
  };

  // Kick renders small popovers (emote-name tooltips, etc.) by appending them
  // to document.body. The Fullscreen API only displays descendants of the
  // fullscreen element, so once the player is fullscreen, hovering an emote
  // inside the side chat shows no tooltip even though Kick is rendering one.
  //
  // We *clone* these popovers into fsEl rather than moving them. Moving them
  // (the obvious approach) breaks React's reconciliation: Kick uses
  // createPortal with body as the container, and React's unmount path calls
  // body.removeChild(popover) on cleanup. If the popover has been moved into
  // fsEl, removeChild throws NotFoundError, Kick's error boundary catches it,
  // and the page navigates to its 404 / "We are sorry, something went wrong"
  // page (with the moved popover left stranded on top of the 404).
  //
  // Cloning side-steps that. The original stays in body where React expects
  // it (and is unmounted normally — invisibly to the user, since the
  // Fullscreen API hides it). The clone in fsEl is what the user actually
  // sees. We track original→clone in a Map, and remove the clone when the
  // original is removed from body. Styling carries over because the clone
  // keeps the original's class names and inline styles — global Kick /
  // Tailwind rules match the clone the same way they match the original.
  // Position is preserved because Floating UI / Radix write
  // viewport-relative `position: fixed` inline styles, which render the
  // clone in the same screen location as the (hidden) original.
  //
  // A per-popover sync observer (`popoverSyncObservers`) re-clones when the
  // original's subtree changes (childList / characterData). React often
  // mounts the popover wrapper first and writes the tooltip content into
  // it on a later commit; without sync, the initial clone would be the
  // empty wrapper and the user would see nothing. We also take a couple of
  // delayed one-shot re-clones after adoption to catch tooltip wrappers
  // whose final `style` / `data-state` lands via attribute-only updates,
  // without observing animation attributes forever.
  //
  // The design system rule "no tooltips, no menus, no popovers" applies to
  // UI we paint ourselves, not to making Kick's existing popovers visible.
  const POPOVER_SELECTORS = [
    '[role="tooltip"]',
    '[data-radix-popper-content-wrapper]',
    '[data-radix-portal]',
    '[data-floating-ui-portal]',
    '[data-popper-placement]',
  ];
  const POPOVER_SELECTOR_STR = POPOVER_SELECTORS.join(',');
  const POPOVER_CLONE_ATTR = 'data-kfc-popover-clone';

  const isPopoverHost = (el) =>
    el instanceof Element &&
    (el.matches?.(POPOVER_SELECTOR_STR) || !!el.querySelector?.(POPOVER_SELECTOR_STR));

  let popoverPortalObserver = null;
  let popoverPortalHost = null;
  const popoverClones = new Map(); // original Element -> clone Element
  const popoverSyncObservers = new Map(); // original Element -> MutationObserver

  const removePopoverClone = (original) => {
    const clone = popoverClones.get(original);
    if (clone) {
      try {
        clone.remove();
      } catch (err) {
        log('remove popover clone failed:', err);
      }
      popoverClones.delete(original);
    }
    const syncObserver = popoverSyncObservers.get(original);
    if (syncObserver) {
      syncObserver.disconnect();
      popoverSyncObservers.delete(original);
    }
  };

  const adoptPopover = (node, fsEl) => {
    if (!(node instanceof Element)) return;
    if (fsEl.contains(node) || isKfcOwnedChild(node)) return;
    if (node.hasAttribute?.(POPOVER_CLONE_ATTR)) return;
    if (!isPopoverHost(node)) return;
    if (popoverClones.has(node)) return;
    // With subtree:true on the body observer we can see popovers added at
    // any depth, so check whether one of our existing adopted originals
    // already contains this node — if so, the sync observer on that
    // adopted ancestor will already track the new content.
    for (const adopted of popoverClones.keys()) {
      if (adopted.contains?.(node)) return;
    }

    // React mounts the popover wrapper first and writes the tooltip content
    // into it on a later commit. A single clone taken at adoption time
    // therefore captures an empty wrapper and the user sees nothing.
    // Re-clone the original on subtree mutations (childList / characterData)
    // so the clone tracks the original. Attribute mutations are not observed
    // continuously because Radix/Floating UI flip `data-state` / inline
    // `style` on animation ticks; delayed one-shot re-clones below catch
    // the settled visible/positioned state without permanent churn.
    let pendingReclone = false;
    const performReclone = () => {
      pendingReclone = false;
      if (!popoverClones.has(node) && popoverSyncObservers.get(node) == null) return; // disposed
      if (!document.body.contains(node)) return; // original already gone
      try {
        const newClone = node.cloneNode(true);
        newClone.setAttribute(POPOVER_CLONE_ATTR, '');
        const existing = popoverClones.get(node);
        if (existing && existing.parentNode) {
          existing.replaceWith(newClone);
        } else {
          fsEl.appendChild(newClone);
        }
        popoverClones.set(node, newClone);
      } catch (err) {
        log('reclone popover failed:', err);
      }
    };
    const scheduleReclone = () => {
      if (pendingReclone) return;
      pendingReclone = true;
      requestAnimationFrame(performReclone);
    };

    try {
      const clone = node.cloneNode(true);
      clone.setAttribute(POPOVER_CLONE_ATTR, '');
      fsEl.appendChild(clone);
      popoverClones.set(node, clone);
    } catch (err) {
      log('clone popover failed:', err);
      return;
    }

    const syncObserver = new MutationObserver(() => scheduleReclone());
    syncObserver.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    popoverSyncObservers.set(node, syncObserver);
    requestAnimationFrame(scheduleReclone);
    setTimeout(scheduleReclone, 50);
    setTimeout(scheduleReclone, 150);
    log('cloned popover into fsEl');
  };

  // Reconcile tracked originals when something is removed from body. The
  // direct match handles the common case (Kick removes the popover wrapper
  // itself). The contains() scan handles the rarer case where a removed
  // ancestor took our tracked popover with it. The final `document.body.contains`
  // sweep covers anything we missed (e.g. removals deeper than the direct
  // children we observe).
  const reconcilePopoverClones = (removedNode) => {
    if (removedNode instanceof Element && popoverClones.has(removedNode)) {
      removePopoverClone(removedNode);
    }
    const toRemove = [];
    popoverClones.forEach((_clone, original) => {
      if (
        (removedNode instanceof Element && removedNode.contains?.(original)) ||
        !document.body.contains(original)
      ) {
        toRemove.push(original);
      }
    });
    toRemove.forEach((o) => removePopoverClone(o));
  };

  const startPopoverPortal = (fsEl) => {
    stopPopoverPortal();
    popoverPortalHost = fsEl;
    // Adopt any popovers that are already on screen when we activate. Scan
    // the whole body subtree so we catch popovers Kick already mounted into
    // nested portal containers before we started observing.
    document.body.querySelectorAll(POPOVER_SELECTOR_STR).forEach((el) => {
      if (!fsEl.contains(el)) adoptPopover(el, fsEl);
    });
    popoverPortalObserver = new MutationObserver((muts) => {
      if (popoverPortalHost !== fsEl) return;
      for (const m of muts) {
        m.addedNodes.forEach((n) => adoptPopover(n, fsEl));
        m.removedNodes.forEach((n) => reconcilePopoverClones(n));
      }
    });
    // subtree:true so we catch popovers Kick mounts into nested portal
    // containers (not all React apps portal directly to body — some
    // userscripts and Kick chrome may add intermediate containers).
    popoverPortalObserver.observe(document.body, { childList: true, subtree: true });
  };

  const stopPopoverPortal = () => {
    if (popoverPortalObserver) {
      popoverPortalObserver.disconnect();
      popoverPortalObserver = null;
    }
    popoverSyncObservers.forEach((observer) => observer.disconnect());
    popoverSyncObservers.clear();
    popoverClones.forEach((clone) => {
      try {
        clone.remove();
      } catch (err) {
        log('teardown remove popover clone failed:', err);
      }
    });
    popoverClones.clear();
    popoverPortalHost = null;
  };

  // Twitch-style streamer info overlay. We *clone* Kick's existing channel-info
  // card into fsEl rather than moving it, for the same reason as popovers:
  // Kick's React reconciler may unmount or replace the card in the background,
  // and a moved node would no longer be where React expects it. Cloning keeps
  // the original in its normal DOM location while the user sees a copy
  // overlaid on the fullscreen player. The clone inherits Kick's class names
  // and global Tailwind styling so it renders with Kick's avatar / verified
  // badge / emote / viewer-count formatting. A debounced MutationObserver
  // re-clones when the source's content changes (title edit, viewer count
  // tick, etc.), so the overlay stays in sync.
  const findStreamerInfoSource = () => {
    // 1. Try known direct selectors first.
    for (const s of STREAMER_INFO_SELECTORS) {
      try {
        const el = document.querySelector(s);
        if (el) return el;
      } catch (err) {
        // Selector syntax error in a fallback shouldn't break the rest.
      }
    }
    const player = document.querySelector(
      '#injected-channel-player, [data-testid="player"]'
    );
    const pathSegments = (window.location.pathname || '')
      .split('/')
      .filter(Boolean);
    const usernameSlug =
      pathSegments[0] && !pathSegments[0].includes('.') ? pathSegments[0] : null;
    // 2. Avatar-anchored search (primary). The avatar is the most distinct
    //    element of the streamer card and lives inside a link back to the
    //    streamer's own profile — `a[href="/${username}"]`. Walk up from
    //    that link until we hit an ancestor that also contains a category
    //    link (the game) and meets reasonable card dimensions. This finds
    //    the FULL card (avatar + name + title + game + tags) instead of
    //    just the title+tags sub-row that the older category-link walk
    //    landed on.
    if (usernameSlug) {
      const slug = CSS.escape(usernameSlug);
      const profileImgSelector =
        `a[href="/${slug}" i] img, a[href="/${slug}/" i] img, ` +
        `a[href="/${slug}" i] picture, a[href="/${slug}/" i] picture`;
      const avatars = document.querySelectorAll(profileImgSelector);
      for (const avatar of avatars) {
        let node = avatar.parentElement;
        for (let i = 0; i < 12 && node && node !== document.body; i++) {
          if (player && node.contains(player)) break;
          const rect = node.getBoundingClientRect();
          if (
            rect.width > 200 &&
            rect.height > 60 &&
            rect.height < window.innerHeight * 0.7 &&
            node.querySelector('a[href*="/categories/"], a[href*="/category/"]')
          ) {
            return node;
          }
          node = node.parentElement;
        }
      }
    }
    // 3. Category-link walk fallback. Used when no profile-link-wrapped
    //    avatar is found (e.g., URL slug doesn't match the rendered link).
    //    Requires h1/h2/h3 OR profile link + an avatar img + reasonable
    //    dimensions.
    const profileLinkSelector = usernameSlug
      ? `a[href="/${CSS.escape(usernameSlug)}" i], a[href="/${CSS.escape(usernameSlug)}/" i]`
      : null;
    const hasStreamerNameSignal = (el) => {
      if (el.querySelector('h1, h2, h3')) return true;
      if (profileLinkSelector && el.querySelector(profileLinkSelector)) return true;
      return false;
    };
    const categoryLinks = document.querySelectorAll(
      'a[href*="/categories/"], a[href*="/category/"]'
    );
    for (const link of categoryLinks) {
      let node = link.parentElement;
      for (let i = 0; i < 12 && node && node !== document.body; i++) {
        if (player && node.contains(player)) break;
        const rect = node.getBoundingClientRect();
        if (
          rect.width > 200 &&
          rect.height > 80 &&
          rect.height < window.innerHeight * 0.7 &&
          node.querySelector('img, picture, [class*="avatar" i]') &&
          hasStreamerNameSignal(node)
        ) {
          return node;
        }
        node = node.parentElement;
      }
    }
    return null;
  };

  // Viewer-count badge on Kick (e.g., "770 Viewers" with a small people
  // icon). Kick renders this outside the compact streamer card we clone for
  // the avatar / name / title, so it has to be found and cloned separately,
  // then appended to the overlay as a sibling of the streamer-card clone.
  const findViewerCountSource = () => {
    // Direct selectors first.
    for (const s of VIEWER_COUNT_SELECTORS) {
      try {
        const el = document.querySelector(s);
        if (el) return el;
      } catch (err) {}
    }
    // Content-based fallback. Find the smallest element whose textContent
    // matches the viewer-count pattern. Constrain by length so we only
    // capture the badge (number + label) and not a larger ancestor that
    // happens to enclose it.
    const candidates = document.querySelectorAll('div, span, p, a, button');
    let best = null;
    for (const el of candidates) {
      const text = (el.textContent || '').trim();
      if (text.length === 0 || text.length > 30) continue;
      if (!VIEWER_COUNT_RE.test(text)) continue;
      if (
        !best ||
        text.length < (best.textContent || '').trim().length
      ) {
        best = el;
      }
    }
    return best;
  };

  // Post-process the cloned streamer card before mounting it in the overlay.
  // Two changes from Kick's source layout:
  //  - Hide the tag pills around the category link (e.g., `Czech`, `irl`,
  //    `czech`, `vanlife`). The category itself (the green link) stays.
  //  - Inline the viewer-count badge right after the category link, with
  //    a CSS-drawn circle separator, so the bottom row reads "IRL • 682"
  //    instead of having a separate viewer-count row below.
  // Heuristic: walk the category link's parent element and hide siblings
  // that look like tag pills (short text, no images or headings). The
  // viewer-count source is cloned in place (preserving Kick's animated
  // digit component) and added as a sibling of the category link.
  const styleViewerCountClone = (viewerClone) => {
    for (const node of [viewerClone, ...viewerClone.querySelectorAll('*')]) {
      node.style.setProperty('background', 'transparent', 'important');
      node.style.setProperty('background-color', 'transparent', 'important');
      node.style.setProperty('border-color', 'transparent', 'important');
      node.style.setProperty('box-shadow', 'none', 'important');
      node.style.setProperty('text-shadow', 'none', 'important');
      if (node instanceof SVGElement) {
        node.style.setProperty('fill', '#fff', 'important');
        node.style.setProperty('stroke', '#fff', 'important');
      }
      if (node.matches?.('[class~="text-primary-base"]')) {
        node.style.setProperty('color', VIEWER_COUNT_COLOR, 'important');
      }
      if (node.matches?.('[class~="text-subtle"]')) {
        node.style.setProperty('color', '#fff', 'important');
      }
    }
  };

  const normalizePath = (href) => {
    try {
      return new URL(href, window.location.origin).pathname.replace(/\/$/, '');
    } catch (err) {
      return '';
    }
  };

  const findNativeCategoryTarget = (href) => {
    const wantedPath = normalizePath(href);
    if (!infoOverlaySource || !wantedPath) return null;
    for (const link of infoOverlaySource.querySelectorAll('a[href]')) {
      if (normalizePath(link.getAttribute('href')) === wantedPath) return link;
    }
    return infoOverlaySource.querySelector(
      'a[href*="/categories/" i], a[href*="/category/" i]'
    );
  };

  const findNativeProfileTarget = () => {
    if (!infoOverlaySource) return null;
    const profilePath = getCurrentChannelPath();
    if (!profilePath) return null;
    for (const link of infoOverlaySource.querySelectorAll('a[href]')) {
      if (normalizePath(link.getAttribute('href')) === profilePath) return link;
    }
    const nameOrAvatar = infoOverlaySource.querySelector(
      'h1, h2, h3, [class*="username" i], [class*="streamer-name" i], [class*="channel-name" i], img, picture, [class*="avatar" i]'
    );
    return nameOrAvatar?.closest('button, a[href]') || null;
  };

  const makeProfileAffordancesClickable = (cardClone) => {
    const profilePath = getCurrentChannelPath();
    if (!profilePath) return;
    const profileUrl = new URL(profilePath, window.location.origin).href;
    const navigate = (event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      clickNativeOrNavigate(findNativeProfileTarget(), profileUrl);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      clickNativeOrNavigate(findNativeProfileTarget(), profileUrl);
    };

    const candidates = new Set([
      ...cardClone.querySelectorAll(
        'h1, h2, h3, [class*="username" i], [class*="streamer-name" i], [class*="channel-name" i]'
      ),
    ]);
    const avatar = cardClone.querySelector('img, picture, [class*="avatar" i]');
    if (avatar) candidates.add(avatar);
    for (const candidate of candidates) {
      const anchor = candidate.closest('a[href]');
      if (anchor) {
        wireOverlayNavigation(
          anchor,
          findNativeProfileTarget,
          new URL(anchor.getAttribute('href'), window.location.origin).href
        );
        continue;
      }
      const target = candidate.closest('button') || candidate;
      target.setAttribute('role', 'link');
      target.setAttribute('tabindex', '0');
      target.style.setProperty('cursor', 'pointer', 'important');
      target.addEventListener('click', navigate);
      target.addEventListener('keydown', onKeyDown);
    }
  };

  const transformClonedCard = (cardClone) => {
    makeProfileAffordancesClickable(cardClone);
    // Hide chevron / dropdown indicator buttons: a button containing only
    // an svg with no visible text or image. Kick puts one of these next
    // to the title to open an "expand title / description" popover; the
    // popover isn't wired up in our cloned-and-detached overlay, so the
    // button does nothing and just looks broken. Verified-badge buttons
    // (which have aria-label "verified") and avatar-wrapping buttons
    // (which contain an img) are exempted.
    for (const btn of cardClone.querySelectorAll('button')) {
      if (btn.querySelector('img, picture')) continue;
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('verified')) continue;
      if ((btn.textContent || '').trim().length > 0) continue;
      if (!btn.querySelector('svg')) continue;
      btn.style.display = 'none';
    }
    const categoryLink = cardClone.querySelector(
      'a[href*="/categories/" i], a[href*="/category/" i]'
    );
    if (!categoryLink) return;
    const categoryHref = categoryLink.getAttribute('href');
    wireOverlayNavigation(
      categoryLink,
      () => findNativeCategoryTarget(categoryHref),
      new URL(categoryHref, window.location.origin).href
    );
    categoryLink.classList.add('kfc-info-category-inline');
    for (const node of [categoryLink, ...categoryLink.querySelectorAll('*')]) {
      node.style.setProperty('background', 'transparent', 'important');
      node.style.setProperty('background-color', 'transparent', 'important');
      node.style.setProperty('box-shadow', 'none', 'important');
      node.style.setProperty('text-shadow', 'none', 'important');
    }
    const tagsRow = categoryLink.parentElement;
    if (tagsRow) {
      for (const sibling of Array.from(tagsRow.children)) {
        if (sibling === categoryLink) continue;
        if (sibling.contains(categoryLink)) continue;
        // Only hide simple tag-pill-shaped siblings: short text, no
        // imagery or heading content (so name/title rows are never hit
        // even on layouts where they share a parent with the category).
        if (sibling.querySelector('img, picture, svg, h1, h2, h3')) continue;
        const text = (sibling.textContent || '').trim();
        if (text.length === 0 || text.length > 30) continue;
        sibling.style.display = 'none';
      }
    }
    if (infoViewerSource && document.body.contains(infoViewerSource)) {
      const viewerClone = infoViewerSource.cloneNode(true);
      viewerClone.classList.add('kfc-info-viewer-inline');
      styleViewerCountClone(viewerClone);
      const separator = document.createElement('span');
      separator.className = 'kfc-info-separator';
      separator.setAttribute('aria-hidden', 'true');
      categoryLink.after(separator, viewerClone);
    }
  };

  const recloneInfoOverlay = () => {
    infoOverlayPending = false;
    if (!infoOverlay || !infoOverlaySource) return;
    if (!document.body.contains(infoOverlaySource)) return;
    try {
      const cardClone = infoOverlaySource.cloneNode(true);
      transformClonedCard(cardClone);
      infoOverlay.replaceChildren(cardClone);
    } catch (err) {
      log('reclone info overlay failed:', err);
    }
  };

  const syncViewerCloneAttributes = () => {
    infoViewerAttrSyncPending = false;
    if (!infoOverlay || !infoViewerSource || !document.body.contains(infoViewerSource)) return;
    const viewerClone = infoOverlay.querySelector('.kfc-info-viewer-inline');
    if (!viewerClone) return;
    const sourceNodes = [infoViewerSource, ...infoViewerSource.querySelectorAll('*')];
    const cloneNodes = [viewerClone, ...viewerClone.querySelectorAll('*')];
    const total = Math.min(sourceNodes.length, cloneNodes.length);
    for (let i = 0; i < total; i++) {
      const source = sourceNodes[i];
      const clone = cloneNodes[i];
      const sourceStyle = source.getAttribute('style');
      if (sourceStyle == null) clone.removeAttribute('style');
      else clone.setAttribute('style', sourceStyle);
      if (i > 0) {
        const sourceClass = source.getAttribute('class');
        if (sourceClass == null) clone.removeAttribute('class');
        else clone.setAttribute('class', sourceClass);
      }
    }
    styleViewerCountClone(viewerClone);
  };

  const scheduleViewerAttrSync = () => {
    if (infoViewerAttrSyncPending) return;
    infoViewerAttrSyncPending = true;
    requestAnimationFrame(syncViewerCloneAttributes);
  };

  const onViewerSourceMutation = (mutations) => {
    if (mutations.some((mutation) => mutation.type === 'attributes')) {
      scheduleViewerAttrSync();
    }
    if (mutations.some((mutation) => mutation.type !== 'attributes')) {
      scheduleInfoReclone();
    }
  };

  const scheduleInfoReclone = () => {
    if (infoOverlayPending) return;
    infoOverlayPending = true;
    requestAnimationFrame(recloneInfoOverlay);
  };

  // Kick may re-mount the channel-info card or the viewer-count badge while
  // we're in fullscreen (SPA channel navigation, React reconciler swaps,
  // etc.). When that happens, our observers are stuck on the orphaned
  // original and the overlay would freeze on stale data. A body-level
  // observer watches for our tracked sources detaching and, when one does,
  // re-runs the relevant finder and re-attaches its sync observer. The
  // viewer source is only refound if we had one originally — if no viewer
  // badge was present at mount time, we don't keep searching (cheap-out).
  const refindInfoSources = () => {
    if (!infoOverlay) return;
    let changed = false;
    if (
      infoOverlaySource &&
      !document.body.contains(infoOverlaySource)
    ) {
      const newSource = findStreamerInfoSource();
      if (newSource && newSource !== infoOverlaySource) {
        if (infoOverlayObserver) infoOverlayObserver.disconnect();
        infoOverlaySource = newSource;
        infoOverlayObserver = new MutationObserver(scheduleInfoReclone);
        infoOverlayObserver.observe(newSource, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        log('refindInfoSources: re-attached to streamer source');
        changed = true;
      } else if (!newSource) {
        if (infoOverlayObserver) infoOverlayObserver.disconnect();
        infoOverlayObserver = null;
        infoOverlaySource = null;
        log('refindInfoSources: streamer source lost, no replacement');
        changed = true;
      }
    }
    if (
      infoViewerSource &&
      !document.body.contains(infoViewerSource)
    ) {
      const newViewer = findViewerCountSource();
      if (newViewer && newViewer !== infoViewerSource) {
        if (infoViewerObserver) infoViewerObserver.disconnect();
        infoViewerSource = newViewer;
        infoViewerObserver = new MutationObserver(onViewerSourceMutation);
        infoViewerObserver.observe(newViewer, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
        log('refindInfoSources: re-attached to viewer source');
        changed = true;
      } else if (!newViewer) {
        if (infoViewerObserver) infoViewerObserver.disconnect();
        infoViewerObserver = null;
        infoViewerSource = null;
        log('refindInfoSources: viewer source lost, no replacement');
        changed = true;
      }
    }
    if (changed) scheduleInfoReclone();
  };

  let infoBodyObserver = null;
  let infoBodyCheckPending = false;
  const startInfoSourceWatcher = () => {
    stopInfoSourceWatcher();
    infoBodyObserver = new MutationObserver(() => {
      if (infoBodyCheckPending) return;
      infoBodyCheckPending = true;
      requestAnimationFrame(() => {
        infoBodyCheckPending = false;
        if (!infoOverlay) return;
        const sourceLost =
          infoOverlaySource && !document.body.contains(infoOverlaySource);
        const viewerLost =
          infoViewerSource && !document.body.contains(infoViewerSource);
        if (sourceLost || viewerLost) refindInfoSources();
      });
    });
    infoBodyObserver.observe(document.body, { childList: true, subtree: true });
  };
  const stopInfoSourceWatcher = () => {
    if (infoBodyObserver) {
      infoBodyObserver.disconnect();
      infoBodyObserver = null;
    }
    infoBodyCheckPending = false;
  };

  const mountInfoOverlay = (fsEl) => {
    unmountInfoOverlay();
    const source = findStreamerInfoSource();
    if (!source) {
      warn(
        'streamer info card not found — overlay disabled. Inspect Kick\'s channel-info element and add its selector to STREAMER_INFO_SELECTORS near the top of the userscript.'
      );
      return;
    }
    log('mountInfoOverlay: cloning source', source);

    const viewerSource = findViewerCountSource();
    if (viewerSource) {
      log('mountInfoOverlay: cloning viewer-count badge', viewerSource);
    } else {
      log('mountInfoOverlay: no viewer-count badge found');
    }

    const wrapper = document.createElement('div');
    wrapper.id = INFO_ID;
    // Set the viewer source BEFORE the initial clone+transform so
    // transformClonedCard can read it during mount, not just reclone.
    infoViewerSource = viewerSource;
    try {
      const cardClone = source.cloneNode(true);
      transformClonedCard(cardClone);
      wrapper.appendChild(cardClone);
    } catch (err) {
      log('initial clone failed:', err);
      infoViewerSource = null;
      return;
    }

    fsEl.appendChild(wrapper);
    infoOverlay = wrapper;
    infoOverlaySource = source;

    // Re-clone the source on subtree / text mutations. Attribute mutations
    // are deliberately not observed — Kick's UI uses transitions driven by
    // attribute / class changes for hover and focus states, and re-cloning
    // on each tick would restart those animations. rAF debouncing coalesces
    // a burst of mutations into a single replace per frame. Both the
    // streamer card and the viewer-count badge feed into the same reclone
    // path for subtree/text changes. The viewer badge also observes style
    // / class attributes, but those only sync into the existing badge clone
    // so Kick's rolling digits can update without replacing the whole
    // overlay or disturbing tooltip portal clones.
    infoOverlayObserver = new MutationObserver(scheduleInfoReclone);
    infoOverlayObserver.observe(source, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    if (viewerSource) {
      infoViewerObserver = new MutationObserver(onViewerSourceMutation);
      infoViewerObserver.observe(viewerSource, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }
    // Catch source replacement (Kick remounting the card mid-fullscreen)
    // by watching body for detachment and refinding on the next frame.
    startInfoSourceWatcher();
  };

  const unmountInfoOverlay = () => {
    stopInfoSourceWatcher();
    if (infoOverlayObserver) {
      infoOverlayObserver.disconnect();
      infoOverlayObserver = null;
    }
    if (infoViewerObserver) {
      infoViewerObserver.disconnect();
      infoViewerObserver = null;
    }
    if (infoOverlay) {
      infoOverlay.remove();
      infoOverlay = null;
    }
    infoOverlaySource = null;
    infoViewerSource = null;
    infoOverlayPending = false;
    infoViewerAttrSyncPending = false;
  };

  const ensureButton = (fsEl) => {
    if (!fsEl) return;
    let wrap = document.getElementById(WRAP_ID);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = WRAP_ID;

      const btn = document.createElement('button');
      btn.id = BTN_ID;
      btn.type = 'button';
      btn.className = BTN_CLASS;
      btn.setAttribute('dir', 'ltr');
      btn.innerHTML = `${BTN_SVG}<span>Chat</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const target = document.fullscreenElement || document.webkitFullscreenElement;
        log('button clicked, fullscreen target:', target, 'active:', active);
        if (!target) return;
        try {
          if (active) disableSideChat(target);
          else enableSideChat(target);
        } catch (err) {
          log('toggle failed:', err);
        }
      });

      wrap.appendChild(btn);
    }
    fsEl.appendChild(wrap);
    updateBtnLabel();
  };

  const removeButton = () => {
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) wrap.remove();
  };

  // Idle auto-hide: fade the toggle button out when the user stops moving the
  // mouse, mirroring how Kick's own controls overlay disappears. Any
  // mousemove on the fullscreen element brings it back instantly. Tuned to
  // 4000ms because Kick's controls fade noticeably later than the standard
  // 3000ms HTML5-video-player default.
  const IDLE_MS = 4000;
  let idleTimer = 0;
  let idleFsEl = null;
  const setIdle = (idle) => {
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) wrap.classList.toggle('kfc-idle', idle);
    const info = document.getElementById(INFO_ID);
    if (info) info.classList.toggle('kfc-idle', idle);
  };
  const onFsMouseMove = () => {
    setIdle(false);
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => setIdle(true), IDLE_MS);
  };
  const startIdleTracking = (fsEl) => {
    stopIdleTracking();
    idleFsEl = fsEl;
    fsEl.addEventListener('mousemove', onFsMouseMove);
    onFsMouseMove();
  };
  const stopIdleTracking = () => {
    if (idleFsEl) idleFsEl.removeEventListener('mousemove', onFsMouseMove);
    idleFsEl = null;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = 0;
    }
    setIdle(false);
  };

  // When Kick's own hide-chat button toggles data-chat="false", tear down our layout
  // so the empty chat slot collapses and our "Chat" button reappears.
  // Within the reconcile-guard window opened by enableSideChat, a `false`
  // value is treated as Kick's React committing the previous "hidden" state
  // before our sync click took effect — we re-assert "true" instead of
  // tearing down.
  const dataChatObserver = new MutationObserver((muts) => {
    if (!active || suppressObserver) return;
    for (const m of muts) {
      if (m.attributeName !== 'data-chat') continue;
      const val = m.target.getAttribute?.('data-chat');
      if (val === 'false') {
        if (Date.now() < enableSyncUntil) {
          log('data-chat=false within reconcile guard, re-asserting true');
          // Single-shot: clear the guard so a subsequent React commit (or a
          // real user "hide chat" click later in the same window) can tear
          // the layout down normally.
          enableSyncUntil = 0;
          suppressObserver = true;
          setKickDataChat('true');
          queueMicrotask(() => {
            suppressObserver = false;
          });
          break;
        }
        const fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (fs) {
          log('detected data-chat=false, tearing down side-chat layout');
          disableSideChat(fs);
        }
        break;
      }
    }
  });
  dataChatObserver.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-chat'],
  });

  const onFullscreenChange = () => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      injectStyles();
      // Only react when fullscreening something that looks like the player.
      const looksLikePlayer =
        VIDEO_WRAPPER_SELECTORS.some((s) => fsEl.matches?.(s) || fsEl.querySelector?.(s)) ||
        fsEl.querySelector?.('video');
      if (!looksLikePlayer) return;
      ensureButton(fsEl);
      mountInfoOverlay(fsEl);
      startVideoLoadingMonitor(fsEl);
      startIdleTracking(fsEl);
    } else {
      // Exiting fullscreen — clean up.
      clearPendingEnable();
      stopVideoLoadingMonitor();
      stopIdleTracking();
      if (active) {
        // We need to operate against the previous fullscreen element; rebuild from current DOM.
        const parent = chatSlot?.parentElement;
        if (parent) disableSideChat(parent);
      }
      unmountInfoOverlay();
      removeButton();
    }
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
})();
