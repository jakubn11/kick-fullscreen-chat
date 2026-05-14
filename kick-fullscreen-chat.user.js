// ==UserScript==
// @name         Kick Fullscreen Chat
// @namespace    https://github.com/jakubn11/kick-fullscreen-chat
  // @version      0.8.2
// @description  Adds a Twitch-style "side chat" toggle button when watching a Kick stream in fullscreen.
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
  const CHAT_WIDTH = '340px';

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

  const log = (...args) => {
    if (DEBUG) console.log('[KickFullscreenChat]', ...args);
  };
  const warn = (...args) => console.warn('[KickFullscreenChat]', ...args);

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
      }
      #${WRAP_ID}.kfc-hidden { display: none; }
      #${BTN_ID} svg { transition: transform 0.15s ease; }
      .kfc-active #${BTN_ID} svg { transform: scaleX(-1); }

      .kfc-active {
        display: flex !important;
        flex-direction: row !important;
        align-items: stretch !important;
        background: #000;
      }
      /* Slot styles are intentionally NOT scoped under .kfc-active. Kick's React
         re-renders the fullscreen element periodically and writes its own className,
         stripping the .kfc-active class we added. When that happened, .kfc-video-slot
         lost its \`position: relative\` and \`transform: translateZ(0)\`, the controls
         overlay (\`absolute inset-0\`) escaped its containing block and stretched
         across fsEl, and the bottom timeline/control row overflowed under the chat.
         Targeting the slot classes directly keeps these properties applied for as
         long as our slot nodes exist, regardless of fsEl's className churn. */
      .kfc-video-slot {
        flex: 1 1 auto;
        min-width: 0;
        position: relative;
        overflow: hidden;
        /* Creates a containing block so position:fixed/absolute player layers
           (video element + controls/timeline grid) anchor to this slot. */
        transform: translateZ(0);
      }
      .kfc-video-slot video {
        position: relative;
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
      }
      .kfc-chat-slot {
        flex: 0 0 ${CHAT_WIDTH};
        background: #0e0e10;
        overflow: hidden;
        display: flex;
        flex-direction: column;
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
  let videoSlot = null;
  let active = false;
  let suppressObserver = false;
  let videoEl = null;
  let enabledAt = 0;
  let fullscreenVideoEl = null;
  let onVideoLoaded = null;
  let onVideoBuffering = null;
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

  // Pending-enable state: when the user clicks Chat while the video is still
  // loading (readyState < 2), we defer the wrap until the video reaches a
  // stable state. Wrapping mid-load can trip React's reconciler (Kick is
  // re-mounting parts of the player tree right then) and end with a 404.
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

  // When the user changes stream quality (or anything else that causes Kick to reload
  // the player), Kick's React reconciliation conflicts with our wrapped layout and
  // can navigate the page to a 404 error. Tearing the layout down at the first sign
  // of a reload prevents the conflict.
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

  // Reloading the video element (via emptied/loadstart) is too late: React's reconciler
  // throws synchronously when it tries to remove a node we've moved into videoSlot, and
  // Kick's error boundary navigates to its 404 page before our async handlers fire.
  // Catch the user's click on actions that re-mount the player (quality change, seeking)
  // in the capture phase and tear down synchronously, so the DOM is back in Kick's
  // expected shape before its onClick runs.
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
  const onDocClickCapture = (e) => {
    if (!active) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) return;
    const quality = isQualityOptionClick(target);
    if (quality) {
      log('quality option click detected (', quality, '), tearing down preemptively');
      videoReloading = true;
      disableSideChat(fs);
      return;
    }
    if (isSeekbarClick(target)) {
      log('seekbar click detected, tearing down preemptively');
      videoReloading = true;
      disableSideChat(fs);
      return;
    }
    const goLive = isGoLiveClick(target);
    if (goLive) {
      log('go-to-live click detected (', goLive, '), tearing down preemptively');
      videoReloading = true;
      disableSideChat(fs);
      return;
    }
  };
  document.addEventListener('click', onDocClickCapture, true);
  // Seeking via keyboard (arrow keys) or pointerdown on the seekbar also re-mounts
  // the player tree without going through a click event. Cover those too.
  const onDocPointerDownCapture = (e) => {
    if (!active) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!isSeekbarClick(target)) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) return;
    log('seekbar pointerdown detected, tearing down preemptively');
    videoReloading = true;
    disableSideChat(fs);
  };
  document.addEventListener('pointerdown', onDocPointerDownCapture, true);

  // When chat starts hidden (data-chat="false") and the user enables our side layout,
  // Kick's internal "is chat shown" state is out of sync with the DOM. The next click
  // on Kick's "Hide chat" button toggles Kick's state from hidden→shown — so data-chat
  // doesn't change to "false" and the MutationObserver doesn't fire. Catch the click
  // directly so one click always tears down, regardless of Kick's internal state.
  const HIDE_CHAT_RE = /hide\s*chat|close\s*chat|collapse\s*chat/;
  const onChatSlotClick = (e) => {
    if (!active) return;
    const btn = e.target?.closest?.('button');
    if (!btn) return;
    const text = (btn.textContent || '').trim().toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (!HIDE_CHAT_RE.test(text) && !HIDE_CHAT_RE.test(aria)) return;
    log('hide-chat button clicked, scheduling teardown');
    // Let Kick's own onClick handler run first, then tear down on the next tick.
    setTimeout(() => {
      if (!active) return;
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) disableSideChat(fs);
    }, 0);
  };

  const enableSideChat = (fsEl) => {
    if (!fsEl) {
      log('enableSideChat: no fullscreen element');
      return;
    }
    if (active || pendingVideoEl) return;

    // Defer wrapping while the video is still loading — Kick's React is in the
    // middle of mounting the player tree, and moving its children mid-mount
    // causes reconciliation to fail and Kick to navigate to its 404 page.
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

    // Make sure Kick's CSS is in the "chat visible" state before we move the node.
    suppressObserver = true;
    const flipped = setKickDataChat('true');
    log('enableSideChat: set data-chat="true" on', flipped, 'element(s)');
    // Release the suppression on the next microtask so the observer ignores our own write.
    queueMicrotask(() => {
      suppressObserver = false;
    });

    // Wrap the fullscreen element's children so we can lay them out as flex columns.
    // Stage moves in a DocumentFragment so we only reflow once.
    videoSlot = document.createElement('div');
    videoSlot.className = 'kfc-video-slot';
    const videoFrag = document.createDocumentFragment();
    while (fsEl.firstChild) videoFrag.appendChild(fsEl.firstChild);
    videoSlot.appendChild(videoFrag);

    chatSlot = document.createElement('div');
    chatSlot.className = 'kfc-chat-slot';
    chatSlot.addEventListener('click', onChatSlotClick, true);

    savedChatParent = chat.parentNode;
    savedChatNextSibling = chat.nextSibling;
    chatSlot.appendChild(chat);

    fsEl.appendChild(videoSlot);
    fsEl.appendChild(chatSlot);
    fsEl.classList.add('kfc-active');

    // Re-mount the toggle button wrapper on top of the video slot.
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) videoSlot.appendChild(wrap);

    active = true;
    enabledAt = Date.now();
    videoEl = fsEl.querySelector('video');
    if (videoEl) {
      videoEl.addEventListener('emptied', onVideoEmptied);
      videoEl.addEventListener('loadstart', onVideoLoadStart);
    }
    updateBtnLabel();
    nudgePlayerResize();
  };

  const disableSideChat = (fsEl) => {
    if (!fsEl || !videoSlot || !chatSlot) return;
    // Mark inactive immediately so re-entrant teardown attempts (e.g. popstate firing
    // while we're already cleaning up) short-circuit out.
    active = false;
    if (videoEl) {
      videoEl.removeEventListener('emptied', onVideoEmptied);
      videoEl.removeEventListener('loadstart', onVideoLoadStart);
      videoEl = null;
    }

    // Put chat back where it came from.
    const chat = chatSlot.firstChild;
    if (chat && savedChatParent) {
      if (savedChatNextSibling && savedChatNextSibling.parentNode === savedChatParent) {
        savedChatParent.insertBefore(chat, savedChatNextSibling);
      } else {
        savedChatParent.appendChild(chat);
      }
    }

    // Unwrap the video slot. Use a fragment so we only reflow once.
    const unwrapFrag = document.createDocumentFragment();
    while (videoSlot.firstChild) unwrapFrag.appendChild(videoSlot.firstChild);
    fsEl.appendChild(unwrapFrag);

    fsEl.classList.remove('kfc-active');
    videoSlot.remove();
    chatSlot.remove();
    videoSlot = null;
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
    }
    fullscreenVideoEl = null;
    onVideoLoaded = null;
    onVideoBuffering = null;
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
      clearVideoReadyTimer();
      videoReloading = true;
      updateBtnLabel();
      log('video buffering/reloading, button disabled');
    };
    video.addEventListener('loadeddata', onVideoLoaded);
    video.addEventListener('canplay', onVideoLoaded);
    video.addEventListener('loadstart', onVideoBuffering);
    video.addEventListener('emptied', onVideoBuffering);
  };

  const startVideoLoadingMonitor = (fsEl) => {
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
      // If we attached to a video that's *already* past readyState 2, no
      // canplay/loadeddata event will fire after our listener installs, so we
      // synthesize the grace-delayed clear here. (Otherwise the flag would
      // stay stuck `true` whenever Kick swaps the element fast enough that
      // the new one is already ready by the time the MutationObserver wakes.)
      // We still don't clear the flag synchronously — same reason as the
      // event-driven path: react may still be mid-commit.
      if (videoReloading && video.readyState >= 2 && onVideoLoaded) {
        onVideoLoaded();
      }
      updateBtnLabel();
      log('video monitor attached, readyState=', video.readyState);
      return true;
    };

    tryAttach();

    // Kick may replace the <video> element entirely on quality change or DVR
    // exit — re-attach listeners whenever the subtree changes.
    videoSwapObserver = new MutationObserver(() => {
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
    detachVideoListeners();
    if (videoSwapObserver) {
      videoSwapObserver.disconnect();
      videoSwapObserver = null;
    }
    videoReloading = false;
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
    (active && videoSlot ? videoSlot : fsEl).appendChild(wrap);
    updateBtnLabel();
  };

  const removeButton = () => {
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) wrap.remove();
  };

  // When Kick's own hide-chat button toggles data-chat="false", tear down our layout
  // so the empty chat slot collapses and our "Chat" button reappears.
  const dataChatObserver = new MutationObserver((muts) => {
    if (!active || suppressObserver) return;
    for (const m of muts) {
      if (m.attributeName !== 'data-chat') continue;
      const val = m.target.getAttribute?.('data-chat');
      if (val === 'false') {
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
      startVideoLoadingMonitor(fsEl);
    } else {
      // Exiting fullscreen — clean up.
      clearPendingEnable();
      stopVideoLoadingMonitor();
      if (active) {
        // We need to operate against the previous fullscreen element; rebuild from current DOM.
        const parent = videoSlot?.parentElement;
        if (parent) disableSideChat(parent);
      }
      removeButton();
    }
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
})();
