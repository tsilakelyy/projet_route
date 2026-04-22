<template>
  <ion-page>
    <ion-content :fullscreen="true" class="login-page">
      <div class="login-container texture-overlay">
        <div class="gradient-orb orb-1 float-element"></div>
        <div class="gradient-orb orb-2 float-element"></div>
        <div class="gradient-orb orb-3 float-element"></div>
        
        <div class="login-card glass-card hover-lift scroll-reveal">
          <div class="login-header stagger-item">
            <div class="logo-icon">
              <ion-icon :icon="layers" />
            </div>
            <h1>RouteWatch</h1>
            <p>Signalement des Problèmes Routiers</p>
          </div>

          <div class="login-form">
            <div class="input-group stagger-item">
              <label>
                <ion-icon :icon="mail" />
                Email
              </label>
              <ion-input 
                v-model="loginEmail" 
                type="email" 
                placeholder="votreemail@exemple.com"
                class="custom-input"
              />
            </div>

            <div class="input-group stagger-item">
              <label>
                <ion-icon :icon="lockClosed" />
                Mot de passe
              </label>
              <ion-input 
                v-model="loginPassword" 
                type="password" 
                placeholder="••••••••"
                class="custom-input"
              />
            </div>

            <ion-button expand="block" @click="login" class="login-button btn-modern stagger-item">
              <span v-if="!isLoading">
                Se connecter
                <ion-icon :icon="arrowForward" />
              </span>
              <ion-spinner v-else name="crescent" />
            </ion-button>

            <div class="demo-credentials stagger-item">
              <p class="demo-title">Exemple de connexion</p>
              <p class="demo-line">Email: adminfirebase@gmail.com</p>
              <p class="demo-line">Mot de passe: admin1234</p>
            </div>
          </div>
        </div>

        <!-- Composant SyncStatus -->
        <SyncStatus />
      </div>

      <ion-toast
        :is-open="showToast"
        :message="toastMessage"
        :duration="2000"
        @didDismiss="showToast = false"
        position="top"
        color="dark"
      />
      
      <!-- Indicateur de notifications -->
      <div class="notification-indicator" @click="showNotifications = true">
        <ion-icon :icon="notificationsIcon" />
        <span v-if="unreadCount > 0" class="badge">{{ unreadCount }}</span>
      </div>
      
      <!-- Liste des notifications -->
      <ion-modal :is-open="showNotifications" @will-dismiss="showNotifications = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Notifications</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="clearAllNotifications" v-if="notifications.length > 0">
                Tout effacer
              </ion-button>
              <ion-button @click="showNotifications = false">
                <ion-icon :icon="close" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div v-if="notifications.length === 0" class="empty-notifications">
            <p>Aucune notification</p>
          </div>
          <div v-else class="notifications-list">
            <div 
              v-for="notification in notifications" 
              :key="notification.id"
              class="notification-item"
              :class="{
                'unread': !notification.read,
                'success': notification.type === 'success',
                'error': notification.type === 'error',
                'info': notification.type === 'info',
                'warning': notification.type === 'warning'
              }"
              @click="markNotificationAsRead(notification.id)"
            >
              <div class="notification-header">
                <span class="notification-type">{{ notification.type }}</span>
                <span class="notification-time">{{ formatNotificationTime(notification.timestamp) }}</span>
              </div>
              <div class="notification-message">{{ notification.message }}</div>
              <ion-button 
                fill="clear" 
                size="small" 
                @click.stop="removeNotification(notification.id)"
                class="notification-remove"
              >
                <ion-icon :icon="close" />
              </ion-button>
            </div>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { IonPage, IonContent, IonInput, IonButton, IonToast, IonIcon, IonSpinner, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons } from '@ionic/vue';
