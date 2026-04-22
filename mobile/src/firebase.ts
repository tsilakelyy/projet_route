import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'projet-route-1';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAgooGs6XiDVqu5FhDiBHC5Actg7n_CzP0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '224726348719',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:224726348719:web:7d8cfa5a7a8667f7d1355a',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const realtimeDbUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`;
export const db = getDatabase(app, realtimeDbUrl);

const canUseMessaging =
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator;

export const messaging = (() => {
  if (!canUseMessaging) {
    return null;
  }

  try {
    return getMessaging(app);
  } catch (error) {
    console.warn('Firebase messaging unavailable in this environment:', error);
    return null;
  }
})();

export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    if (!messaging || typeof Notification === 'undefined') {
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || '',
      });
      return token;
    }
    return null;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

export const onMessageListener = () => {
  return new Promise((resolve) => {
    if (!messaging) {
      resolve(null);
      return;
    }

    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
};

export const isFirebaseInitialized = (): boolean => !!app && !!db && !!auth;
export const getFirebaseConfig = () => firebaseConfig;

export default app;
