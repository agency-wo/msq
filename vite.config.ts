import { defineConfig } from 'vite';
import { serviceWorker } from './build/sw-plugin.ts';

/**
 * The exact policy minarankstudio.com sends (from MINA RANK/_headers). The
 * preview server sends it too, so a build that would break under it breaks
 * here first. The dev server does not: Vite injects styles inline in dev.
 */
export const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
  "connect-src 'self' https://api.web3forms.com; object-src 'none'; base-uri 'self'; " +
  "form-action 'self' https://api.web3forms.com; frame-ancestors 'self'";

export default defineConfig({
  // Relative URLs: the same build works on play.minarankstudio.com and on a github.io sub-path.
  base: './',
  build: {
    target: 'es2022',
    // Never inline assets as data: URIs; everything is a same-origin file.
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  preview: {
    headers: {
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
    },
  },
  plugins: [serviceWorker()],
});