import { mail, lockClosed, arrowForward, layers, notifications as notificationsIcon, close } from 'ionicons/icons';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '@/firebase';
import { useRouter } from 'vue-router';
import { apiUrl } from '@/config/api';
import SyncStatus from '@/components/SyncStatus.vue';
import { getPresenceClientId, getPreferredSignalementOwnerId, parseCurrentUser } from '@/services/currentUser';

const router = useRouter();
const loginEmail = ref('');
const loginPassword = ref('');
const showToast = ref(false);
const toastMessage = ref('');
const isLoading = ref(false);
let bootstrapTimer: number | null = null;
let pendingSyncTimer: number | null = null;
let heartbeatTimer: number | null = null;

// Système de notifications persistantes
const notifications = ref<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning'; timestamp: number; read: boolean }>>([]);
const webDetected = ref(false);
const showNotifications = ref(false);

// Calculer le nombre de notifications non lues
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length);

// Formater le temps de notification
const formatNotificationTime = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  return `Il y a ${days} j`;
};

// Fonctions de gestion des notifications
const addNotification = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
  const id = Date.now().toString();
  notifications.value.unshift({
    id,
    message,
    type,
    timestamp: Date.now(),
    read: false
  });
  // Sauvegarder dans localStorage pour persistance
  localStorage.setItem("mobileNotifications", JSON.stringify(notifications.value));
};

const markNotificationAsRead = (id: string) => {
  const notification = notifications.value.find(n => n.id === id);
  if (notification) {
    notification.read = true;
    localStorage.setItem("mobileNotifications", JSON.stringify(notifications.value));
  }
};

const removeNotification = (id: string) => {
  notifications.value = notifications.value.filter(n => n.id !== id);
  localStorage.setItem("mobileNotifications", JSON.stringify(notifications.value));
};

const clearAllNotifications = () => {
  notifications.value = [];
  localStorage.setItem("mobileNotifications", JSON.stringify(notifications.value));
};

// Charger les notifications au démarrage
const loadNotifications = () => {
  const saved = localStorage.getItem("mobileNotifications");
  if (saved) {
    try {
      notifications.value = JSON.parse(saved);
    } catch {
      notifications.value = [];
    }
  }
};

const requestPeerSync = async (source: 'web' | 'mobile', requestedBy: string) => {
  try {
    await fetch(apiUrl('/api/presence/request-sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, requestedBy }),
    });
  } catch (error) {
    console.error('Erreur demande de synchronisation:', error);
  }
};

// Détecter le module web
const detectWebModule = async () => {
  try {
    // Tenter de contacter le backend pour vérifier si le module web est actif
    const response = await fetch(apiUrl('/api/presence/web-active'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.active) {
        webDetected.value = true;
        addNotification("Module web détecté sur votre ordinateur", "success");
        // Demander automatiquement une synchronisation
        requestPeerSync("mobile", "mobile-login");
      } else {
        webDetected.value = false;
        addNotification("Module web non détecté. Vérifiez que l'application web est lancée sur votre ordinateur.", "warning");
      }
    }
  } catch (error) {
    console.error("Erreur détection module web:", error);
    webDetected.value = false;
    addNotification("Impossible de contacter le module web. Vérifiez votre connexion.", "error");
  }
};

onMounted(() => {
  // Charger les notifications existantes
  loadNotifications();

  const params = new URLSearchParams(window.location.search);
  if (params.get('openNotifications') === '1') {
    showNotifications.value = true;
  }
  
  // Détecter le module web au démarrage
  detectWebModule();
  
  bootstrapMobileUsers(true).then((ok) => {
    if (ok) {
      webDetected.value = true;
      addNotification('Module web détecté: comptes mobile synchronisés', 'success');
      toastMessage.value = 'Web detecte: comptes mobile synchronises';
      showToast.value = true;
    }
  });

  bootstrapTimer = window.setInterval(() => {
    bootstrapMobileUsers(true);
  }, 30000);

  heartbeatMobile().catch(() => {
    // no-op
  });
  heartbeatTimer = window.setInterval(() => {
    heartbeatMobile().catch(() => {
      // no-op
    });
  }, 15000);

  pendingSyncTimer = window.setInterval(() => {
    checkPendingSyncRequests();
  }, 12000);

  const user = localStorage.getItem('currentUser');
  if (user) {
    const userData = JSON.parse(user);
    if (userData.sessionExpiration && Date.now() > userData.sessionExpiration) {
      logout();
    } else {
      startSessionCheck();
      router.push('/tabs/tab2');
    }
  }
});

