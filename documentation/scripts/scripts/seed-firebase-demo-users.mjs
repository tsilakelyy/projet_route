const firebaseApiKey = (process.env.FIREBASE_API_KEY || 'AIzaSyCWvgIshY4Abcr6BdlK_7YifhMi0amz9QA').trim();
const backendBaseUrl = (process.env.BACKEND_URL || 'http://localhost:8082').replace(/\/+$/, '');
const managerEmail = (process.env.MANAGER_EMAIL || 'rojo.rabenanahary@gmail.com').trim();
const managerUsername = (process.env.MANAGER_USERNAME || 'rojo.rabenanahary').trim();
const managerPassword = process.env.MANAGER_PASSWORD || 'admin1234';

const demoUsers = [
  { nomUtilisateur: 'admin', email: 'admin@gmail.com', password: 'admin1234', role: 'UTILISATEUR' },
  { nomUtilisateur: managerUsername, email: managerEmail, password: managerPassword, role: 'MANAGER' },
];

async function createAuthUser(user) {
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
    const data = await response.json();
    console.log(`Firebase user created: ${user.email} (uid=${data.localId})`);
    return;
  }

  const data = await response.json().catch(() => ({}));
  const message = data?.error?.message || 'FIREBASE_AUTH_ERROR';
  if (message === 'EMAIL_EXISTS') {
    console.log(`Firebase user already exists: ${user.email}`);
    return;
  }
  throw new Error(`Firebase creation failed for ${user.email}: ${message}`);
}

async function verifyCredentials(user) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      returnSecureToken: true,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || 'INVALID_LOGIN_CREDENTIALS';
    throw new Error(`Credential check failed for ${user.email}: ${message}`);
  }
}

async function syncBackend(user) {
  const managerLogin = await fetch(`${backendBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: managerEmail, password: managerPassword }),
  });

  if (!managerLogin.ok) {
    throw new Error(`Manager login failed for backend sync: HTTP ${managerLogin.status}`);
  }

  const loginData = await managerLogin.json().catch(() => ({}));
  const token = loginData?.token;
  if (!token) {
    throw new Error('Manager login failed for backend sync: token missing');
  }

  const listResponse = await fetch(`${backendBaseUrl}/api/auth/users`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!listResponse.ok) {
    throw new Error(`Backend users list failed for ${user.email}: HTTP ${listResponse.status}`);
  }

  const existingUsers = await listResponse.json().catch(() => []);
  const userExists = Array.isArray(existingUsers) && existingUsers.some((item) => item?.email === user.email);
  if (userExists) {
    return;
  }

  const createResponse = await fetch(`${backendBaseUrl}/api/auth/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      nomUtilisateur: user.nomUtilisateur,
      email: user.email,
      password: user.password,
      role: user.role || 'UTILISATEUR',
    }),
  });

  if (!createResponse.ok) {
    const message = await createResponse.text();
    throw new Error(`Backend user create failed for ${user.email}: HTTP ${createResponse.status} ${message}`);
  }
}

async function run() {
  console.log(`Seeding demo users with backend=${backendBaseUrl}`);
  for (const user of demoUsers) {
    await createAuthUser(user);
    await verifyCredentials(user);
    await syncBackend(user);
    console.log(`Ready: ${user.email}`);
  }
  console.log('Done.');
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
