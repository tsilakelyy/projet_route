<template>
  <ion-page>
    <ion-tabs :key="authKey">
      <ion-router-outlet></ion-router-outlet>

      <!-- Navigation iOS 18 style - Floating centered tab bar -->
      <div class="floating-tab-bar float-element" v-if="isAuthenticated">
        <div class="tab-bar-container glass-card">
          <router-link to="/tabs/tab2" custom v-slot="{ navigate, isActive }">
            <button class="tab-button hover-lift" :class="{ active: isActive }" @click="navigate">
              <ion-icon :icon="mapOutline" class="tab-icon" />
              <span class="tab-label">Carte</span>
            </button>
          </router-link>

          <router-link to="/tabs/tab3" custom v-slot="{ navigate, isActive }">
            <button class="tab-button hover-lift" :class="{ active: isActive }" @click="navigate">
              <ion-icon :icon="listOutline" class="tab-icon" />
              <span class="tab-label">Signalements</span>
            </button>
          </router-link>

          <button class="tab-button logout-btn hover-lift" @click="logout">
            <ion-icon :icon="logOutOutline" class="tab-icon" />
            <span class="tab-label">Sortir</span>
          </button>
        </div>
      </div>

      <!-- Login tab bar for non-authenticated users -->
      <ion-tab-bar slot="bottom" class="login-tab-bar" v-if="!isAuthenticated">
        <ion-tab-button tab="tab1" href="/tabs/tab1">
          <ion-icon aria-hidden="true" :icon="personCircleOutline" />
          <ion-label>Connexion</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>

    <ion-toast
      :is-open="showToast"
      :message="toastMessage"
      :duration="2500"
      position="top"
      color="dark"
      @didDismiss="showToast = false"
    />
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonLabel,
  IonIcon,
  IonPage,
  IonRouterOutlet,
  IonToast,
} from '@ionic/vue';
import { personCircleOutline, mapOutline, listOutline, logOutOutline } from 'ionicons/icons';
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { apiUrl } from '@/config/api';
import { getPresenceClientId, getPreferredSignalementOwnerId, parseCurrentUser } from '@/services/currentUser';

const isAuthenticated = ref(false);
const router = useRouter();
const authKey = ref(0);
const showToast = ref(false);
const toastMessage = ref('');
let statusTimer: number | null = null;
let lastStatusCheckIso = '';
let mobileHeartbeatTimer: number | null = null;
let pendingSyncTimer: number | null = null;
const seenStatusUpdates = new Set<string>();

const toBackendSince = (value: string) => {
  if (!value) {
    return '';
  }
  // Backend compares LocalDateTime, so send "yyyy-MM-ddTHH:mm:ss" (without timezone suffix).
  return value.replace(/\.\d+Z$/, '').replace('Z', '');
};

onMounted(() => {
  const user = localStorage.getItem('currentUser');
  isAuthenticated.value = !!user;
  heartbeatMobilePresence().catch(() => {
    // no-op
  });

  mobileHeartbeatTimer = window.setInterval(() => {
    heartbeatMobilePresence().catch(() => {
      // no-op
    });
  }, 15000);

  checkPendingSyncRequests().catch(() => {
    // no-op
  });

  pendingSyncTimer = window.setInterval(() => {
    checkPendingSyncRequests().catch(() => {
      // no-op
    });
  }, 12000);

  if (isAuthenticated.value) {
    startStatusNotifications();
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'currentUser') {
      isAuthenticated.value = !!e.newValue;
      if (isAuthenticated.value) {
        startStatusNotifications();
      } else {
        stopStatusNotifications();
      }
    }
  });

  window.addEventListener('userLoggedIn', () => {
    isAuthenticated.value = true;
    authKey.value++;
    startStatusNotifications();
  });
});

onUnmounted(() => {
  stopStatusNotifications();
  if (mobileHeartbeatTimer) {
    window.clearInterval(mobileHeartbeatTimer);
    mobileHeartbeatTimer = null;
  }
  if (pendingSyncTimer) {
    window.clearInterval(pendingSyncTimer);
    pendingSyncTimer = null;
  }
});

const logout = async () => {
  try {
    localStorage.removeItem('currentUser');
    isAuthenticated.value = false;
    authKey.value++;
    stopStatusNotifications();
    router.push('/tabs/tab1');
  } catch (error) {
    console.error('Erreur lors de la deconnexion:', error);
  }
};

const stopStatusNotifications = () => {
  if (statusTimer) {
    window.clearInterval(statusTimer);
    statusTimer = null;
  }
};

