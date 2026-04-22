<template>
  <ion-card>
    <ion-card-header>
      <ion-card-title>État du Backend</ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <div v-if="isLoading" class="loading-container">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Vérification de la connexion...</p>
      </div>
      <div v-else>
        <div class="status-container">
          <ion-icon
            :icon="isConnected ? wifiOutline : cloudOfflineOutline"
            :class="['status-icon', isConnected ? 'connected' : 'disconnected']"
          ></ion-icon>
          <p :class="['status-text', isConnected ? 'connected' : 'disconnected']">
            {{ isConnected ? 'Connecté' : 'Déconnecté' }}
          </p>
        </div>
        <p v-if="backendUrl" class="backend-url">
          URL: {{ backendUrl }}
        </p>
        <p v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </p>
        <ion-input
          v-model="manualBaseUrl"
          class="manual-input"
          placeholder="http://192.168.1.10:8082"
        />
        <div class="manual-actions">
          <ion-button expand="block" fill="outline" @click="applyManualConfig" :disabled="isLoading || !manualBaseUrl.trim()">
            Appliquer URL
          </ion-button>
          <ion-button expand="block" fill="clear" color="medium" @click="resetManualConfig" :disabled="isLoading">
            Auto-detection
          </ion-button>
        </div>
        <ion-button
          expand="block"
          fill="outline"
          @click="refreshConnection"
          :disabled="isLoading"
        >
          <ion-icon slot="start" :icon="refreshOutline"></ion-icon>
          Rafraîchir
        </ion-button>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon, IonSpinner, IonInput } from '@ionic/vue';
import { refreshOutline, wifiOutline, cloudOfflineOutline } from 'ionicons/icons';
import { getBackendStatus, refreshApiBaseUrl, setManualApiBaseUrl, clearManualApiBaseUrl } from '../config/api';

const backendUrl = ref<string>('');
const isConnected = ref<boolean>(false);
const isLoading = ref<boolean>(false);
const errorMessage = ref<string>('');
const manualBaseUrl = ref<string>('');
let statusCheckInterval: number | null = null;

/**
 * Vérifie l'état de la connexion au backend
 */
const checkStatus = async () => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const status = await getBackendStatus();
    backendUrl.value = status.url || '';
    isConnected.value = status.connected;

    if (!status.connected && status.error) {
      errorMessage.value = status.error;
    }
  } catch (error) {
    isConnected.value = false;
    errorMessage.value = 'Erreur lors de la vérification de la connexion';
  } finally {
    isLoading.value = false;
  }
};

/**
 * Rafraîchit la connexion au backend
 */
const refreshConnection = async () => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    await refreshApiBaseUrl();
    await checkStatus();
  } catch (error) {
    errorMessage.value = 'Erreur lors du rafraîchissement de la connexion';
    isConnected.value = false;
  } finally {
    isLoading.value = false;
  }
};

const applyManualConfig = async () => {
  const value = manualBaseUrl.value.trim();
  if (!value) return;
  setManualApiBaseUrl(value);
  await refreshConnection();
};

const resetManualConfig = async () => {
  clearManualApiBaseUrl();
  manualBaseUrl.value = '';
  await refreshConnection();
};

/**
 * Démarre la vérification automatique de l'état de la connexion
 */
const startStatusCheck = () => {
  // Vérifier l'état toutes les 30 secondes
  statusCheckInterval = window.setInterval(() => {
    checkStatus();
  }, 30000);
};

/**
 * Arrête la vérification automatique de l'état de la connexion
 */
const stopStatusCheck = () => {
  if (statusCheckInterval !== null) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
};

// Initialisation
onMounted(() => {
  try {
    manualBaseUrl.value = localStorage.getItem('mobile_api_base_url') || '';
  } catch {
    manualBaseUrl.value = '';
  }
  checkStatus();
  startStatusCheck();
});

// Nettoyage
onUnmounted(() => {
  stopStatusCheck();
});
</script>

<style scoped>
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

.backend-url {
  font-size: 0.9em;
  color: var(--ion-color-medium);
  word-break: break-all;
  margin: 10px 0;
}

.error-message {
  color: var(--ion-color-danger);
  margin: 10px 0;
}

.manual-input {
  margin: 10px 0;
}

.manual-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
</style>