onUnmounted(() => {
  if (bootstrapTimer) {
    window.clearInterval(bootstrapTimer);
    bootstrapTimer = null;
  }
  if (pendingSyncTimer) {
    window.clearInterval(pendingSyncTimer);
    pendingSyncTimer = null;
  }
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
});

const bootstrapMobileUsers = async (silent = true) => {
  try {
    const response = await fetch(apiUrl('/api/auth/mobile-bootstrap'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      if (!silent) {
        toastMessage.value = 'Web detecte mais bootstrap Firebase impossible';
        showToast.value = true;
      }
      return false;
    }

    const data = await response.json().catch(() => ({}));
    if (!silent) {
      const synced = Number(data?.synced || 0);
      const total = Number(data?.totalCandidates || 0);
      toastMessage.value = `Web detecte: ${synced}/${total} comptes prepares pour mobile`;
      showToast.value = true;
    }
    return true;
  } catch (error) {
    console.error('Erreur bootstrap mobile users:', error);
    if (!silent) {
      toastMessage.value = 'Connexion web indisponible';
      showToast.value = true;
    }
    return false;
  }
};

const ackPeerSync = async (requestId: number) => {
  try {
    await fetch(apiUrl('/api/presence/ack-sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'mobile', requestId }),
    });
  } catch {
    // no-op
  }
};

const heartbeatMobile = async () => {
  const currentUser = parseCurrentUser();
  const clientId = getPresenceClientId(currentUser, 'mobile-login');

  await fetch(apiUrl('/api/presence/heartbeat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientType: 'mobile', clientId }),
  });
};

const checkPendingSyncRequests = async () => {
  try {
    const response = await fetch(apiUrl('/api/presence/pending-sync?target=mobile'));
    if (!response.ok) return;

    const pending = await response.json();
    if (!pending?.hasPending) return;

    await bootstrapMobileUsers(true);
    toastMessage.value = 'Nouvelle synchronisation web detectee pour les comptes mobile';
    showToast.value = true;

    if (pending.requestId) {
      await ackPeerSync(Number(pending.requestId));
    }
  } catch {
    // no-op
  }
};

const checkAccountBlocked = async (email: string) => {
  try {
    const checkBlockResponse = await fetch(apiUrl('/api/auth/check-blocked'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!checkBlockResponse.ok) {
      return false;
    }

    const blockData = await checkBlockResponse.json();
    if (blockData.blocked) {
      toastMessage.value = 'Votre compte est bloque. Contactez un administrateur.';
      showToast.value = true;
      return true;
    }
  } catch (error) {
    console.error('Erreur verification blocage:', error);
  }

  return false;
};

const performLogin = async (emailInput: string, passwordInput: string) => {
  if (isLoading.value) return;
  isLoading.value = true;

  try {
    const email = emailInput.trim();
    const password = passwordInput;

    if (!email || !password) {
      toastMessage.value = 'Email et mot de passe requis';
      showToast.value = true;
      return;
    }

    const blocked = await checkAccountBlocked(email);
    if (blocked) {
      return;
    }

    await bootstrapMobileUsers(true);
    let credential: any;
    try {
      credential = await signInWithEmailAndPassword(auth, email, password);
    } catch (firstAuthError: any) {
      const code = firstAuthError?.code || '';
      const isCredentialError =
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email';

      if (isCredentialError) {
        // Retry once after forcing a fresh user bootstrap from backend.
        await bootstrapMobileUsers(true);
        credential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        throw firstAuthError;
      }
    }
    const firebaseUser = credential.user;

    let sessionDurationMinutes = 60;
    try {
      const paramsResponse = await fetch(apiUrl('/api/auth/params'));
      if (paramsResponse.ok) {
        const params = await paramsResponse.json();
        const sessionParam = params.find((p: any) => p.cle === 'duree_session_minutes');
        if (sessionParam) {
          sessionDurationMinutes = parseInt(sessionParam.valeur) || 60;
        }
      }
    } catch (error) {
      console.error('Erreur recuperation parametres session:', error);
    }

    const expirationTime = Date.now() + (sessionDurationMinutes * 60 * 1000);
    const nomUtilisateur = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Mobile User');

    let backendUserId = '';
    let backendNomUtilisateur = nomUtilisateur;
    let backendEmail = firebaseUser.email || email;
    let backendSourceAuth = 'firebase';

    let backendSyncWarning = '';
    try {
      const mobileSyncResponse = await fetch(apiUrl('/api/auth/mobile-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: backendEmail,
          nomUtilisateur,
          sourceAuth: 'firebase',
          firebaseUid: firebaseUser.uid,
        }),
      });

      if (!mobileSyncResponse.ok) {
        const backendMessage = await mobileSyncResponse.text();
        backendSyncWarning = backendMessage || 'Backend indisponible: session Firebase active en mode autonome.';
      } else {
        const backendData = await mobileSyncResponse.json().catch(() => null);
        backendUserId = backendData?.backendUserId != null ? String(backendData.backendUserId) : '';
        backendNomUtilisateur = backendData?.nomUtilisateur || backendNomUtilisateur;
        backendEmail = backendData?.email || backendEmail;
        backendSourceAuth = backendData?.sourceAuth || backendSourceAuth;
      }
    } catch (error) {
      console.error('Erreur sync utilisateur PostgreSQL:', error);
      backendSyncWarning = 'Backend indisponible: session Firebase active en mode autonome.';
    }

    const user = {
      id: backendUserId || firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      backendUserId: backendUserId || undefined,
      email: backendEmail,
      nomUtilisateur: backendNomUtilisateur,
      sourceAuth: backendSourceAuth,
      sessionExpiration: expirationTime,
    };

    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userId', getPreferredSignalementOwnerId(user) || String(user.id));
    startSessionCheck();

    setTimeout(() => {
      router.push('/tabs/tab2');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('authStateChanged'));
        window.dispatchEvent(new CustomEvent('userLoggedIn'));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'currentUser',
          newValue: JSON.stringify(user),
          oldValue: null,
          storageArea: localStorage,
        }));
        setTimeout(() => {
          toastMessage.value = backendSyncWarning || 'Connexion reussie';
          showToast.value = true;
        }, 100);
      }, 100);
    }, 100);
  } catch (error: any) {
    const code = error?.code || '';
    const isCredentialError =
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-email';

    if (isCredentialError) {
      toastMessage.value = 'Compte introuvable ou mot de passe incorrect. Creez/verifiez le compte depuis le web puis reessayez.';
      showToast.value = true;
    } else if (code === 'auth/too-many-requests') {
      toastMessage.value = 'Trop de tentatives. Reessayez plus tard.';
      showToast.value = true;
    } else {
      console.error('Erreur de connexion:', error);
      toastMessage.value = 'Erreur de connexion: ' + (error?.message || 'inconnue');
      showToast.value = true;
    }
  } finally {
    isLoading.value = false;
  }
};

