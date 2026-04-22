<template>
  <ion-card>
    <ion-card-header>
      <ion-card-title>Synchronisation Firebase</ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <div v-if="isLoading" class="loading-container">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Synchronisation en cours...</p>
      </div>
      <div v-else>
        <div class="status-container">
          <ion-icon
            :icon="syncIcon"
            :class="['status-icon', syncStatusClass]"
          ></ion-icon>
          <p :class="['status-text', syncStatusClass]">
            {{ syncMessage }}
          </p>
        </div>

        <div v-if="lastSyncTime" class="last-sync">
          <p>DerniÃ¨re synchronisation: {{ formatLastSyncTime }}</p>
        </div>

        <div v-if="webModuleActive" class="web-module-status">
          <ion-icon :icon="wifiOutline" class="status-icon connected"></ion-icon>
          <p class="status-text connected">Module web actif</p>
        </div>
        <div v-else class="web-module-status">
          <ion-icon :icon="cloudOfflineOutline" class="status-icon disconnected"></ion-icon>
          <p class="status-text disconnected">Module web inactif</p>
        </div>

        <ion-button
          expand="block"
          fill="outline"
          @click="handleSync"
          :disabled="isLoading"
        >
          <ion-icon slot="start" :icon="syncOutline"></ion-icon>
          {{ isLoading ? 'Synchronisation...' : 'Synchroniser' }}
        </ion-button>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon, IonSpinner } from '@ionic/vue';
import { syncOutline, wifiOutline, cloudOfflineOutline, checkmarkCircle, alertCircle } from 'ionicons/icons';
import { firebaseSyncService } from '../services/firebaseSyncService';
import { isFirebaseInitialized } from '../firebase';
import { httpRequest } from '../services/httpClient';
import { apiUrlAsync } from '../config/api';

interface SyncStatus {
  success: boolean;
  message: string;
  timestamp: number;
}

const isLoading = ref(false);
const syncStatus = ref<SyncStatus | null>(null);
const webModuleActive = ref(false);
const lastSyncTime = ref<number | null>(null);
let statusCheckInterval: number | null = null;

// Calculer le message de synchronisation
const syncMessage = computed(() => {
  if (syncStatus.value) {
    return syncStatus.value.message;
  }
  return 'Aucune synchronisation';
});

// Calculer la classe de statut de synchronisation
const syncStatusClass = computed(() => {
  if (!syncStatus.value) {
    return '';
  }
  return syncStatus.value.success ? 'connected' : 'disconnected';
});

// Calculer l'icÃ´ne de synchronisation
const syncIcon = computed(() => {
  if (!syncStatus.value) {
    return syncOutline;
  }
  return syncStatus.value.success ? checkmarkCircle : alertCircle;
});

// Formater le temps de la derniÃ¨re synchronisation
const formatLastSyncTime = computed(() => {
  if (!lastSyncTime.value) {
    return 'Jamais';
  }

  const now = Date.now();
  const diff = now - lastSyncTime.value;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Ã€ l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  return `Il y a ${days} j`;
});

/**
 * GÃ¨re la synchronisation
 */
const handleSync = async () => {
  isLoading.value = true;
  try {
    // VÃ©rifier si Firebase est correctement initialisÃ©
    if (!isFirebaseInitialized()) {
      throw new Error('Firebase n\'est pas correctement initialisÃ©. VÃ©rifiez votre configuration.');
    }

    // Synchroniser les donnÃ©es avec Firebase
    const result = await firebaseSyncService.syncAll();

    syncStatus.value = {
      success: result.success,
      message: result.message,
      timestamp: Date.now(),
    };

    if (result.success) {
      lastSyncTime.value = Date.now();
      // VÃ©rifier si le module web est actif aprÃ¨s la synchronisation
      await checkWebModule();
    }
  } catch (error) {
    syncStatus.value = {
      success: false,
      message: `Erreur de synchronisation: ${error}`,
      timestamp: Date.now(),
    };
  } finally {
    isLoading.value = false;
  }
};

/**
 * RÃ©cupÃ¨re les informations sur les autres clients connectÃ©s
 */
const fetchOtherClients = async () => {
  try {
    const url = await apiUrlAsync('/api/presence/heartbeat');
    const response = await httpRequest({
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        clientType: 'mobile',
        clientId: localStorage.getItem('mobileClientId') || `mobile-${Date.now()}`,
        timestamp: Date.now(),
      }),
    });
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

    if (data.otherClients) {
      console.log('Autres clients connectÃ©s:', data.otherClients);
    }
  } catch (error) {
    console.error('Erreur rÃ©cupÃ©ration autres clients:', error);
  }
};

/**
 * VÃ©rifie si le module web est actif
 */
const checkWebModule = async () => {
  try {
    // VÃ©rifier si Firebase est correctement initialisÃ©
    if (!isFirebaseInitialized()) {
      webModuleActive.value = false;
      return;
    }

    // VÃ©rifier si le module web est actif en essayant de rÃ©cupÃ©rer des donnÃ©es depuis Firebase
    const utilisateurs = await firebaseSyncService.getUtilisateurs();
    webModuleActive.value = utilisateurs.length > 0;

    // RÃ©cupÃ©rer les autres clients connectÃ©s
    if (webModuleActive.value) {
      await fetchOtherClients();
    }
  } catch (error) {
    console.error('Erreur vÃ©rification module web:', error);
    webModuleActive.value = false;
  }
};

// Initialisation
onMounted(() => {
  // VÃ©rifier si le module web est actif
  checkWebModule();
  statusCheckInterval = window.setInterval(checkWebModule, 30000);

  // Charger le temps de la derniÃ¨re synchronisation
  lastSyncTime.value = syncStatus.value?.timestamp || null;
});

// Nettoyage
onUnmounted(() => {
  if (statusCheckInterval !== null) {
    clearInterval(statusCheckInterval);
  }
});
</script>

<style scoped>
.loading-container {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid var(--ion-color-light);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.status-container {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.status-icon {
  font-size: 24px;
}

.status-icon.connected {
  color: var(--ion-color-success);
}

.status-icon.disconnected {
  color: var(--ion-color-danger);
}

.status-text {
  margin: 0;
  font-weight: bold;
}

.status-text.connected {
  color: var(--ion-color-success);
}

.status-text.disconnected {
  color: var(--ion-color-danger);
}

.last-sync {
  font-size: 0.9em;
  color: var(--ion-color-medium);
  margin: 10px 0;
}

.web-module-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
  padding: 10px;
  background-color: var(--ion-color-light);
  border-radius: 8px;
}
</style>


