importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');


const firebaseConfig = {
  apiKey: "AIzaSyBu08HYc9gBnSLVDsKV_5V7Ecxh5hLQBuc",
  authDomain: "mpv-finance.firebaseapp.com",
  projectId: "mpv-finance",
  storageBucket: "mpv-finance.firebasestorage.app",
  messagingSenderId: "325453030089",
  appId: "1:325453030089:web:730cd00b1c21aaa9e52318",
  measurementId: "G-E4LYETS8XJ"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Requisito mínimo para PWA funcionar e ser instalável
self.addEventListener('fetch', function(event) {
  // Deixe vazio ou processe requisições. Apenas existir já conta para certas validações PWA.
});

