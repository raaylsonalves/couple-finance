import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

let deferredPrompt: Event | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

(window as unknown as Record<string, unknown>).__installPrompt = {
  get prompt(): Event | null { return deferredPrompt; },
  clear(): void { deferredPrompt = null; },
};

if ('serviceWorker' in navigator) {
  let swRegistration: ServiceWorkerRegistration;

  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((reg) => {
      swRegistration = reg;
      console.log('✅ SW registrado');

      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (newSW) {
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    })
    .catch(() => console.warn('SW registration failed'));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });

  setInterval(() => {
    if (swRegistration) swRegistration.update();
  }, 30 * 60 * 1000);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
