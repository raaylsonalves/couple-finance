const CACHE = "casal-finance-v1";
const ASSETS = ["/", "/index.html", "/favicon.svg", "/icon-192x192.png", "/icon-512x512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === "navigate") return caches.match("/");
        return new Response("Offline", { status: 503 });
      });
    })
  );
});

try {
  importScripts(
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js'
  );

  firebase.initializeApp({
    apiKey: "AIzaSyBu08HYc9gBnSLVDsKV_5V7Ecxh5hLQBuc",
    authDomain: "mpv-finance.firebaseapp.com",
    projectId: "mpv-finance",
    storageBucket: "mpv-finance.firebasestorage.app",
    messagingSenderId: "325453030089",
    appId: "1:325453030089:web:730cd00b1c21aaa9e52318",
    measurementId: "G-E4LYETS8XJ"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "Novo gasto";
    const options = {
      body: payload.notification?.body || "",
      icon: "/icon-192x192.png",
      badge: "/favicon.svg",
    };
    self.registration.showNotification(title, options);
  });
} catch (e) {
  console.warn("Firebase messaging SW init failed (push notifications disabled):", e);
}