const login = async () => {
  await performLogin(loginEmail.value, loginPassword.value);
};

const startSessionCheck = () => {
  checkSessionExpiration();
  setInterval(() => {
    checkSessionExpiration();
  }, 10000);
};

const checkSessionExpiration = () => {
  const currentUser = parseCurrentUser();
  if (currentUser?.sessionExpiration && Date.now() > currentUser.sessionExpiration) {
    logout();
  }
};

const logout = () => {
  signOut(auth).catch((error) => {
    console.error('Erreur logout Firebase:', error);
  });
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userId');
  router.replace('/tabs/tab1');
  toastMessage.value = 'Session expiree. Veuillez vous reconnecter.';
  showToast.value = true;
};
</script>

<style scoped>
.login-page {
  --background: #f6f2ff;
}

/* Styles pour les notifications */
.notification-indicator {
  position: fixed;
  top: 16px;
  right: 16px;
  background: rgba(33, 16, 63, 0.9);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  cursor: pointer;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.notification-indicator .badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.empty-notifications {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;
}

.notifications-list {
  padding: 16px;
}

.notification-item {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.notification-item.unread {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
}

.notification-item.success {
  border-left: 4px solid #10b981;
}

.notification-item.error {
  border-left: 4px solid #ef4444;
}

.notification-item.warning {
  border-left: 4px solid #f59e0b;
}

.notification-item.info {
  border-left: 4px solid #3b82f6;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.notification-type {
  font-size: 12px;
  text-transform: uppercase;
  font-weight: bold;
  color: #6b7280;
}

.notification-time {
  font-size: 12px;
  color: #9ca3af;
}

.notification-message {
  color: #1f2937;
  line-height: 1.5;
}

.notification-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  color: #9ca3af;
}

.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.texture-overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.08;
  background-image:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.28) 0 1px, transparent 1px),
    radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1px);
  background-size: 22px 22px, 26px 26px;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: float 8s ease-in-out infinite;
}

