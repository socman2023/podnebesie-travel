/**
 * Optional VK Mini Apps integration.
 * The browser-only game remains fully functional without VK and never loads
 * the SDK unless the launch URL belongs to our specific VK application.
 */
export const VK_APP_ID = '54848482';
export const VK_BRIDGE_URL = 'https://unpkg.com/@vkontakte/vk-bridge@2.14.0/dist/browser.min.js';

export function isVKLaunch(search = '') {
  return new URLSearchParams(search).get('vk_app_id') === VK_APP_ID;
}

export function loadVKBridge(win, doc) {
  if (win.vkBridge && typeof win.vkBridge.send === 'function') {
    return Promise.resolve(win.vkBridge);
  }
  return new Promise((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = VK_BRIDGE_URL;
    script.async = true;
    script.onload = () => {
      if (win.vkBridge && typeof win.vkBridge.send === 'function') {
        resolve(win.vkBridge);
      } else {
        reject(new Error('VK Bridge script loaded without vkBridge global'));
      }
    };
    script.onerror = () => reject(new Error('Unable to load VK Bridge SDK'));
    doc.head.appendChild(script);
  });
}

export async function initializeVKBridge({
  win = typeof window !== 'undefined' ? window : null,
  doc = typeof document !== 'undefined' ? document : null,
  search = win?.location?.search ?? '',
  load = loadVKBridge,
} = {}) {
  if (!win || !doc || !isVKLaunch(search)) return 'browser';
  try {
    const bridge = await load(win, doc);
    await bridge.send('VKWebAppInit');
    return 'vk-ready';
  } catch (error) {
    // Bridge must never block the single-player game itself.
    console.warn('[Podnebesie] VK Bridge initialization failed:', error);
    return 'vk-error';
  }
}

/**
 * In a VK iframe the host may disable document scrolling.
 * Make the application's own viewport scrollable before the game renders.
 * Also supports embedded preview frames without VK launch parameters.
 */
export function enableEmbeddedScrolling(win, doc) {
  if (!win || !doc) return false;
  const embedded = win.self !== win.top || isVKLaunch(win.location?.search ?? '');
  if (embedded) doc.documentElement?.classList.add('app-embedded');
  return embedded;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  enableEmbeddedScrolling(window, document);
  // Reset the contained viewport on transitions between full game screens.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (button?.matches('[data-enter-game], [data-show-intro], [data-start], [data-again], [data-new-setup]')) {
      document.getElementById('app')?.scrollTo({ top: 0 });
    }
  }, { capture: true });
  void initializeVKBridge();
}
