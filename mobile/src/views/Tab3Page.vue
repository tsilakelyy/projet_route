<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar class="custom-toolbar">
        <ion-title>Mes signalements</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="refreshReports" class="refresh-btn">
            <ion-icon :icon="refresh" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="signalements-page">
      <!-- Stats Header -->
      <div class="stats-header glass-card scroll-reveal">
        <div class="stat-item stagger-item">
          <span class="stat-value">{{ reports.length }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item stagger-item">
          <span class="stat-value">{{ getEnCoursCount }}</span>
          <span class="stat-label">En cours</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item stagger-item">
          <span class="stat-value">{{ getTraiteCount }}</span>
          <span class="stat-label">Traités</span>
        </div>
      </div>

      <!-- Liste des signalements -->
      <div class="reports-list scroll-reveal" v-if="reports.length > 0">
        <div v-for="report in reports" :key="report.id" class="report-card hover-lift stagger-item" @click="openReportDetail(report)">
          <div class="report-header">
            <div class="report-icon" :class="getIconClass(report.type_probleme)">
              {{ getIconEmoji(report.type_probleme) }}
            </div>
            <div class="report-info">
              <h3 class="report-title">{{ getProblemLabel(report.type_probleme) }}</h3>
              <span class="report-date">{{ formatDate(report.date_ajoute) }}</span>
            </div>
            <div class="report-status" :class="getStatusClass(report.statut)">
              {{ displayStatus(report.statut) }}
            </div>
          </div>
          
          <p class="report-description">{{ report.description || 'Aucune description' }}</p>
          
          <div class="report-details">
            <div class="detail-item">
              <span class="detail-icon">📐</span>
              <span class="detail-value">{{ report.surface }} m²</span>
            </div>
            <div class="detail-item" v-if="report.travaux">
              <span class="detail-icon">💰</span>
              <span class="detail-value">{{ report.travaux.budget?.toLocaleString() || 0 }} Ar</span>
            </div>
            <div class="detail-item" v-if="report.photos && report.photos.length > 0">
              <span class="detail-icon">🖼️</span>
              <span class="detail-value">{{ report.photos.length }} photo(s)</span>
            </div>
          </div>

          <!-- Progress bar si travaux en cours -->
          <div v-if="report.travaux" class="progress-section">
            <div class="progress-header">
              <span class="progress-label">🏗️ Travaux</span>
              <span class="progress-value">{{ report.travaux.avancement || 0 }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (report.travaux.avancement || 0) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="empty-state scroll-reveal">
        <div class="empty-icon">📭</div>
        <h3>Aucun signalement</h3>
        <p>Vous n'avez pas encore effectué de signalement.</p>
        <ion-button class="add-btn" router-link="/tabs/tab2">
          <ion-icon :icon="add" slot="start" />
          Signaler un problème
        </ion-button>
      </div>

      <ion-toast
        :is-open="showToast"
        :message="toastMessage"
        :duration="2000"
        @didDismiss="showToast = false"
        position="top"
        color="dark"
      />

      <!-- Detail Modal -->
      <ion-modal :is-open="showDetailModal" @will-dismiss="showDetailModal = false" class="custom-modal">
        <ion-header class="ion-no-border">
          <ion-toolbar class="modal-toolbar">
            <ion-title>Détails du signalement</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showDetailModal = false">
                <ion-icon :icon="close" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content" v-if="selectedReport">
          <div class="detail-container">
            <div class="detail-header">
              <div class="detail-icon-large" :class="getIconClass(selectedReport.type_probleme)">
                {{ getIconEmoji(selectedReport.type_probleme) }}
              </div>
              <h2>{{ getProblemLabel(selectedReport.type_probleme) }}</h2>
            </div>

            <div class="detail-card glass-card hover-lift">
              <div class="detail-row">
                <span class="label">Statut</span>
                <span class="value status" :class="getStatusClass(selectedReport.statut)">{{ displayStatus(selectedReport.statut) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Date</span>
                <span class="value">{{ formatDate(selectedReport.date_ajoute) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Surface</span>
                <span class="value">{{ selectedReport.surface }} m²</span>
              </div>
              <div class="detail-row">
                <span class="label">Coordonnées</span>
                <span class="value">{{ selectedReport.latitude?.toFixed(4) }}, {{ selectedReport.longitude?.toFixed(4) }}</span>
              </div>
            </div>

            <div class="description-card glass-card hover-lift" v-if="selectedReport.description">
              <h4>Description</h4>
              <p>{{ selectedReport.description }}</p>
            </div>

            <div class="description-card glass-card hover-lift" v-if="selectedReport.photos && selectedReport.photos.length > 0">
              <h4>Photos</h4>
              <div class="photo-links">
                <a v-for="(photo, index) in selectedReport.photos" :key="index" :href="photo.url" target="_blank" rel="noreferrer">
                  Voir photo {{ index + 1 }}
                </a>
              </div>
            </div>

            <div class="travaux-card glass-card hover-lift" v-if="selectedReport.travaux">
              <h4>🏗️ Informations des travaux</h4>
              <div class="detail-row">
                <span class="label">Budget</span>
                <span class="value">{{ selectedReport.travaux.budget?.toLocaleString() || 0 }} Ar</span>
              </div>
              <div class="detail-row">
                <span class="label">Avancement</span>
                <span class="value">{{ selectedReport.travaux.avancement || 0 }}%</span>
              </div>
              <div class="progress-bar large">
                <div class="progress-fill" :style="{ width: (selectedReport.travaux.avancement || 0) + '%' }"></div>
              </div>
            </div>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonToast, IonButton, IonButtons, IonIcon, IonModal } from '@ionic/vue';
import { refresh, add, close } from 'ionicons/icons';
import { apiUrl } from '@/config/api';
import { firebaseSyncService } from '@/services/firebaseSyncService';
import { parseCurrentUser } from '@/services/currentUser';
import { buildUserReports, normalizeStatus, type UserReport as Report } from '@/services/userReports';

const reports = ref<Report[]>([]);
const showToast = ref(false);
const toastMessage = ref('');
const showDetailModal = ref(false);
const selectedReport = ref<Report | null>(null);
let statusPollTimer: number | null = null;
const statusState = new Map<string, string>();
let firebaseSignalementsCache: any[] = [];
let firebaseTravauxCache: any[] = [];
let firebaseSignalementsReady = false;
let firebaseTravauxReady = false;
let unsubscribeFirebaseSignalements: (() => void) | null = null;
let unsubscribeFirebaseTravaux: (() => void) | null = null;

const displayStatus = (statut?: string) => {
  const normalized = normalizeStatus(statut);
  if (normalized === 'en cours') return 'En cours';
  if (normalized === 'termine') return 'Termine';
  return 'Nouveau';
};

const getEnCoursCount = computed(() => {
  return reports.value.filter(r => normalizeStatus(r.statut) === 'en cours').length;
});

const getTraiteCount = computed(() => {
  return reports.value.filter(r => normalizeStatus(r.statut) === 'termine' || (r.travaux && r.travaux.avancement >= 100)).length;
});

const syncStatusState = (nextState: Map<string, string>) => {
  statusState.clear();
  nextState.forEach((value, key) => {
    statusState.set(key, value);
  });
};

const applyReports = (
  signalements: any[],
  travaux: any[],
  options: { silent?: boolean } = {}
) => {
  const { reports: nextReports, statusChanged, nextStatusState } = buildUserReports({
    currentUser: parseCurrentUser(),
    signalements,
    travaux,
    previousStatusState: statusState,
    silent: options.silent,
  });

  reports.value = nextReports;
  syncStatusState(nextStatusState);
  return statusChanged;
};

const maybeApplyFirebaseReports = () => {
  if (!firebaseSignalementsReady || !firebaseTravauxReady) {
    return false;
  }

  return applyReports(firebaseSignalementsCache, firebaseTravauxCache, { silent: true });
};

const subscribeToFirebaseRealtime = () => {
  unsubscribeFirebaseSignalements?.();
  unsubscribeFirebaseTravaux?.();

  firebaseSignalementsReady = false;
  firebaseTravauxReady = false;

  unsubscribeFirebaseSignalements = firebaseSyncService.subscribeToSignalements((signalements) => {
    firebaseSignalementsCache = signalements;
    firebaseSignalementsReady = true;

    if (maybeApplyFirebaseReports()) {
      toastMessage.value = 'Statut mis a jour';
      showToast.value = true;
    }
  });

  unsubscribeFirebaseTravaux = firebaseSyncService.subscribeToTravaux((travaux) => {
    firebaseTravauxCache = travaux;
    firebaseTravauxReady = true;

    if (maybeApplyFirebaseReports()) {
      toastMessage.value = 'Statut mis a jour';
      showToast.value = true;
    }
  });
};

onMounted(() => {
  const currentUser = parseCurrentUser();
  if (!currentUser) {
    toastMessage.value = 'Veuillez vous connecter';
    showToast.value = true;
    return;
  }
  fetchReports();
  subscribeToFirebaseRealtime();
  subscribeStatusNotifications();
});

onUnmounted(() => {
  if (statusPollTimer) {
    window.clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
  unsubscribeFirebaseSignalements?.();
  unsubscribeFirebaseSignalements = null;
  unsubscribeFirebaseTravaux?.();
  unsubscribeFirebaseTravaux = null;
});

const refreshReports = () => {
  const currentUser = parseCurrentUser();
  if (!currentUser) return;
  fetchReports();
  toastMessage.value = 'Liste actualisée';
  showToast.value = true;
};

const subscribeStatusNotifications = () => {
  if (statusPollTimer) {
    window.clearInterval(statusPollTimer);
  }

  statusPollTimer = window.setInterval(async () => {
    const changed = await fetchReports(true);
    if (changed) {
      toastMessage.value = 'Statut mis a jour';
      showToast.value = true;
    }
  }, 20000);
};

const fetchReports = async (silent = false): Promise<boolean> => {
  try {
    const currentUser = parseCurrentUser();
    if (!currentUser) {
      reports.value = [];
      return false;
    }

    let signalements: any[] = [];
    let travaux: any[] = [];
    let usedFirebaseFallback = false;

    try {
      const [sigRes, travRes] = await Promise.all([fetch(apiUrl('/api/signalements')), fetch(apiUrl('/api/travaux'))]);
      if (!sigRes.ok || !travRes.ok) {
        throw new Error('Echec chargement signalements/travaux');
      }
      signalements = await sigRes.json();
      travaux = await travRes.json();
    } catch {
      usedFirebaseFallback = true;
      [signalements, travaux] = await Promise.all([
        firebaseSyncService.getSignalements(),
        firebaseSyncService.getTravaux(),
      ]);
    }

    firebaseSignalementsCache = signalements;
    firebaseTravauxCache = travaux;
    firebaseSignalementsReady = true;
    firebaseTravauxReady = true;

    const statusChanged = applyReports(signalements, travaux, { silent });
    if (!silent && usedFirebaseFallback) {
      toastMessage.value = 'Donnees chargees depuis Firebase avec succes';
      showToast.value = true;
    }
    return statusChanged;
  } catch (error: any) {
    console.error('Erreur:', error);
    if (!silent) {
      toastMessage.value = `Erreur: ${error.message}`;
      showToast.value = true;
    }
    return false;
  }
};

const formatDate = (timestamp: string) => {
  if (timestamp) {
    return new Date(timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return 'Date inconnue';
};

const getProblemLabel = (type?: string) => {
  const labels: { [key: string]: string } = {
    'nid-de-poule': 'Nid de poule',
    'route-inondee': 'Route inondée',
    'route-endommagee': 'Route endommagée',
    'signalisation-manquante': 'Signalisation manquante',
    'eclairage-defectueux': 'Éclairage défectueux',
    'autre': 'Autre problème',
  };
  return labels[type || ''] || 'Problème routier';
};

const getIconEmoji = (type?: string) => {
  const icons: { [key: string]: string } = {
    'nid-de-poule': '🕳️',
    'route-inondee': '🌊',
    'route-endommagee': '⚠️',
    'signalisation-manquante': '🚧',
    'eclairage-defectueux': '💡',
    'autre': '📍',
  };
  return icons[type || ''] || '📍';
};

const getIconClass = (type?: string) => {
  const classes: { [key: string]: string } = {
    'nid-de-poule': 'red',
    'route-inondee': 'blue',
    'route-endommagee': 'orange',
    'signalisation-manquante': 'yellow',
    'eclairage-defectueux': 'purple',
    'autre': 'gray',
  };
  return classes[type || ''] || 'gray';
};

const getStatusClass = (statut?: string) => {
  const normalized = normalizeStatus(statut);
  if (normalized === 'nouveau') return 'pending';
  if (normalized === 'termine') return 'completed';
  return 'in-progress';
};

const openReportDetail = (report: Report) => {
  selectedReport.value = report;
  showDetailModal.value = true;
};
</script>

<style scoped>
.signalements-page {
  --background: #f6f2ff;
}

.custom-toolbar {
  --background: linear-gradient(135deg, #21103f, #7e3ffc);
  --color: white;
  --border-width: 0;
}

.custom-toolbar ion-title {
  font-weight: 600;
}

.refresh-btn {
  --color: white;
}

.stats-header {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 20px;
  background: white;
  margin: 16px;
  border-radius: 16px;
  border: 1px solid #dbcdf2;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #21103f;
}

.stat-label {
  font-size: 12px;
  color: #705e96;
  margin-top: 4px;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: #dbcdf2;
}

.reports-list {
  padding: 0 16px 100px;
}

.report-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid #dbcdf2;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.report-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.report-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.report-icon.red { background: rgba(239, 68, 68, 0.15); }
.report-icon.blue { background: rgba(126, 63, 252, 0.2); }
.report-icon.orange { background: rgba(249, 115, 22, 0.15); }
.report-icon.yellow { background: rgba(234, 179, 8, 0.15); }
.report-icon.purple { background: rgba(139, 92, 246, 0.15); }
.report-icon.gray { background: rgba(107, 114, 128, 0.15); }

.report-info {
  flex: 1;
}

.report-title {
  font-size: 15px;
  font-weight: 600;
  color: #21103f;
  margin: 0;
}

.report-date {
  font-size: 12px;
  color: #927ab8;
}

.report-status {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
}

.report-status.pending {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.report-status.in-progress {
  background: rgba(126, 63, 252, 0.2);
  color: #47208c;
}

.report-status.completed {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

.report-description {
  font-size: 13px;
  color: #705e96;
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.report-details {
  display: flex;
  gap: 16px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}

.detail-icon {
  font-size: 14px;
}

.progress-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #dbcdf2;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 12px;
  color: #705e96;
}

.progress-value {
  font-size: 13px;
  font-weight: 600;
  color: #6731bf;
}

.progress-bar {
  height: 6px;
  background: #dbcdf2;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar.large {
  height: 8px;
  margin-top: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #21103f, #6731bf);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 600;
  color: #21103f;
  margin: 0 0 8px 0;
}

.empty-state p {
  font-size: 14px;
  color: #705e96;
  margin: 0 0 24px 0;
}

.add-btn {
  --background: linear-gradient(135deg, #21103f, #6731bf);
  --border-radius: 12px;
  --box-shadow: 0 10px 30px -10px rgba(30, 58, 95, 0.5);
}

/* Modal styles */
.custom-modal {
  --background: transparent;
}

.custom-modal::part(content) {
  background: white;
  border-radius: 20px 20px 0 0;
  border-top: 1px solid #dbcdf2;
}

.modal-toolbar {
  --background: linear-gradient(135deg, #21103f, #6731bf);
  --color: white;
  --border-width: 0;
}

.modal-content {
  --background: white;
}

.detail-container {
  padding: 20px;
}

.detail-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
}

.detail-icon-large {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 12px;
}

.detail-header h2 {
  color: #21103f;
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.detail-card,
.description-card,
.travaux-card {
  background: #f6f2ff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #dbcdf2;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #dbcdf2;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .label {
  font-size: 13px;
  color: #705e96;
}

.detail-row .value {
  font-size: 14px;
  color: #21103f;
  font-weight: 500;
}

.detail-row .value.status {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
}

.description-card h4,
.travaux-card h4 {
  color: #21103f;
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
}

.description-card p {
  color: #705e96;
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

.photo-links {
  display: grid;
  gap: 8px;
}

.photo-links a {
  color: #7e3ffc;
  font-size: 13px;
  text-decoration: underline;
}
</style>




