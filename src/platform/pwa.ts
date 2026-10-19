/** Installable-web-app plumbing: offline cache, iOS detection, and keeping Safari's gestures out of the game. */

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // Offline play is a bonus; the game still runs online without it.
    });
  });
}

/** Ask the browser not to evict saves under storage pressure (iOS 17+ honours this for Home Screen apps). */
export function requestPersistence(): void {
  void navigator.storage?.persist?.().catch(() => false);
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but Macs have no touch screen.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/** Phone held sideways: the game is portrait-only, and iOS ignores the manifest's orientation lock. */
export function isPhoneLandscape(): boolean {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return coarse && window.innerWidth > window.innerHeight && Math.min(window.innerWidth, window.innerHeight) < 540;
}

/** Stop pinch-zoom, double-tap zoom, long-press menus and page scrolling from hijacking the game. */
export function installGestureGuards(): void {
  const block = (e: Event): void => e.preventDefault();
  document.addEventListener('gesturestart', block);
  document.addEventListener('gesturechange', block);
  document.addEventListener('dblclick', block);
  document.addEventListener('contextmenu', block);
  document.addEventListener(
    'touchmove',
    (e) => {
      // A drag that began before a board opened under it may already be a scroll the browser will not cancel.
      if (!e.cancelable) return;
      if (!(e.target instanceof Element) || !e.target.closest('.scroll')) e.preventDefault();
    },
    { passive: false },
  );
}