.orb-1 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #21103f 0%, #6731bf 100%);
  top: -80px;
  left: -80px;
}

.orb-2 {
  width: 250px;
  height: 250px;
  background: linear-gradient(135deg, #8c52e6 0%, #b182ff 100%);
  bottom: -60px;
  right: -60px;
  animation-delay: -2s;
}

.orb-3 {
  width: 200px;
  height: 200px;
  background: linear-gradient(135deg, #21103f 0%, #7e3ffc 100%);
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -4s;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.05); }
}

.login-card {
  position: relative;
  z-index: 10;
  background: white;
  backdrop-filter: blur(20px);
  border: 1px solid #dbcdf2;
  border-radius: 24px;
  padding: 40px 30px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
}

.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.logo-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, #21103f 0%, #6731bf 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 30px -10px rgba(30, 58, 95, 0.5);
}

.logo-icon ion-icon {
  font-size: 28px;
  color: white;
}

.login-header h1 {
  font-size: 26px;
  font-weight: 700;
  color: #21103f;
  margin: 0 0 8px 0;
}

.login-header p {
  font-size: 14px;
  color: #705e96;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #3a225d;
}

.input-group label ion-icon {
  font-size: 16px;
  color: #6731bf;
}

.input-group ion-input {
  --background: #f6f2ff;
  --border-radius: 12px;
  --padding-start: 16px;
  --padding-end: 16px;
  --padding-top: 14px;
  --padding-bottom: 14px;
  --color: #21103f;
  --placeholder-color: #927ab8;
  border: 1px solid #dbcdf2;
  border-radius: 12px;
  font-size: 15px;
}

.login-button {
  --background: linear-gradient(135deg, #21103f 0%, #6731bf 100%);
  --border-radius: 12px;
  --box-shadow: 0 10px 30px -10px rgba(30, 58, 95, 0.5);
  margin-top: 8px;
  height: 52px;
  font-weight: 600;
  font-size: 16px;
}

.login-button span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.login-button ion-icon {
  font-size: 20px;
}

.demo-credentials {
  margin-top: 12px;
  border-top: 1px solid #e5daf8;
  padding-top: 12px;
}

.demo-title {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #705e96;
  font-weight: 600;
}

.demo-line {
  margin: 2px 0;
  font-size: 12px;
  color: #705e96;
}
</style>


