import { apiUrl } from '../config/api';

type SeedUser = {
  nomUtilisateur: string;
  email: string;
  password: string;
};

const defaultUsers: SeedUser[] = [
  { nomUtilisateur: 'admin', email: 'admin@gmail.com', password: 'admin1234' },
];

const firebaseApiKey = (import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCWvgIshY4Abcr6BdlK_7YifhMi0amz9QA').trim();

const createAuthUser = async (user: SeedUser): Promise<void> => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      returnSecureToken: true,
    }),
  });

  if (response.ok) {
    return;
  }

  const data = await response.json().catch(() => ({}));
  const message = data?.error?.message || 'FIREBASE_AUTH_ERROR';
  if (message === 'EMAIL_EXISTS') {
    return;
  }
  throw new Error(`Firebase creation failed for ${user.email}: ${message}`);
};

const syncWithBackend = async (user: SeedUser): Promise<void> => {
  const response = await fetch(apiUrl('/api/auth/mobile-login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      nomUtilisateur: user.nomUtilisateur,
      sourceAuth: 'firebase',
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend sync failed for ${user.email}: HTTP ${response.status}`);
  }
};

export const initializeUsersInFirebase = async (): Promise<void> => {
  for (const user of defaultUsers) {
    await createAuthUser(user);
    await syncWithBackend(user);
  }
  console.log('Firebase Auth + backend sync initialises pour les utilisateurs de demo');
};
