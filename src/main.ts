import './styles.css';
import { App } from './app';
import { registerServiceWorker, requestPersistence } from './platform/pwa';

registerServiceWorker();
requestPersistence();

new App().start().catch((err: unknown) => {
  const box = document.createElement('div');
  box.className = 'fatal';
  box.textContent = `The game could not start: ${err instanceof Error ? err.message : String(err)}`;
  document.body.append(box);
  console.error(err);
});
