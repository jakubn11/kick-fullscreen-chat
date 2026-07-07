// ==UserScript==
// @name         Kick Fullscreen Chat
// @namespace    https://github.com/jakubn11/kick-fullscreen-chat
// @version      0.19.3
// @description  Adds a Twitch-style "side chat" toggle button when watching a Kick stream in fullscreen
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
  const MODE_BTN_ID = 'kfc-mode-btn';
  const INFO_BTN_ID = 'kfc-info-btn';
  const SETTINGS_BTN_ID = 'kfc-settings-btn';
  const SETTINGS_PANEL_ID = 'kfc-settings-panel';
  const RESIZE_ID = 'kfc-resize-handle';
  const WRAP_ID = 'kfc-toggle-wrap';
  const TOAST_ID = 'kfc-toast';
  const STYLE_ID = 'kfc-style';
  const INFO_ID = 'kfc-info-overlay';
  const VIDEO_ROOT_ATTR = 'data-kfc-video-root';
  const VIDEO_FRAME_ATTR = 'data-kfc-video-frame';
  const VIDEO_EL_ATTR = 'data-kfc-video-el';
  const CHAT_WIDTH = '340px';
  // Bounds for the draggable chat-width divider (px). Min keeps chat usable;
  // max is also capped to 60vw at drag time so chat never dominates.
  const CHAT_WIDTH_MIN = 260;
  const CHAT_WIDTH_MAX = 640;
  // While dragging the resize divider, if the raw (unclamped) pointer width
  // drops below this many px past the minimum, releasing closes the side
  // chat instead of clamping. The slot dims mid-drag so the user sees the
  // close arming before committing.
  const CHAT_WIDTH_CLOSE_THRESHOLD = 180;
  const INFO_MAX_WIDTH = '720px';
  const VIEWER_COUNT_COLOR = '#53fc18';

  // UI preferences. Persisted to localStorage (see loadSettings/saveSettings)
  // so they survive a page reload, and kept in memory across open/close and
  // fullscreen toggles within a session.
  let chatWidth = parseInt(CHAT_WIDTH, 10); // current chat-panel width in px
  let chatSide = 'right';                   // which edge the chat docks to: 'right' | 'left'
  let overlayMode = false;                  // chat floats over video vs. shrinks it
  let infoHidden = false;                   // streamer-info overlay hidden by the user
  let infoBgOpacity = 60;                   // streamer-info overlay backdrop opacity, 0..90 (%)
  let overlayOpacity = 55;                  // overlay chat opacity, 25..90 (%)
  let autoHideOverlayChat = true;           // fade overlay chat while player is idle
  let autoHideControls = true;              // fade the top control cluster / info overlay
  let openChatAsOverlay = false;            // default layout when the Chat button opens chat
  let restoreChatOnFullscreen = true;       // auto-open side chat whenever entering fullscreen
  let idleDelayMs = 4000;                   // delay before our fullscreen UI fades
  let settingsOpen = false;

  // ─── Persistence ────────────────────────────────────────────────────────
  // Settings are saved to localStorage under one key. Writes are debounced so
  // the per-frame width updates during a divider drag don't hammer storage.
  // All access is wrapped in try/catch (private-mode / disabled storage).
  const SETTINGS_KEY = 'kfc-settings';
  let saveTimer = 0;
  const saveSettings = () => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          chatWidth,
          chatSide,
          overlayOpacity,
          autoHideOverlayChat,
          autoHideControls,
          openChatAsOverlay,
          restoreChatOnFullscreen,
          idleDelayMs,
          infoHidden,
          infoBgOpacity,
        })
      );
    } catch (_) {}
  };
  const persistSettings = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = 0;
      saveSettings();
    }, 300);
  };
  const loadSettings = () => {
    let s;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      s = JSON.parse(raw);
    } catch (_) {
      return;
    }
    if (!s || typeof s !== 'object') return;
    if (typeof s.chatWidth === 'number') chatWidth = clampChatWidth(s.chatWidth);
    if (s.chatSide === 'left' || s.chatSide === 'right') chatSide = s.chatSide;
    if (typeof s.overlayOpacity === 'number') {
      overlayOpacity = Math.max(25, Math.min(90, s.overlayOpacity));
    }
    if (typeof s.autoHideOverlayChat === 'boolean') autoHideOverlayChat = s.autoHideOverlayChat;
    if (typeof s.autoHideControls === 'boolean') autoHideControls = s.autoHideControls;
    if (typeof s.openChatAsOverlay === 'boolean') openChatAsOverlay = s.openChatAsOverlay;
    if (typeof s.restoreChatOnFullscreen === 'boolean') {
      restoreChatOnFullscreen = s.restoreChatOnFullscreen;
    }
    if (typeof s.idleDelayMs === 'number') {
      idleDelayMs = Math.max(2000, Math.min(8000, s.idleDelayMs));
    }
    if (typeof s.infoHidden === 'boolean') infoHidden = s.infoHidden;
    if (typeof s.infoBgOpacity === 'number') {
      infoBgOpacity = Math.max(0, Math.min(90, s.infoBgOpacity));
    }
  };

  const BTN_SVG = `<svg width="32" height="32" viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M8.79052 14.6146L10.9377 12.4674L8.46758 10.0061L2 16.4737L8.46758 22.9413L10.9377 20.4799L8.57232 18.1058H30V14.6146H8.79052Z"></path><path d="M29.9643 6H12.5079V9.49127H29.9643V6Z"></path><path d="M29.9643 23.4564H12.5079V26.9476H29.9643V23.4564Z"></path></svg>`;
  // Layout-mode icon: two columns (video + chat) for the side/overlay toggle.
  const MODE_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="11" height="14" rx="2"></rect><rect x="16" y="5" width="5" height="14" rx="2"></rect></svg>`;
  // Info "i in a circle" icon for the streamer-info overlay show/hide toggle.
  const INFO_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path></svg>`;
  // Gear icon for the settings popover.
  const SETTINGS_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58-1.92-3.32-2.39.96a7.33 7.33 0 0 0-1.63-.94L14.86 3h-3.72l-.36 3.18c-.58.23-1.13.54-1.63.94l-2.39-.96-1.92 3.32 2.03 1.58a7.6 7.6 0 0 0-.06.94c0 .31.02.63.06.94l-2.03 1.58 1.92 3.32 2.39-.96c.5.4 1.05.71 1.63.94l.36 3.18h3.72l.36-3.18c.58-.23 1.13-.54 1.63-.94l2.39.96 1.92-3.32-2.03-1.58zM13 15.5A3.5 3.5 0 1 1 13 8a3.5 3.5 0 0 1 0 7.5z"></path></svg>`;

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

  const getChatLookupDiagnostics = () => {
    const selectorResults = CHAT_SELECTORS.map((selector) => ({
      selector,
      matched: !!document.querySelector(selector),
    }));
    const chatInputs = Array.from(
      document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]')
    ).map((input) => ({
      tag: input.tagName.toLowerCase(),
      placeholder: input.getAttribute('placeholder') || '',
      ariaLabel: input.getAttribute('aria-label') || '',
    }));
    return {
      selectorResults,
      chatInputs,
      path: window.location.pathname,
    };
  };

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
        transition: opacity 0.2s ease, right 0.15s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      /* When chat is open the panel covers the top-right corner, so push the
         control cluster left of the chat (over the video) instead of on top
         of the chat messages. Keyed on a class on our own wrap (not .kfc-active
         on fsEl, which Kick's React strips on re-render). */
      #${WRAP_ID}.kfc-chat-open {
        right: calc(1.75rem + var(--kfc-chat-width, ${CHAT_WIDTH}));
      }
      /* Chat docked left frees the right corner, so keep the control cluster
         flush to the right edge instead of insetting it by the chat width. */
      html.kfc-chat-left #${WRAP_ID}.kfc-chat-open {
        right: 1.75rem;
      }
      #${WRAP_ID}.kfc-resizing {
        transition: opacity 0.2s ease;
      }
      /* Mirrors Kick's own controls-overlay fade so the toggle button
         disappears alongside the timeline / play controls when the user is
         idle, and reappears as soon as the mouse moves. */
      #${WRAP_ID}.kfc-idle {
        opacity: 0;
        pointer-events: none;
      }
      /* Chat toggle button — styled in the kick-emotes design language
         (dark #101013 surface, neutral translucent border, blur backdrop,
         layered shadow) rather than reusing Kick's native button classes.
         The single green (#22c55e) accent is the icon; the surface stays
         neutral per the "one green accent per component" rule. */
      #${BTN_ID} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.5rem 0.85rem;
        font-family: sans-serif;
        font-weight: 700;
        font-size: 1rem;
        line-height: 1;
        color: #fff;
        background: #101013;
        border: 1px solid rgba(255, 255, 255, .1);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, .6), inset 0 1px 0 rgba(255, 255, 255, .06);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
        cursor: pointer;
        transition: background .08s;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }
      /* Hover/focus is the design system's green tint (rgba(34,197,94,.1))
         composited over the opaque #101013 surface so text contrast holds. */
      #${BTN_ID}:hover,
      #${BTN_ID}:focus-visible {
        background: linear-gradient(rgba(34, 197, 94, .1), rgba(34, 197, 94, .1)), #101013;
      }
      #${BTN_ID}:disabled {
        opacity: .3;
        pointer-events: none;
      }
      #${BTN_ID} svg {
        width: 1.25em;
        height: 1.25em;
        fill: #22c55e;
        transition: transform 0.15s ease;
      }
      .kfc-active #${BTN_ID} svg { transform: scaleX(-1); }

      /* Icon-only control buttons (layout-mode + info toggle), same
         kick-emotes glass surface as the Chat button but square and compact.
         The green icon is the single accent per the design system. */
      .kfc-control-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.45rem;
        color: #fff;
        background: #101013;
        border: 1px solid rgba(255, 255, 255, .1);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, .6), inset 0 1px 0 rgba(255, 255, 255, .06);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
        cursor: pointer;
        transition: background .08s;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }
      .kfc-control-btn:hover,
      .kfc-control-btn:focus-visible {
        background: linear-gradient(rgba(34, 197, 94, .1), rgba(34, 197, 94, .1)), #101013;
      }
      .kfc-control-btn svg {
        width: 1.15rem;
        height: 1.15rem;
        fill: #22c55e;
      }
      /* When the info overlay is hidden, dim the toggle's icon so its state
         reads as "off" without inventing a new colour token. */
      #${INFO_BTN_ID}.kfc-off svg { fill: rgba(255, 255, 255, .45); }

      /* Visibility: the Chat button only shows when chat is closed; the
         layout-mode toggle only when chat is open. The info toggle is always
         available in fullscreen. All keyed on classes on our own nodes (the
         wrap / buttons / overlay), NOT on .kfc-active on fsEl — Kick's React
         rewrites fsEl's className on re-render and strips our class, which
         would intermittently revert these controls. */
      #${MODE_BTN_ID} { display: none; }
      #${WRAP_ID}.kfc-chat-open #${MODE_BTN_ID} { display: inline-flex; }
      #${WRAP_ID}.kfc-chat-open #${BTN_ID} { display: none; }
      /* Pressed/active look when overlay mode is on, so the toggle's state is
         legible without a second icon. */
      #${MODE_BTN_ID}.kfc-on {
        background: linear-gradient(rgba(34, 197, 94, .18), rgba(34, 197, 94, .18)), #101013;
        border-color: rgba(34, 197, 94, .5);
      }
      #${SETTINGS_BTN_ID}.kfc-on {
        background: linear-gradient(rgba(34, 197, 94, .18), rgba(34, 197, 94, .18)), #101013;
        border-color: rgba(34, 197, 94, .5);
      }
      #${SETTINGS_PANEL_ID} {
        position: absolute;
        top: calc(100% + 0.5rem);
        right: 0;
        width: 280px;
        display: none;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.85rem;
        color: #fff;
        background: #101013;
        border: 1px solid rgba(255, 255, 255, .1);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, .6), inset 0 1px 0 rgba(255, 255, 255, .06);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
        box-sizing: border-box;
        font: 600 12px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      #${WRAP_ID}.kfc-settings-open #${SETTINGS_PANEL_ID} {
        display: flex;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-title {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0;
        color: rgba(255, 255, 255, .62);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-row {
        display: grid;
        gap: 0.4rem;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-check {
        display: flex;
        /* Text on the left, toggle switch on the right. row-reverse keeps the
           input first in the DOM (label/state wiring unchanged) while showing
           it on the trailing edge. */
        flex-direction: row-reverse;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        color: rgba(255, 255, 255, .9);
        cursor: pointer;
      }
      #${SETTINGS_PANEL_ID} input[type="range"] {
        width: 100%;
        accent-color: #22c55e;
      }
      /* Overlay-opacity slider: a custom track that previews the effect — a
         checkerboard (transparency) on the left fading into the near-opaque
         dark panel colour on the right, so the difference between low and high
         opacity is visible at a glance. The two other sliders keep the plain
         green native track above. */
      #${SETTINGS_PANEL_ID} .kfc-settings-opacity-input {
        -webkit-appearance: none;
        appearance: none;
        height: 16px;
        background: transparent;
        cursor: pointer;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-opacity-input::-webkit-slider-runnable-track {
        height: 14px;
        border-radius: 7px;
        border: 1px solid rgba(255, 255, 255, .15);
        background:
          linear-gradient(90deg, rgba(14, 14, 16, .18), rgba(14, 14, 16, .96)),
          conic-gradient(#8a8a8a 0 25%, #cfcfcf 0 50%, #8a8a8a 0 75%, #cfcfcf 0);
        background-size: 100% 100%, 12px 12px;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-opacity-input::-moz-range-track {
        height: 14px;
        border-radius: 7px;
        border: 1px solid rgba(255, 255, 255, .15);
        background:
          linear-gradient(90deg, rgba(14, 14, 16, .18), rgba(14, 14, 16, .96)),
          conic-gradient(#8a8a8a 0 25%, #cfcfcf 0 50%, #8a8a8a 0 75%, #cfcfcf 0);
        background-size: 100% 100%, 12px 12px;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-opacity-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        margin-top: -2px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #22c55e;
        box-shadow: 0 1px 3px rgba(0, 0, 0, .5);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-opacity-input::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #22c55e;
        box-shadow: 0 1px 3px rgba(0, 0, 0, .5);
      }
      /* Settings toggles are styled as switches (the underlying control stays a
         native checkbox for state + accessibility). */
      #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"] {
        -webkit-appearance: none;
        appearance: none;
        position: relative;
        flex: 0 0 auto;
        width: 2.2rem;
        height: 1.25rem;
        margin: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, .18);
        border: 1px solid rgba(255, 255, 255, .15);
        cursor: pointer;
        transition: background .15s ease, border-color .15s ease;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"]::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 2px;
        width: calc(1.25rem - 6px);
        height: calc(1.25rem - 6px);
        transform: translateY(-50%);
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, .45);
        transition: left .15s ease;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"]:checked {
        background: #22c55e;
        border-color: rgba(34, 197, 94, .7);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"]:checked::before {
        left: calc(2.2rem - (1.25rem - 6px) - 2px);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"]:focus-visible {
        outline: 2px solid rgba(34, 197, 94, .6);
        outline-offset: 2px;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-buttons {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.35rem;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-chip {
        min-width: 0;
        min-height: 2.15rem;
        padding: 0.5rem 0.55rem;
        color: #fff;
        background: rgba(255, 255, 255, .06);
        border: 1px solid rgba(255, 255, 255, .1);
        border-radius: 6px;
        font: inherit;
        line-height: 1;
        text-align: center;
        white-space: nowrap;
        cursor: pointer;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-chip:hover,
      #${SETTINGS_PANEL_ID} .kfc-settings-chip:focus-visible {
        background: linear-gradient(rgba(34, 197, 94, .1), rgba(34, 197, 94, .1)), #101013;
        outline: none;
      }
      /* The width preset matching the current chat width (persisted across
         reloads) is shown selected with a stronger green tint + border. */
      #${SETTINGS_PANEL_ID} .kfc-settings-chip.kfc-selected {
        background: linear-gradient(rgba(34, 197, 94, .2), rgba(34, 197, 94, .2)), #101013;
        border-color: rgba(34, 197, 94, .65);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-reset {
        width: 100%;
      }
      /* Reset is destructive, so it goes red on hover/focus (same chip shape,
         red tint + border + text) instead of the default green hover. Declared
         after the generic chip:hover rule so it wins on source order. */
      #${SETTINGS_PANEL_ID} .kfc-settings-reset:hover,
      #${SETTINGS_PANEL_ID} .kfc-settings-reset:focus-visible {
        background: linear-gradient(rgba(239, 68, 68, .15), rgba(239, 68, 68, .15)), #101013;
        border-color: rgba(239, 68, 68, .6);
        color: #fca5a5;
      }
      /* Hide the streamer-info overlay when the user has toggled it off. */
      #${INFO_ID}.kfc-hidden { display: none !important; }

      .kfc-active { background: #000; }
      /* We mark Kick's full-coverage player layers in place rather than moving
         them into a wrapper. Wrapping fsEl's children caused React's reconciler
         to throw on background re-renders (it tried to remove a node from fsEl
         that we'd reparented into our wrapper) and navigate to Kick's 404 page.
         Non-video layers are filtered further in JS so transient loading/blur
         overlays do not become transformed hit targets above the controls. */
      [${VIDEO_ROOT_ATTR}] {
        /* --kfc-video-width is normally unset and falls back to the shrink
           calc; overlay mode sets it to 100% on documentElement. Both vars
           live on documentElement (which Kick never rewrites), so the layout
           survives Kick stripping fsEl's className on re-render. */
        width: var(--kfc-video-width, calc(100% - var(--kfc-chat-width, ${CHAT_WIDTH}))) !important;
        max-width: var(--kfc-video-width, calc(100% - var(--kfc-chat-width, ${CHAT_WIDTH}))) !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden;
        box-sizing: border-box !important;
        /* Containing block for any position:fixed/absolute descendants so the
           controls/timeline grid anchors to the shrunken area instead of the
           viewport. --kfc-video-shift pushes the shrunken player to the right
           by the chat width when chat is docked on the left (0 otherwise). */
        transform: translateX(var(--kfc-video-shift, 0px)) translateZ(0);
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
        width: var(--kfc-chat-width, ${CHAT_WIDTH});
        /* Dock on the left edge instead of the right when chat side is left. */
      }
      html.kfc-chat-left .kfc-chat-slot {
        right: auto;
        left: 0;
      }
      .kfc-chat-slot {
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
      /* At narrow chat widths (down to 260px), Kick's inner message rows
         can overflow horizontally — flex children default to
         min-width: auto so they can't shrink below their content size,
         and the message scroll container has overflow-y: auto which the
         spec coerces overflow-x: visible into overflow-x: auto, surfacing
         a horizontal scrollbar at the bottom of the chat. Letting flex
         descendants shrink to fit + clipping any leftover horizontal
         overflow on Kick's chat root removes the scrollbar without
         breaking vertical message scroll. */
      .kfc-chat-slot * {
        min-width: 0 !important;
      }
      .kfc-chat-slot > * {
        overflow-x: hidden !important;
      }
      /* Prevent horizontal overflow at its source so no scroll container
         deeper in Kick's chat tree surfaces a horizontal scrollbar: wrap
         long words / URLs (overflow-wrap: anywhere also lets flex items
         shrink to fit) and keep emotes / images within the panel width.
         Done at the source rather than forcing overflow-x: hidden on every
         element, which would coerce overflow-y and could clip legit content. */
      .kfc-chat-slot,
      .kfc-chat-slot * {
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }
      .kfc-chat-slot img,
      .kfc-chat-slot video,
      .kfc-chat-slot canvas {
        max-width: 100% !important;
      }
      /* Kick's chat input action bar — channel-points, gift-shop, settings,
         and the green "Chat" send button (#send-message-button) — is laid out
         as a single flex row sized for a wide chat: its left group takes
         lg:w-full at fullscreen viewport widths, which pushes the send button
         off the row at the minimum panel width, where it was clipped by the
         slot's overflow-x: hidden above. Keep the bar on ONE row at narrow
         widths instead: drop the forced full width on the left group (so it
         only takes the space it needs and can shrink) and tighten the
         buttons' padding/gaps so channel-points, gift-shop, settings and the
         send button all fit. Targeted via the stable #send-message-button id
         and Kick's data-testids so it survives class-name churn. */
      .kfc-chat-slot :has(> div > #send-message-button) {
        flex-wrap: nowrap !important;
        gap: 0.25rem !important;
      }
      .kfc-chat-slot :has(> [data-testid="channel-points-button"]),
      .kfc-chat-slot :has(> [data-testid="gift-shop-button"]) {
        width: auto !important;
        flex: 0 1 auto !important;
        gap: 0.25rem !important;
      }
      .kfc-chat-slot [data-testid="channel-points-button"],
      .kfc-chat-slot [data-testid="gift-shop-button"] {
        padding-left: 0.375rem !important;
        padding-right: 0.375rem !important;
        gap: 0.25rem !important;
      }
      .kfc-chat-slot #send-message-button {
        padding-left: 0.625rem !important;
        padding-right: 0.625rem !important;
      }

      /* Keep Kick's full-width bottom controls out from under the floating chat
         in overlay mode. The controls live in a full-width flex row that
         justifies its two button groups to the edges (play/volume/time left;
         PiP/clips/mini/fullscreen/settings right) and is also the positioned
         ancestor of the absolute bottom-0 seekbar. Shrinking this one row by the
         chat width moves the right-hand buttons to the chat's left edge AND sizes
         the timeline to the same width — so we must NOT also shrink the timeline
         itself, or it gets inset twice and leaves a chat-width gap on the right.
         No-op in side mode (--kfc-control-inset is 0 there). */
      [${VIDEO_ROOT_ATTR}] [class*="justify-between" i][class*="w-full" i] {
        width: calc(100% - var(--kfc-control-inset, 0px)) !important;
        max-width: calc(100% - var(--kfc-control-inset, 0px)) !important;
        /* In overlay mode with chat docked left, push the controls row right by
           the chat width so it clears the floating chat (0 otherwise). */
        margin-left: var(--kfc-control-shift, 0px) !important;
      }
      /* Overlay chat mode: the video keeps the full width (via --kfc-video-width
         set to 100%; see [${VIDEO_ROOT_ATTR}] above) and the chat panel floats
         semi-transparently over its right edge (Twitch-style overlay). The
         transparency is keyed on a class on our own chat slot, which Kick
         never touches. */
      .kfc-chat-slot.kfc-overlay {
        background: rgba(14, 14, 16, var(--kfc-overlay-opacity, 0.55));
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        transition: opacity 0.2s ease;
        /* Readability for chat text over video, since Kick's own opaque
           backgrounds are stripped below. Same trick as the info overlay. */
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85), 0 0 6px rgba(0, 0, 0, 0.5);
      }
      .kfc-chat-slot.kfc-overlay.kfc-overlay-idle {
        opacity: 0;
        pointer-events: none;
      }
      /* Strip Kick's opaque chat backgrounds in overlay mode so the slot's
         frosted backdrop (and the video behind it) shows through instead of a
         solid dark panel. Backgrounds only — text, emotes (<img>), and badges
         are untouched. The composer is left transparent too (no separate
         backing) so Kick's own input border outlines it cleanly without a
         nested box-in-a-box. Buttons are excluded so controls that rely on a
         fill (e.g. Kick's green "Chat" send button) keep their normal look. So
         are bg-green-* accents and 1px separator lines (h-px / w-px): Kick draws
         dividers like the "New messages" rule and the gifters-bar lines as thin
         coloured divs (e.g. div.h-px.grow.bg-green-500), which must stay visible. */
      .kfc-chat-slot.kfc-overlay *:not(button):not([class*="bg-green" i]):not([class*="h-px" i]):not([class*="w-px" i]) {
        background-color: transparent !important;
      }
      /* Restore a dark backing on the message composer so the input stays
         readable over video (like normal mode). Both the editable field and its
         immediate wrapper get the same colour, so there's no box-in-a-box; the
         wrapper's native border/rounding (not stripped above) still outlines it. */
      .kfc-chat-slot.kfc-overlay textarea,
      .kfc-chat-slot.kfc-overlay input:not([type="checkbox"]):not([type="radio"]),
      .kfc-chat-slot.kfc-overlay [contenteditable="true"],
      .kfc-chat-slot.kfc-overlay [contenteditable=""],
      .kfc-chat-slot.kfc-overlay div:has(> textarea),
      .kfc-chat-slot.kfc-overlay div:has(> input:not([type="checkbox"]):not([type="radio"])),
      .kfc-chat-slot.kfc-overlay div:has(> [contenteditable="true"]),
      .kfc-chat-slot.kfc-overlay div:has(> [contenteditable=""]) {
        /* Near-solid dark so the input reads clearly over video, matching the
           normal-mode composer rather than the translucent panel. */
        background-color: rgba(12, 12, 14, 0.94) !important;
      }
      /* Thin separator lines (h-px / w-px) use a dark-grey fill that vanishes
         over video. Brighten the neutral ones so the gifters-bar top/bottom
         dividers and similar rules stay visible; green ones keep their accent. */
      .kfc-chat-slot.kfc-overlay [class*="h-px" i]:not([class*="bg-green" i]),
      .kfc-chat-slot.kfc-overlay [class*="w-px" i]:not([class*="bg-green" i]) {
        background-color: rgba(255, 255, 255, 0.4) !important;
      }

      /* Draggable divider between video and chat. A thin fixed strip straddling
         the chat's left edge; the value it tracks (--kfc-chat-width) drives both
         the video shrink and the chat width above. */
      #${RESIZE_ID} {
        position: fixed;
        top: 0;
        bottom: 0;
        right: var(--kfc-chat-width, ${CHAT_WIDTH});
        width: 12px;
        margin-right: -6px;
        cursor: ew-resize;
        z-index: 2147483646;
        touch-action: none;
        opacity: 1;
        transition: opacity 0.2s ease;
      }
      /* When docked left, the divider straddles the chat's right edge. */
      html.kfc-chat-left #${RESIZE_ID} {
        right: auto;
        left: var(--kfc-chat-width, ${CHAT_WIDTH});
        margin-right: 0;
        margin-left: -6px;
      }
      #${RESIZE_ID}.kfc-overlay-idle {
        opacity: 0;
        pointer-events: none;
      }
      #${RESIZE_ID}::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 2px;
        background: rgba(255, 255, 255, .12);
        transition: background .12s ease;
      }
      #${RESIZE_ID}:hover::after,
      #${RESIZE_ID}.kfc-dragging::after {
        background: #22c55e;
      }
      /* Release-to-close cue: while the user drags the divider past the
         close threshold, the slot dims so it's obvious that letting go
         will close the side chat. Cleared on pointerup regardless of
         which way the cue goes (commit or revert). */
      .kfc-chat-slot.kfc-pending-close {
        opacity: 0.35;
        transition: opacity .12s ease;
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
        /* Offset right of the chat panel when chat is docked left (0 otherwise),
           so the info overlay isn't hidden behind the chat. */
        left: calc(var(--kfc-info-offset, 0px) + 1.75rem);
        z-index: 2147483646;
        /* Cap width to what's left between the offset (chat width when docked
           left) and the right edge, so it never overflows the viewport. */
        max-width: min(60%, calc(100% - var(--kfc-info-offset, 0px) - 3.5rem), ${INFO_MAX_WIDTH});
        pointer-events: none;
        opacity: 1;
        transition: opacity 0.2s ease;
        color: #fff;
        /* Subtle dark gradient backdrop so the cloned card text stays readable
           over bright video, while still feeling like an overlay (no hard box).
           Alpha is driven by --kfc-info-bg-opacity (default 0.6); the second
           stop keeps the original ~0.58 ratio for the same soft gradient. */
        background: linear-gradient(135deg,
          rgba(0, 0, 0, var(--kfc-info-bg-opacity, 0.6)),
          rgba(0, 0, 0, calc(var(--kfc-info-bg-opacity, 0.6) * 0.58)));
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
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
        /* Kick renders the category link in a lighter weight than the rest
           of the overlay; bump it so "IRL" matches the streamer name / title
           / viewer-count text instead of looking thin. */
        font-weight: 600 !important;
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
  // Watches the chat slot for Kick's chat error boundary fallback ("We are
  // sorry, but something went wrong"). When it latches, Kick won't reset it
  // on its own; we tear down the side layout so the user can re-dock without
  // a full page reload. See [[chat-error-recovery]].
  let chatErrorObserver = null;
  let chatErrorCheckScheduled = 0;
  let chatErrorRecovering = false;
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
    // While side chat is open the player layers are shrunk to the left of the
    // chat, so measure "covers the player" against the available video width
    // (viewport minus chat), not the full viewport. Otherwise a wide chat can
    // push a marked controls layer below the 70%-of-viewport threshold; the
    // next re-mark pass then drops its marker, it loses the translateZ(0)
    // containing block, and Kick's position:fixed timeline escapes across the
    // chat panel. In overlay mode the video keeps full width, so the basis is
    // the full viewport regardless.
    const basisWidth =
      active && !overlayMode ? Math.max(1, window.innerWidth - chatWidth) : window.innerWidth;
    return (
      rect.width >= basisWidth * 0.7 &&
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

  // ─── Chat-width resize ──────────────────────────────────────────────────
  // The chat panel width is a CSS variable (--kfc-chat-width) referenced by
  // both the chat slot and the video-shrink calc. A fixed-position divider
  // handle drives it via pointer drag. Width is persisted (see saveSettings).
  // viewportWidth is a parameter (not always read live) so the per-frame divider
  // drag can pass a value cached at pointerdown: reading window.innerWidth during
  // a move forces a synchronous reflow of Kick's chat subtree that the move just
  // dirtied, which is what makes the chat stutter while dragging.
  const clampChatWidth = (px, viewportWidth = window.innerWidth) =>
    Math.max(CHAT_WIDTH_MIN, Math.min(px, CHAT_WIDTH_MAX, Math.round(viewportWidth * 0.6)));

  const applyChatWidth = () => {
    document.documentElement.style.setProperty('--kfc-chat-width', `${chatWidth}px`);
  };

  // Highlight the width preset chip (if any) that matches the current width, so
  // the selection is visible — including after a reload, since chatWidth is
  // restored from storage before the panel is built.
  const updateWidthChips = () => {
    document
      .querySelectorAll(`#${SETTINGS_PANEL_ID} .kfc-settings-chip[data-kfc-width]`)
      .forEach((chip) => {
        chip.classList.toggle('kfc-selected', Number(chip.dataset.kfcWidth) === chatWidth);
      });
  };

  const setChatWidth = (px, viewportWidth) => {
    chatWidth = clampChatWidth(px, viewportWidth);
    applyChatWidth();
    scheduleLiveResizeLayout();
    updateWidthChips();
    persistSettings();
  };

  const resetSessionSettings = () => {
    chatWidth = parseInt(CHAT_WIDTH, 10);
    chatSide = 'right';
    overlayMode = false;
    infoHidden = false;
    infoBgOpacity = 60;
    overlayOpacity = 55;
    autoHideOverlayChat = true;
    autoHideControls = true;
    openChatAsOverlay = false;
    restoreChatOnFullscreen = true;
    idleDelayMs = 4000;
    applyChatWidth();
    updateWidthChips();
    syncControlState();
    onFsMouseMove();
    nudgePlayerResize();
    saveSettings();
  };

  let resizeHandle = null;
  let resizing = false;
  let resizeLayoutFrame = 0;
  let resizePendingClose = false;
  // Divider-drag state. Pointer moves are coalesced to one width update per
  // animation frame (resizeMoveFrame) so a high-polling mouse / high-refresh
  // display can't trigger several full chat relayouts per frame, and the
  // viewport width is snapshotted at pointerdown (resizeViewportWidth) so the
  // per-frame clamp never reads layout mid-drag.
  let resizeMoveFrame = 0;
  let resizePointerX = 0;
  let resizeViewportWidth = 0;

  const setResizeUiState = (isResizing) => {
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) wrap.classList.toggle('kfc-resizing', isResizing);
  };

  const scheduleLiveResizeLayout = () => {
    // While the divider is actively dragged the chat width is driven entirely by
    // the --kfc-chat-width CSS variable (rewritten every frame in setChatWidth),
    // which resizes the video box live via CSS (width: calc(100% - chat width),
    // object-fit: contain) with no JS. Re-running the heavy player relayout on
    // every pointermove — refreshVideoRoots plus a synthetic window 'resize'
    // that makes Kick's React player re-measure — is what makes the drag feel
    // laggy, so defer it to pointerup, where nudgePlayerResize() fires the final
    // reflow. Discrete width changes (preset chips, reset) aren't dragging, so
    // they still relayout immediately.
    if (resizing) return;
    if (resizeLayoutFrame) return;
    resizeLayoutFrame = requestAnimationFrame(() => {
      resizeLayoutFrame = 0;
      if (active && videoRootHost) refreshVideoRoots(videoRootHost);
      window.dispatchEvent(new Event('resize'));
    });
  };

  // Apply the latest pointer position to the chat width. Runs at most once per
  // animation frame (scheduled from onResizePointerMove) so the chat subtree
  // reflows once per frame instead of once per raw pointermove.
  const applyResizeFromPointer = () => {
    resizeMoveFrame = 0;
    if (!resizing) return;
    // Width is the pointer's distance from the docked edge: from the right edge
    // of the viewport when docked right, from the left edge when docked left.
    // Use the viewport width snapshotted at pointerdown so this never reads
    // layout (which would force a synchronous reflow of the just-dirtied chat).
    const rawWidth =
      chatSide === 'left' ? resizePointerX : resizeViewportWidth - resizePointerX;
    setChatWidth(rawWidth, resizeViewportWidth);
    // Arm a release-to-close: when the *raw* (pre-clamp) width is pulled well
    // past the minimum, releasing the pointer will tear the side chat down
    // instead of just clamping at min. The slot dims mid-drag so the gesture
    // is visible before commit.
    const armed = rawWidth < CHAT_WIDTH_CLOSE_THRESHOLD;
    if (armed !== resizePendingClose) {
      resizePendingClose = armed;
      if (chatSlot) chatSlot.classList.toggle('kfc-pending-close', armed);
    }
  };

  const onResizePointerMove = (e) => {
    if (!resizing) return;
    resizePointerX = e.clientX;
    if (resizeMoveFrame) return;
    resizeMoveFrame = requestAnimationFrame(applyResizeFromPointer);
  };

  const onResizeDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setChatWidth(parseInt(CHAT_WIDTH, 10));
    nudgePlayerResize();
  };

  const onResizePointerUp = (e) => {
    if (!resizing) return;
    resizing = false;
    if (resizeMoveFrame) {
      cancelAnimationFrame(resizeMoveFrame);
      resizeMoveFrame = 0;
    }
    setResizeUiState(false);
    if (resizeHandle) {
      resizeHandle.classList.remove('kfc-dragging');
      try { resizeHandle.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    if (chatSlot) chatSlot.classList.remove('kfc-pending-close');
    window.removeEventListener('pointermove', onResizePointerMove);
    window.removeEventListener('pointerup', onResizePointerUp);
    window.removeEventListener('pointercancel', onResizePointerUp);
    // pointercancel (e.g. browser stealing the pointer) shouldn't trigger a
    // close — only an actual pointerup release means the user committed.
    const shouldClose = resizePendingClose && e.type !== 'pointercancel';
    resizePendingClose = false;
    if (shouldClose) {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl && active) {
        log('resize divider released past close threshold; closing side chat');
        disableSideChat(fsEl);
        return;
      }
    }
    nudgePlayerResize();
  };

  const onResizePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    // Snapshot the viewport width once; it can't change during a fullscreen
    // drag, and reading it per-move would force a synchronous chat reflow.
    resizeViewportWidth = window.innerWidth;
    resizePointerX = e.clientX;
    setResizeUiState(true);
    if (resizeHandle) {
      resizeHandle.classList.add('kfc-dragging');
      try { resizeHandle.setPointerCapture(e.pointerId); } catch (_) {}
    }
    window.addEventListener('pointermove', onResizePointerMove);
    window.addEventListener('pointerup', onResizePointerUp);
    window.addEventListener('pointercancel', onResizePointerUp);
  };

  const mountResizeHandle = (fsEl) => {
    removeResizeHandle();
    resizeHandle = document.createElement('div');
    resizeHandle.id = RESIZE_ID;
    resizeHandle.setAttribute('aria-hidden', 'true');
    resizeHandle.addEventListener('pointerdown', onResizePointerDown);
    resizeHandle.addEventListener('dblclick', onResizeDoubleClick);
    fsEl.appendChild(resizeHandle);
  };

  const removeResizeHandle = () => {
    if (resizing) onResizePointerUp({ pointerId: -1 });
    if (resizeHandle) {
      resizeHandle.removeEventListener('pointerdown', onResizePointerDown);
      resizeHandle.removeEventListener('dblclick', onResizeDoubleClick);
      resizeHandle.remove();
      resizeHandle = null;
    }
  };

  // Kick's chat subtree sometimes throws during a later render (websocket
  // reconnect, mod action, pinned-message update) and Kick's own error
  // boundary inside the chat shows "We are sorry, but something went wrong.
  // Please try again later." The boundary doesn't reset on its own, so
  // without intervention the user has to reload the whole page. Once we
  // detect the fallback inside our chat slot we tear the side layout down,
  // which puts the chat node back where Kick expects it and gives the user
  // a Chat button to retry with. We don't try to reset Kick's React state —
  // re-opening side chat may or may not recover depending on whether Kick
  // remounted the subtree, but the user is no longer stuck.
  const CHAT_ERROR_RE = /we are sorry,?\s*but something went wrong/i;

  const startChatErrorWatcher = (fsEl) => {
    if (!chatSlot || chatErrorObserver) return;
    chatErrorObserver = new MutationObserver(() => {
      // Coalesce a burst of message mutations into one textContent read per
      // frame; on a busy stream we'd otherwise re-scan the slot once per
      // arriving message for no benefit.
      if (chatErrorCheckScheduled || chatErrorRecovering) return;
      chatErrorCheckScheduled = requestAnimationFrame(() => {
        chatErrorCheckScheduled = 0;
        if (chatErrorRecovering || !chatSlot) return;
        if (!CHAT_ERROR_RE.test(chatSlot.textContent || '')) return;
        chatErrorRecovering = true;
        log('Kick chat error boundary detected; tearing down side chat');
        showToast('Kick chat errored. Click Chat to reopen.');
        stopChatErrorWatcher();
        disableSideChat(fsEl);
        chatErrorRecovering = false;
      });
    });
    chatErrorObserver.observe(chatSlot, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  const stopChatErrorWatcher = () => {
    if (chatErrorObserver) {
      chatErrorObserver.disconnect();
      chatErrorObserver = null;
    }
    if (chatErrorCheckScheduled) {
      cancelAnimationFrame(chatErrorCheckScheduled);
      chatErrorCheckScheduled = 0;
    }
  };

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
      warn('chat container not found. Lookup diagnostics:', getChatLookupDiagnostics());
      showToast('Kick Fullscreen Chat: chat panel not found. Kick may have changed its layout; check the console diagnostics.');
      return;
    }
    log('enableSideChat: using chat node', chat);
    overlayMode = openChatAsOverlay;

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
    // Apply the current (per-session) chat width and layout mode, then mount
    // the draggable divider between video and chat.
    applyChatWidth();
    mountResizeHandle(fsEl);

    active = true;
    syncControlState();
    // Mark Kick's player layers in place so the CSS shrink applies without
    // moving them into a wrapper (which would break React's reconciler on
    // background refreshes and 404 the page).
    startVideoRootObserver(fsEl);
    // Adopt Kick's body-portaled popovers (emote-name tooltips, etc.) into
    // fsEl so they remain visible while in fullscreen.
    startPopoverPortal(fsEl);
    // Watch for Kick's chat error boundary fallback so the user isn't stuck
    // having to reload the page when Kick's chat subtree throws.
    startChatErrorWatcher(fsEl);

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
    stopChatErrorWatcher();
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
    removeResizeHandle();
    chatSlot.remove();
    chatSlot = null;
    savedChatParent = null;
    savedChatNextSibling = null;
    // active is already false above; reset the control cluster + video-width
    // override accordingly (clears kfc-chat-open, --kfc-video-width).
    syncControlState();

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
    // Per-button visibility (Chat vs. layout-mode toggle) is handled in CSS via
    // .kfc-active scoping so the wrap stays visible to host the other controls.
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
    // Honour the user's show/hide preference for this session.
    if (infoHidden) wrapper.classList.add('kfc-hidden');

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

  const createSettingsRange = (labelText, valueText, input, valueClass = '') => {
    const row = document.createElement('div');
    row.className = 'kfc-settings-row';
    const label = document.createElement('label');
    label.className = 'kfc-settings-label';
    const text = document.createElement('span');
    text.textContent = labelText;
    const value = document.createElement('span');
    if (valueClass) value.className = valueClass;
    value.textContent = valueText;
    label.appendChild(text);
    label.appendChild(value);
    row.appendChild(label);
    row.appendChild(input);
    return { row, value };
  };

  const createSettingsCheckbox = (labelText, checked, onChange, inputClass = '') => {
    const label = document.createElement('label');
    label.className = 'kfc-settings-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    if (inputClass) input.className = inputClass;
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    const text = document.createElement('span');
    text.textContent = labelText;
    label.appendChild(input);
    label.appendChild(text);
    return label;
  };

  const buildSettingsPanel = () => {
    const panel = document.createElement('div');
    panel.id = SETTINGS_PANEL_ID;
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());

    const title = document.createElement('div');
    title.className = 'kfc-settings-title';
    title.textContent = 'Fullscreen settings';
    panel.appendChild(title);

    const opacityInput = document.createElement('input');
    opacityInput.type = 'range';
    opacityInput.className = 'kfc-settings-opacity-input';
    opacityInput.min = '25';
    opacityInput.max = '90';
    opacityInput.step = '5';
    opacityInput.value = String(overlayOpacity);
    const opacityRange = createSettingsRange(
      'Overlay opacity',
      `${overlayOpacity}%`,
      opacityInput,
      'kfc-settings-opacity-value'
    );
    opacityInput.addEventListener('input', () => {
      overlayOpacity = Number(opacityInput.value);
      opacityRange.value.textContent = `${overlayOpacity}%`;
      syncControlState();
      persistSettings();
    });
    panel.appendChild(opacityRange.row);

    const infoOpacityInput = document.createElement('input');
    infoOpacityInput.type = 'range';
    infoOpacityInput.className = 'kfc-settings-info-opacity-input';
    infoOpacityInput.min = '0';
    infoOpacityInput.max = '90';
    infoOpacityInput.step = '5';
    infoOpacityInput.value = String(infoBgOpacity);
    const infoOpacityRange = createSettingsRange(
      'Stream-info backdrop',
      `${infoBgOpacity}%`,
      infoOpacityInput,
      'kfc-settings-info-opacity-value'
    );
    infoOpacityInput.addEventListener('input', () => {
      infoBgOpacity = Number(infoOpacityInput.value);
      infoOpacityRange.value.textContent = `${infoBgOpacity}%`;
      syncControlState();
      persistSettings();
    });
    panel.appendChild(infoOpacityRange.row);

    const idleInput = document.createElement('input');
    idleInput.type = 'range';
    idleInput.className = 'kfc-settings-idle-input';
    idleInput.min = '2';
    idleInput.max = '8';
    idleInput.step = '1';
    idleInput.value = String(Math.round(idleDelayMs / 1000));
    const idleRange = createSettingsRange(
      'Hide delay',
      `${Math.round(idleDelayMs / 1000)}s`,
      idleInput,
      'kfc-settings-idle-value'
    );
    idleInput.addEventListener('input', () => {
      idleDelayMs = Number(idleInput.value) * 1000;
      idleRange.value.textContent = `${Math.round(idleDelayMs / 1000)}s`;
      onFsMouseMove();
      persistSettings();
    });
    panel.appendChild(idleRange.row);

    const widthRow = document.createElement('div');
    widthRow.className = 'kfc-settings-row';
    const widthLabel = document.createElement('div');
    widthLabel.className = 'kfc-settings-label';
    const widthText = document.createElement('span');
    widthText.textContent = 'Chat width';
    const widthValue = document.createElement('span');
    widthValue.className = 'kfc-settings-width-value';
    widthValue.textContent = `${chatWidth}px`;
    widthLabel.appendChild(widthText);
    widthLabel.appendChild(widthValue);
    widthRow.appendChild(widthLabel);

    const buttons = document.createElement('div');
    buttons.className = 'kfc-settings-buttons';
    [
      ['Compact', 280],
      ['Default', parseInt(CHAT_WIDTH, 10)],
      ['Wide', 520],
      ['Max', CHAT_WIDTH_MAX],
    ].forEach(([label, width]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kfc-settings-chip';
      button.dataset.kfcWidth = String(width);
      // Reflect the current (persisted) width on the matching preset right away,
      // since the panel isn't in the DOM yet for a document-scoped query.
      if (width === chatWidth) button.classList.add('kfc-selected');
      button.textContent = label;
      button.addEventListener('click', () => {
        setChatWidth(width);
        widthValue.textContent = `${chatWidth}px`;
        nudgePlayerResize();
      });
      buttons.appendChild(button);
    });
    widthRow.appendChild(buttons);
    panel.appendChild(widthRow);

    panel.appendChild(
      createSettingsCheckbox('Dock chat on left', chatSide === 'left', (checked) => {
        chatSide = checked ? 'left' : 'right';
        syncControlState();
        nudgePlayerResize();
        persistSettings();
      }, 'kfc-settings-dock-left-input')
    );
    panel.appendChild(
      createSettingsCheckbox('Auto-hide overlay chat', autoHideOverlayChat, (checked) => {
        autoHideOverlayChat = checked;
        syncControlState();
        onFsMouseMove();
        persistSettings();
      }, 'kfc-settings-autohide-input')
    );
    panel.appendChild(
      createSettingsCheckbox('Auto-hide controls', autoHideControls, (checked) => {
        autoHideControls = checked;
        syncControlState();
        onFsMouseMove();
        persistSettings();
      }, 'kfc-settings-controls-hide-input')
    );
    panel.appendChild(
      createSettingsCheckbox('Open chats as overlay', openChatAsOverlay, (checked) => {
        openChatAsOverlay = checked;
        syncControlState();
        persistSettings();
      }, 'kfc-settings-open-overlay-input')
    );
    panel.appendChild(
      createSettingsCheckbox('Open chat on fullscreen', restoreChatOnFullscreen, (checked) => {
        restoreChatOnFullscreen = checked;
        syncControlState();
        persistSettings();
      }, 'kfc-settings-restore-input')
    );

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'kfc-settings-chip kfc-settings-reset';
    resetButton.textContent = 'Reset settings';
    resetButton.addEventListener('click', resetSessionSettings);
    panel.appendChild(resetButton);

    return panel;
  };

  const ensureButton = (fsEl) => {
    if (!fsEl) return;
    let wrap = document.getElementById(WRAP_ID);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = WRAP_ID;

      // Info-overlay show/hide toggle (always available in fullscreen).
      const infoBtn = document.createElement('button');
      infoBtn.id = INFO_BTN_ID;
      infoBtn.type = 'button';
      infoBtn.className = 'kfc-control-btn';
      infoBtn.innerHTML = INFO_SVG;
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleInfoOverlay();
      });

      // Layout-mode toggle (side vs. overlay; only shown while chat is open).
      const modeBtn = document.createElement('button');
      modeBtn.id = MODE_BTN_ID;
      modeBtn.type = 'button';
      modeBtn.className = 'kfc-control-btn';
      modeBtn.innerHTML = MODE_SVG;
      modeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleOverlayMode();
      });

      const settingsBtn = document.createElement('button');
      settingsBtn.id = SETTINGS_BTN_ID;
      settingsBtn.type = 'button';
      settingsBtn.className = 'kfc-control-btn';
      settingsBtn.innerHTML = SETTINGS_SVG;
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleSettingsPanel();
      });

      const btn = document.createElement('button');
      btn.id = BTN_ID;
      btn.type = 'button';
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

      wrap.appendChild(infoBtn);
      wrap.appendChild(modeBtn);
      wrap.appendChild(settingsBtn);
      wrap.appendChild(btn);
      wrap.appendChild(buildSettingsPanel());
    }
    fsEl.appendChild(wrap);
    syncControlState();
    updateBtnLabel();
  };

  // Reflect the current per-session preferences onto our own nodes (the wrap,
  // chat slot, buttons, info overlay) and a documentElement CSS variable.
  // Deliberately avoids classes on fsEl: Kick's React rewrites fsEl's className
  // on re-render (e.g. during a resize) and would strip them, reverting the
  // controls. Safe to call repeatedly.
  const syncControlState = () => {
    const overlayActive = overlayMode && active;
    document.documentElement.style.setProperty(
      '--kfc-overlay-opacity',
      (overlayOpacity / 100).toFixed(2)
    );
    document.documentElement.style.setProperty(
      '--kfc-info-bg-opacity',
      (infoBgOpacity / 100).toFixed(2)
    );
    // Video keeps full width in overlay mode; otherwise fall back to the shrink
    // calc by removing the override. --kfc-control-inset keeps Kick's full-width
    // bottom controls (the timeline) out from under the floating chat: it equals
    // the chat width in overlay mode (tracking live resize via --kfc-chat-width)
    // and is 0 otherwise (side mode already shrinks the whole player layer).
    if (overlayActive) {
      document.documentElement.style.setProperty('--kfc-video-width', '100%');
      document.documentElement.style.setProperty('--kfc-control-inset', 'var(--kfc-chat-width, 340px)');
    } else {
      document.documentElement.style.removeProperty('--kfc-video-width');
      document.documentElement.style.removeProperty('--kfc-control-inset');
    }

    // Chat-side docking. The .kfc-chat-left class flips the chat slot / divider
    // to the left edge (CSS); the variables below shift the player layers so
    // they don't overlap the left-docked chat. All offsets reference
    // --kfc-chat-width so they track live resize.
    const dockLeft = chatSide === 'left' && active;
    const chatWidthVar = 'var(--kfc-chat-width, 340px)';
    document.documentElement.classList.toggle('kfc-chat-left', chatSide === 'left');
    // Side mode shrinks the player, so push it right by the chat width.
    if (dockLeft && !overlayActive) {
      document.documentElement.style.setProperty('--kfc-video-shift', chatWidthVar);
    } else {
      document.documentElement.style.removeProperty('--kfc-video-shift');
    }
    // Overlay mode keeps the player full-width, so instead nudge the full-width
    // bottom controls row right so it clears the floating chat.
    if (dockLeft && overlayActive) {
      document.documentElement.style.setProperty('--kfc-control-shift', chatWidthVar);
    } else {
      document.documentElement.style.removeProperty('--kfc-control-shift');
    }
    // Keep the top-left info overlay clear of the chat in either mode.
    if (dockLeft) {
      document.documentElement.style.setProperty('--kfc-info-offset', chatWidthVar);
    } else {
      document.documentElement.style.removeProperty('--kfc-info-offset');
    }

    const wrap = document.getElementById(WRAP_ID);
    if (wrap) {
      wrap.classList.toggle('kfc-chat-open', active);
      wrap.classList.toggle('kfc-settings-open', settingsOpen);
    }

    if (chatSlot) {
      const overlayIdle =
        overlayActive && autoHideOverlayChat && chatSlot.classList.contains('kfc-idle');
      chatSlot.classList.toggle('kfc-overlay', overlayActive);
      chatSlot.classList.toggle('kfc-overlay-idle', overlayIdle);
      if (resizeHandle) resizeHandle.classList.toggle('kfc-overlay-idle', overlayIdle);
    } else if (resizeHandle) {
      resizeHandle.classList.remove('kfc-overlay-idle');
    }

    if (infoOverlay) infoOverlay.classList.toggle('kfc-hidden', infoHidden);

    const modeBtn = document.getElementById(MODE_BTN_ID);
    if (modeBtn) {
      modeBtn.classList.toggle('kfc-on', overlayMode);
      modeBtn.setAttribute(
        'aria-label',
        overlayMode ? 'Switch to side-by-side chat' : 'Switch to overlay chat'
      );
    }
    const infoBtn = document.getElementById(INFO_BTN_ID);
    if (infoBtn) {
      infoBtn.classList.toggle('kfc-off', infoHidden);
      infoBtn.setAttribute('aria-label', infoHidden ? 'Show stream info' : 'Hide stream info');
    }
    const settingsBtn = document.getElementById(SETTINGS_BTN_ID);
    if (settingsBtn) {
      settingsBtn.classList.toggle('kfc-on', settingsOpen);
      settingsBtn.setAttribute('aria-label', settingsOpen ? 'Close fullscreen settings' : 'Open fullscreen settings');
    }
    const widthValue = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-width-value`);
    if (widthValue) widthValue.textContent = `${chatWidth}px`;
    const infoOpacityInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-info-opacity-input`);
    if (infoOpacityInput) infoOpacityInput.value = String(infoBgOpacity);
    const infoOpacityValue = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-info-opacity-value`);
    if (infoOpacityValue) infoOpacityValue.textContent = `${infoBgOpacity}%`;
    const opacityInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-opacity-input`);
    if (opacityInput) opacityInput.value = String(overlayOpacity);
    const opacityValue = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-opacity-value`);
    if (opacityValue) opacityValue.textContent = `${overlayOpacity}%`;
    const idleInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-idle-input`);
    if (idleInput) idleInput.value = String(Math.round(idleDelayMs / 1000));
    const idleValue = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-idle-value`);
    if (idleValue) idleValue.textContent = `${Math.round(idleDelayMs / 1000)}s`;
    const autoHideInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-autohide-input`);
    if (autoHideInput) autoHideInput.checked = autoHideOverlayChat;
    const controlsHideInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-controls-hide-input`);
    if (controlsHideInput) controlsHideInput.checked = autoHideControls;
    const openOverlayInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-open-overlay-input`);
    if (openOverlayInput) openOverlayInput.checked = openChatAsOverlay;
    const restoreInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-restore-input`);
    if (restoreInput) restoreInput.checked = restoreChatOnFullscreen;
    const dockLeftInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-dock-left-input`);
    if (dockLeftInput) dockLeftInput.checked = chatSide === 'left';
  };

  const toggleSettingsPanel = () => {
    settingsOpen = !settingsOpen;
    syncControlState();
    onFsMouseMove();
  };

  const closeSettingsPanel = () => {
    if (!settingsOpen) return;
    settingsOpen = false;
    syncControlState();
  };

  document.addEventListener('click', (e) => {
    if (!settingsOpen) return;
    const wrap = document.getElementById(WRAP_ID);
    if (wrap?.contains(e.target)) return;
    closeSettingsPanel();
  });

  const toggleOverlayMode = () => {
    overlayMode = !overlayMode;
    log('overlay mode:', overlayMode);
    syncControlState();
    nudgePlayerResize();
  };

  const toggleInfoOverlay = () => {
    infoHidden = !infoHidden;
    log('info overlay hidden:', infoHidden);
    syncControlState();
    persistSettings();
  };

  const removeButton = () => {
    closeSettingsPanel();
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) wrap.remove();
  };

  // Idle auto-hide: fade the toggle button out when the user stops moving the
  // mouse, mirroring how Kick's own controls overlay disappears. Any
  // mousemove on the fullscreen element brings it back instantly. Defaults to
  // 4000ms because Kick's controls fade noticeably later than the standard
  // 3000ms HTML5-video-player default.
  let idleTimer = 0;
  let idleFsEl = null;
  // Estimate of how long Kick keeps its own controls/timeline visible after the
  // last pointer activity. We can't read Kick's internal timer, so when the
  // user's configured delay exceeds this we synthesize pointer activity on the
  // player to keep Kick's timeline alive in step with our overlay (see
  // startKeepAlive). Slightly off from Kick's real value only shifts the joint
  // fade by the difference — both still disappear together within ~1s.
  const KICK_NATIVE_IDLE_MS = 4000;
  // Re-nudge well inside the native window so Kick never times out mid-keepalive.
  const KICK_KEEPALIVE_INTERVAL_MS = 2000;
  let keepAliveInterval = 0;
  let keepAliveFinalTimer = 0;
  // Reset Kick's idle timer by dispatching an untrusted mousemove on the player.
  // onFsMouseMove ignores untrusted events, so this keeps Kick's controls up
  // without resetting our own idle timer.
  const nudgeKickControls = () => {
    if (!idleFsEl) return;
    const target = idleFsEl.querySelector('video') || idleFsEl;
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
  };
  const stopKeepAlive = () => {
    if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = 0; }
    if (keepAliveFinalTimer) { clearTimeout(keepAliveFinalTimer); keepAliveFinalTimer = 0; }
  };
  // Keep Kick's native timeline visible until our overlay is about to fade, so
  // both disappear together at idleDelayMs instead of Kick fading at its shorter
  // fixed delay. Only needed when the configured delay outlasts Kick's own.
  const startKeepAlive = () => {
    stopKeepAlive();
    if (!idleFsEl || idleDelayMs <= KICK_NATIVE_IDLE_MS) return;
    // The final nudge fires this long before idle so Kick's controls fade
    // KICK_NATIVE_IDLE_MS later — i.e. exactly when our overlay fades.
    const fireFinalAt = idleDelayMs - KICK_NATIVE_IDLE_MS;
    if (fireFinalAt > KICK_KEEPALIVE_INTERVAL_MS) {
      keepAliveInterval = setInterval(nudgeKickControls, KICK_KEEPALIVE_INTERVAL_MS);
    }
    keepAliveFinalTimer = setTimeout(() => {
      stopKeepAlive();
      nudgeKickControls();
    }, fireFinalAt);
  };
  // Kick's own controls fade on a fixed internal timer (~KICK_NATIVE_IDLE_MS),
  // so for delays shorter than that its timeline lingers after our overlay is
  // gone. We can't shorten Kick's timer, so we hide its controls ourselves the
  // moment we go idle. Pure opacity + pointer-events only — no height/layout
  // changes — so the timeline never shifts off the bottom of the player.
  let fadedKickControls = null;
  let kickControlsObserver = null;
  let kickControlsReapplyTimer = 0;
  // Locate Kick's controls cluster: start at the seekbar/timeline and climb to
  // the top of the subtree that does NOT contain the <video>, so we fade the
  // controls overlay without ever touching the video layer.
  const findKickControlsLayer = (fsEl) => {
    const seek = fsEl.querySelector('[class*="seekbar" i], [role="slider"]');
    if (!seek) return null;
    let node = seek;
    while (
      node.parentElement &&
      node.parentElement !== fsEl &&
      !node.parentElement.querySelector('video')
    ) {
      node = node.parentElement;
    }
    return node;
  };
  const applyKickControlsFade = (layer) => {
    layer.style.setProperty('opacity', '0', 'important');
    layer.style.setProperty('pointer-events', 'none', 'important');
  };
  const clearKickControlsFade = (layer) => {
    layer.style.removeProperty('opacity');
    layer.style.removeProperty('pointer-events');
  };
  // Kick's React reconciler can re-mount the controls layer mid-idle, which
  // would drop our inline fade. Re-find and re-apply when that happens. We watch
  // childList only (not attributes) so the seekbar's per-frame style ticks don't
  // trigger it — only genuine node add/remove (re-mounts) do.
  const reapplyKickControlsHidden = () => {
    if (!fadedKickControls || !idleFsEl) return;
    const layer = findKickControlsLayer(idleFsEl);
    if (!layer) return;
    if (layer !== fadedKickControls) {
      clearKickControlsFade(fadedKickControls);
      fadedKickControls = layer;
    }
    applyKickControlsFade(layer);
  };
  const stopKickControlsWatch = () => {
    if (kickControlsObserver) {
      kickControlsObserver.disconnect();
      kickControlsObserver = null;
    }
    if (kickControlsReapplyTimer) {
      clearTimeout(kickControlsReapplyTimer);
      kickControlsReapplyTimer = 0;
    }
  };
  const setKickControlsHidden = (hidden) => {
    if (hidden) {
      if (fadedKickControls || !idleFsEl) return;
      const layer = findKickControlsLayer(idleFsEl);
      if (!layer) return;
      fadedKickControls = layer;
      applyKickControlsFade(layer);
      kickControlsObserver = new MutationObserver(() => {
        if (kickControlsReapplyTimer) return;
        kickControlsReapplyTimer = setTimeout(() => {
          kickControlsReapplyTimer = 0;
          reapplyKickControlsHidden();
        }, 100);
      });
      kickControlsObserver.observe(idleFsEl, { childList: true, subtree: true });
    } else {
      stopKickControlsWatch();
      if (fadedKickControls) {
        clearKickControlsFade(fadedKickControls);
        fadedKickControls = null;
      }
    }
  };
  const setIdle = (idle) => {
    const effectiveIdle = idle && !settingsOpen;
    const controlsIdle = effectiveIdle && autoHideControls;
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) wrap.classList.toggle('kfc-idle', controlsIdle);
    const info = document.getElementById(INFO_ID);
    if (info) info.classList.toggle('kfc-idle', controlsIdle);
    if (chatSlot) chatSlot.classList.toggle('kfc-idle', effectiveIdle);
    setKickControlsHidden(controlsIdle);
    syncControlState();
  };
  const onFsMouseMove = (e) => {
    // Ignore the synthetic events we dispatch to keep Kick's controls alive —
    // only real pointer movement should reset our idle timer.
    if (e && !e.isTrusted) return;
    setIdle(false);
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => setIdle(true), idleDelayMs);
    startKeepAlive();
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
    stopKeepAlive();
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
      // Auto-open the side chat on fullscreen entry when the setting is on.
      // Deferred a tick so Kick's player tree finishes mounting; enableSideChat
      // itself waits for the video to be ready before touching the DOM.
      if (restoreChatOnFullscreen) {
        setTimeout(() => {
          const currentFs = document.fullscreenElement || document.webkitFullscreenElement;
          if (currentFs === fsEl && !active) enableSideChat(fsEl);
        }, 0);
      }
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

  // Restore persisted preferences before any fullscreen interaction, then push
  // the saved chat width onto the CSS variable so the first open uses it.
  loadSettings();
  applyChatWidth();

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
})();