const heartbeatMobilePresence = async () => {
  const currentUser = parseCurrentUser();
  const clientId = getPresenceClientId(currentUser, 'mobile-tabs');

  await fetch(apiUrl('/api/presence/heartbeat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientType: 'mobile', clientId }),
  });
};

const bootstrapMobileUsers = async () => {
  await fetch(apiUrl('/api/auth/mobile-bootstrap'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
};

const ackPeerSync = async (requestId: number) => {
  await fetch(apiUrl('/api/presence/ack-sync'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: 'mobile', requestId }),
  });
};

const checkPendingSyncRequests = async () => {
  const response = await fetch(apiUrl('/api/presence/pending-sync?target=mobile'));
  if (!response.ok) return;

  const pending = await response.json().catch(() => ({}));
  if (!pending?.hasPending) return;

  await bootstrapMobileUsers();
  if (pending.requestId) {
    await ackPeerSync(Number(pending.requestId));
  }

  toastMessage.value = 'Sync web detectee: comptes mobile actualises';
  showToast.value = true;
};

const checkStatusChanges = async (silent = false) => {
  try {
    const currentUser = parseCurrentUser();
    const userId = getPreferredSignalementOwnerId(currentUser);
    if (!userId) {
      return;
    }

    const rawSince = lastStatusCheckIso || new Date(Date.now() - 60000).toISOString();
    const since = encodeURIComponent(toBackendSince(rawSince));
    const response = await fetch(apiUrl(`/api/signalements/notifications/${userId}?since=${since}`));
    if (!response.ok) {
      return;
    }

    const updates = await response.json();
    const freshUpdates = Array.isArray(updates)
      ? updates.filter((update: any) => {
          const key = `${update?.idSignalement ?? 'unknown'}:${update?.dateStatutMaj ?? ''}`;
          if (seenStatusUpdates.has(key)) {
            return false;
          }
          seenStatusUpdates.add(key);
          return true;
        })
      : [];

    if (!silent && freshUpdates.length > 0) {
      toastMessage.value = `${freshUpdates.length} mise(s) a jour de statut recue(s)`;
      showToast.value = true;
    }

    lastStatusCheckIso = toBackendSince(new Date().toISOString());
  } catch {
    // no-op
  }
};

const startStatusNotifications = () => {
  stopStatusNotifications();
  seenStatusUpdates.clear();
  lastStatusCheckIso = toBackendSince(new Date(Date.now() - 60000).toISOString());
  checkStatusChanges(true);
  statusTimer = window.setInterval(() => {
    checkStatusChanges();
  }, 20000);
};
</script>

<style scoped>
/* iOS 18 Floating Tab Bar */
.floating-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 16px 16px 34px;
  z-index: 1000;
  pointer-events: none;
}

.tab-bar-container {
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(145deg, rgba(42, 18, 80, 0.72), rgba(60, 25, 105, 0.54));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 6px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(205, 173, 255, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  pointer-events: auto;
}

.tab-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 20px;
  background: transparent;
  border: none;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 70px;
}

.tab-button:active {
  transform: scale(0.95);
}

.tab-button .tab-icon {
  font-size: 22px;
  color: #d8c5fb;
  transition: all 0.3s ease;
}

.tab-button .tab-label {
  font-size: 11px;
  font-weight: 500;
  color: #d8c5fb;
  transition: all 0.3s ease;
}

.tab-button.active {
  background: linear-gradient(135deg, rgba(122, 69, 221, 0.24), rgba(177, 130, 255, 0.2));
  box-shadow:
    0 4px 12px rgba(122, 69, 221, 0.26),
    inset 0 0 0 1px rgba(177, 130, 255, 0.38);
}

.tab-button.active .tab-icon {
  color: #fff;
}

.tab-button.active .tab-label {
  color: #fff;
}

.tab-button.logout-btn:active {
  background: rgba(239, 68, 68, 0.2);
}

.tab-button.logout-btn:active .tab-icon,
.tab-button.logout-btn:active .tab-label {
  color: #ef4444;
}

/* Login Tab Bar (non-authenticated) */
.login-tab-bar {
  --background: linear-gradient(135deg, rgba(42, 18, 80, 0.96), rgba(20, 7, 40, 0.96));
  --border: none;
  padding-bottom: 20px;
}

.login-tab-bar ion-tab-button {
  --color: #d8c5fb;
  --color-selected: #ffffff;
}
</style>
