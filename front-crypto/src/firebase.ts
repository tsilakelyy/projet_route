import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

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

export const isFirebaseInitialized = (): boolean => !!app && !!db && !!auth;

export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    if (!isFirebaseInitialized()) {
      console.error('Firebase non initialise');
      return false;
    }
    console.log('Connexion Firebase Realtime Database OK');
    return true;
  } catch (error) {
    console.error('Connexion Firebase KO:', error);
    return false;
  }
};

export default app;
