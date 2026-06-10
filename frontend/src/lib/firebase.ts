import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export async function requestNotificationPermission(): Promise<string | null> {
  const supported = await isSupported();
  if (!supported) {
    throw new Error("Push não suportado neste navegador/dispositivo");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notificações bloqueadas pelo usuário");
  }

  try {
    await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (e) {
    console.warn("SW registration error:", e);
  }

  const messaging = getMessaging(app);
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

  const token = await getToken(messaging, { vapidKey });

  return token;
}
