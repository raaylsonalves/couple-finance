import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

let deferredPrompt: Event | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('✅ beforeinstallprompt capturado');
});

(window as unknown as Record<string, unknown>).__installPrompt = {
  get prompt(): Event | null { return deferredPrompt; },
  clear(): void { deferredPrompt = null; },
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then(() => console.log('✅ SW registrado'))
    .catch(() => console.warn('Service worker registration failed'));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
