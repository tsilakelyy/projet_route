<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar class="custom-toolbar">
        <ion-title>Carte</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="toggleMineFilter" class="filter-btn">
            <ion-icon :icon="funnel" slot="start" />
            {{ showOnlyMine ? "Tous" : "Mes points" }}
          </ion-button>
          <ion-button @click="syncLocalToFirestore" class="sync-btn">
            <ion-icon :icon="cloudUpload" slot="start" />
            Sync
          </ion-button>
          <ion-button @click="openRecapModal" class="recap-btn">
            <ion-icon :icon="statsChart" slot="start" />
            Stats
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="map-page">
      <div id="map" class="scroll-reveal"></div>
      <div class="insight-fab-group float-element scroll-reveal">
        <ion-button size="small" class="insight-fab" @click="openCriticalityModal">Criticite</ion-button>
        <ion-button size="small" class="insight-fab" @click="openAuditModal">Audit</ion-button>
        <ion-button size="small" class="insight-fab" @click="openImpactModal">Impact</ion-button>
      </div>

      <!-- Modal pour le formulaire de signalement -->
      <ion-modal :is-open="showModal" @will-dismiss="closeModal" class="custom-modal">
        <ion-header class="ion-no-border">
          <ion-toolbar class="modal-toolbar">
            <ion-title>Nouveau Signalement</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeModal">
                <ion-icon :icon="close" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="form-container scroll-reveal">
            <div class="form-group">
              <label>Type de probleme</label>
              <ion-select v-model="typeProbleme" placeholder="Selectionnez le type" interface="action-sheet" class="custom-select">
                <ion-select-option value="nid-de-poule">Nid de poule</ion-select-option>
                <ion-select-option value="route-inondee">Route inondee</ion-select-option>
                <ion-select-option value="route-endommagee">Route endommagee</ion-select-option>
                <ion-select-option value="signalisation-manquante">Signalisation manquante</ion-select-option>
                <ion-select-option value="eclairage-defectueux">Eclairage defectueux</ion-select-option>
                <ion-select-option value="autre">Autre</ion-select-option>
              </ion-select>
            </div>
            <div class="form-group">
              <label>Surface (m2)</label>
              <ion-input v-model="surface" type="number" placeholder="Entrez la surface estimee" class="custom-input" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <ion-textarea v-model="description" placeholder="Decrivez le probleme" :rows="3" class="custom-textarea" />
            </div>
            <div class="form-group">
              <label>Photos</label>
              <div class="photo-buttons">
                <ion-button expand="block" fill="outline" @click="takePhoto" class="take-photo-btn">
                  <ion-icon :icon="camera" slot="start" />
                  Prendre une photo
                </ion-button>
                <ion-button expand="block" fill="outline" @click="pickFromGallery" class="gallery-photo-btn">
                  <ion-icon :icon="images" slot="start" />
                  Galerie
                </ion-button>
              </div>
              <div v-if="photos.length > 0" class="photo-preview-grid">
                <div v-for="(photo, index) in photos" :key="index" class="photo-preview-item">
                  <img :src="photo.url" :alt="`Photo ${index + 1}`" />
                  <button type="button" class="photo-remove" @click="removePhoto(index)">x</button>
                </div>
              </div>
            </div>
            <ion-button expand="block" @click="submitReport" class="submit-btn">
              <ion-icon :icon="send" slot="start" />
              Envoyer le signalement
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Modal pour le recapitulatif -->
      <ion-modal :is-open="showRecapModal" @will-dismiss="showRecapModal = false" class="custom-modal recap-modal">
        <ion-header class="ion-no-border">
          <ion-toolbar class="modal-toolbar">
            <ion-title>Recapitulatif</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showRecapModal = false">
                <ion-icon :icon="close" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="recap-container scroll-reveal">
            <div class="recap-card purple glass-card hover-lift stagger-item">
              <div class="recap-icon">Points</div>
              <div class="recap-info">
                <span class="recap-label">Points signales</span>
                <span class="recap-value">{{ recapData.count }}</span>
              </div>
            </div>
            <div class="recap-card green glass-card hover-lift stagger-item">
              <div class="recap-icon">Surf</div>
              <div class="recap-info">
                <span class="recap-label">Surface totale</span>
                <span class="recap-value">{{ recapData.totalSurface }} m2</span>
              </div>
            </div>
            <div class="recap-card yellow glass-card hover-lift stagger-item">
              <div class="recap-icon">Av</div>
              <div class="recap-info">
                <span class="recap-label">Avancement moyen</span>
                <span class="recap-value">{{ recapData.averageAvancement }}%</span>
              </div>
            </div>
            <div class="recap-card red glass-card hover-lift stagger-item">
              <div class="recap-icon">Ar</div>
              <div class="recap-info">
                <span class="recap-label">Budget total</span>
                <span class="recap-value">{{ recapData.totalBudget.toLocaleString() }} Ar</span>
              </div>
            </div>
            <ion-button expand="block" @click="loadRecapData" class="refresh-btn">
              <ion-icon :icon="refresh" slot="start" />
              Actualiser
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>

      <ion-modal :is-open="showCriticalityModal" @will-dismiss="showCriticalityModal = false" class="custom-modal recap-modal">
        <ion-header class="ion-no-border">
          <ion-toolbar class="modal-toolbar">
            <ion-title>Priorites criticite</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showCriticalityModal = false"><ion-icon :icon="close" /></ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="recap-container scroll-reveal">
            <div class="recap-card glass-card hover-lift stagger-item" v-for="row in criticalityRows" :key="row.idSignalement">
              <div class="recap-icon">{{ row.priorityLabel?.slice(0, 1) || 'P' }}</div>
              <div class="recap-info">
                <span class="recap-label">#{{ row.idSignalement }} - {{ row.typeProbleme || 'autre' }}</span>
                <span class="recap-value">{{ row.score }} / 100</span>
                <span class="recap-label">{{ row.lieu || 'Non renseigne' }}</span>
              </div>
            </div>
          </div>
        </ion-content>
      </ion-modal>

      <ion-modal :is-open="showAuditModal" @will-dismiss="showAuditModal = false" class="custom-modal recap-modal">
        <ion-header class="ion-no-border">
          <ion-toolbar class="modal-toolbar">
            <ion-title>Journal d'audit</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showAuditModal = false"><ion-icon :icon="close" /></ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="recap-container scroll-reveal">
            <div class="recap-card glass-card hover-lift stagger-item" v-for="log in auditRows" :key="log.id">
              <div class="recap-icon">{{ log.action?.slice(0, 1) || 'A' }}</div>
              <div class="recap-info">
                <span class="recap-label">{{ formatDateTime(log.createdAt) }}</span>
                <span class="recap-value">{{ log.action }}</span>
                <span class="recap-label">{{ log.details || '-' }}</span>
              </div>
            </div>
          </div>
        </ion-content>
      </ion-modal>

      <ion-modal :is-open="showImpactModal" @will-dismiss="showImpactModal = false" class="custom-modal recap-modal">
        <ion-header class="ion-no-border">
          <ion-toolbar class="modal-toolbar">
            <ion-title>Impact global</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showImpactModal = false"><ion-icon :icon="close" /></ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div class="recap-container scroll-reveal">
            <div class="recap-card glass-card hover-lift stagger-item"><div class="recap-info"><span class="recap-label">Signalements total</span><span class="recap-value">{{ impactData.totalSignalements }}</span></div></div>
            <div class="recap-card glass-card hover-lift stagger-item"><div class="recap-info"><span class="recap-label">Ouverts / clotures</span><span class="recap-value">{{ impactData.openSignalements }} / {{ impactData.closedSignalements }}</span></div></div>
            <div class="recap-card glass-card hover-lift stagger-item"><div class="recap-info"><span class="recap-label">Budget engage</span><span class="recap-value">{{ Number(impactData.engagedBudget || 0).toLocaleString() }} Ar</span></div></div>
            <div class="recap-card glass-card hover-lift stagger-item"><div class="recap-info"><span class="recap-label">Delai moyen resolution</span><span class="recap-value">{{ impactData.averageResolutionDays }} j</span></div></div>
            <div class="recap-card glass-card hover-lift stagger-item"><div class="recap-info"><span class="recap-label">Comptes bloques</span><span class="recap-value">{{ blockedUsers.length }}</span></div></div>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>

    <ion-toast
      :is-open="showToast"
      :message="toastMessage"
      :duration="2000"
      @didDismiss="showToast = false"
      position="top"
      color="dark"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonModal, IonButtons, IonButton, IonInput, IonTextarea, IonToast, IonSelect, IonSelectOption, IonIcon, onIonViewDidEnter } from '@ionic/vue';
import { close, send, statsChart, refresh, cloudUpload, funnel, camera, images } from 'ionicons/icons';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.vectorgrid';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { apiUrl, TILE_URL, VECTOR_TILE_URL, ENABLE_VECTOR_TILE_LAYER } from '@/config/api';
import { getPreferredSignalementOwnerId, getPresenceClientId, matchesCurrentUser, parseCurrentUser } from '@/services/currentUser';
import { firebaseSyncService } from '@/services/firebaseSyncService';
import { firebaseNotificationService } from '@/services/firebaseNotificationService';

const hiddenStyle = {
  weight: 0,
  opacity: 0,
  fillOpacity: 0,
};

const roadColor = (klass?: string) => {
  switch (klass) {
    case 'motorway':
      return '#c7725f';
    case 'trunk':
      return '#cf8168';
    case 'primary':
      return '#d39b68';
    case 'secondary':
      return '#d5b080';
    case 'tertiary':
      return '#c9bb95';
    case 'minor':
      return '#b9a88a';
    default:
      return '#8f816d';
  }
};

const roadWeight = (zoom = 12) => {
  if (zoom <= 6) return 0.45;
  if (zoom <= 10) return 1.3;
  if (zoom <= 12) return 2.2;
  if (zoom <= 14) return 3.4;
  if (zoom <= 16) return 4.8;
  return 6.2;
};

const vectorTileLayerStyles: Record<string, any> = {
  water: () => ({
    fill: true,
    fillColor: '#9ecae8',
    fillOpacity: 1,
    color: '#9ecae8',
    weight: 0.2,
    opacity: 1,
  }),
  waterway: (_: unknown, zoom: number) => ({
    color: '#67a8cd',
    weight: zoom >= 14 ? 2.3 : zoom >= 12 ? 1.2 : 0.6,
    opacity: 1,
  }),
  landcover: () => ({
    fill: true,
    fillColor: '#d8e5c4',
    fillOpacity: 0.9,
    color: '#d8e5c4',
    weight: 0.2,
    opacity: 1,
  }),
  landuse: () => ({
    fill: true,
    fillColor: '#cfdeba',
    fillOpacity: 0.72,
    color: '#cfdeba',
    weight: 0.2,
    opacity: 1,
  }),
  park: () => ({
    fill: true,
    fillColor: '#bbdca7',
    fillOpacity: 0.78,
    color: '#bbdca7',
    weight: 0.2,
    opacity: 1,
  }),
  boundary: () => ({
    color: '#85837d',
    weight: 0.9,
    opacity: 0.6,
    dashArray: '3,2',
  }),
  aeroway: () => ({
    color: '#a3a09a',
    weight: 1.1,
    opacity: 0.78,
  }),
  transportation: (properties: any, zoom: number) => ({
    color: roadColor(properties?.class),
    weight: roadWeight(zoom),
    opacity: 0.96,
  }),
  building: (_: unknown, zoom: number) =>
    zoom >= 12.5
      ? {
          fill: true,
          fillColor: '#dcccb7',
          fillOpacity: 0.7,
          color: '#c4b299',
          weight: 0.35,
          opacity: 0.82,
        }
      : hiddenStyle,
  water_name: () => hiddenStyle,
  transportation_name: () => hiddenStyle,
  place: () => hiddenStyle,
  poi: () => hiddenStyle,
  housenumber: () => hiddenStyle,
};

let baseLayer: L.Layer | null = null;

const addRasterBaseLayer = (mapInstance: L.Map) =>
  L.tileLayer(TILE_URL, {
    attribution: 'OpenStreetMap',
    maxZoom: 20,
    minZoom: 3,
    crossOrigin: true,
  }).addTo(mapInstance);

const addBaseLayer = (mapInstance: L.Map) => {
  if (baseLayer && mapInstance.hasLayer(baseLayer)) {
    mapInstance.removeLayer(baseLayer);
  }

  const vectorGridFactory = (L as any)?.vectorGrid?.protobuf;

  if (ENABLE_VECTOR_TILE_LAYER && VECTOR_TILE_URL && typeof vectorGridFactory === 'function') {
    const vectorLayer = vectorGridFactory(VECTOR_TILE_URL, {
      vectorTileLayerStyles,
      interactive: false,
      minZoom: 0,
      maxNativeZoom: 14,
      maxZoom: 22,
      attribution:
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    });

    const fallbackToRaster = (reason: string) => {
      console.warn(`Vector tiles indisponibles (${reason}), bascule vers les tuiles raster.`);
      if (mapInstance.hasLayer(vectorLayer)) {
        mapInstance.removeLayer(vectorLayer);
      }
      baseLayer = addRasterBaseLayer(mapInstance);
    };

    if (typeof vectorLayer.on === 'function') {
      vectorLayer.on('tileerror', () => fallbackToRaster('tileerror'));
      vectorLayer.on('error', () => fallbackToRaster('error'));
    }

    baseLayer = vectorLayer;
    vectorLayer.addTo(mapInstance);
    return;
  }

  baseLayer = addRasterBaseLayer(mapInstance);
};

// Custom icons for different problem types
const createCustomIcon = (color: string, emoji: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      width: 36px;
      height: 36px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid white;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    ">
      <span style="transform: rotate(45deg); font-size: 16px;">${emoji}</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

const problemIcons: { [key: string]: L.DivIcon } = {
  'nid-de-poule': createCustomIcon('#ef4444', 'NP'),
  'route-inondee': createCustomIcon('#6731bf', 'IN'),
  'route-endommagee': createCustomIcon('#f97316', 'RD'),
  'signalisation-manquante': createCustomIcon('#eab308', 'SM'),
  'eclairage-defectueux': createCustomIcon('#8b5cf6', 'ED'),
  'autre': createCustomIcon('#6b7280', 'A'),
  'default': createCustomIcon('#10b981', 'R'),
};

const getIconForProblem = (type?: string) => {
  if (!type) return problemIcons['default'];
  return problemIcons[type] || problemIcons['default'];
};

const getProblemLabel = (type?: string) => {
  const labels: { [key: string]: string } = {
    'nid-de-poule': 'Nid de poule',
    'route-inondee': 'Route inondee',
    'route-endommagee': 'Route endommagee',
    'signalisation-manquante': 'Signalisation manquante',
    'eclairage-defectueux': 'Eclairage defectueux',
    'autre': 'Autre',
  };
  return labels[type || ''] || 'Probleme routier';
};

let map: L.Map | null = null;
let marker: L.Marker | null = null;
let presenceHeartbeatTimer: number | null = null;
let pendingSyncTimer: number | null = null;
let reportsRefreshTimer: number | null = null;
type PhotoEntry = {
  url: string;
  addedBy?: string;
  addedAt?: string;
};
const showModal = ref(false);
const description = ref('');
const surface = ref('');
const typeProbleme = ref('');
const photos = ref<PhotoEntry[]>([]);
const showToast = ref(false);
const toastMessage = ref('');
const currentLatLng = ref<L.LatLng | null>(null);
const allMarkers = ref<any[]>([]);
const showRecapModal = ref(false);
const recapData = ref({ count: 0, totalSurface: 0, averageAvancement: 0, totalBudget: 0 });
const showOnlyMine = ref(false);
const showCriticalityModal = ref(false);
const showAuditModal = ref(false);
const showImpactModal = ref(false);
const criticalityRows = ref<any[]>([]);
const auditRows = ref<any[]>([]);
const impactData = ref({
  totalSignalements: 0,
  openSignalements: 0,
  closedSignalements: 0,
  engagedBudget: 0,
  averageResolutionDays: 0,
});
const blockedUsers = ref<any[]>([]);

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const parsePhotos = (value: unknown): PhotoEntry[] => {
  if (Array.isArray(value)) {
    return value
      .map((item: any) => {
        if (typeof item === 'string') {
          const url = item.trim();
          return url ? { url, addedBy: 'legacy' } : null;
        }
        const url = String(item?.url || '').trim();
        if (!url) return null;
        return {
          url,
          addedBy: String(item?.addedBy || 'unknown'),
          addedAt: item?.addedAt ? String(item.addedAt) : undefined,
        } as PhotoEntry;
      })
      .filter((photo): photo is PhotoEntry => photo !== null);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return parsePhotos(JSON.parse(trimmed));
      } catch (error) {
        console.warn('parsePhotos JSON parse error:', error);
        return [];
      }
    }
  }
  return [];
};

const toLocalDateTime = (value: Date) => value.toISOString().slice(0, 19);

const normalizeSignalementForUi = (signalement: any) => {
  const idSignalement =
    signalement?.idSignalement ??
    signalement?.id_signalement ??
    signalement?.id ??
    signalement?.firestoreId ??
    '';

  return {
    idSignalement,
    idUser: String(signalement?.idUser ?? signalement?.Id_User ?? signalement?.id_user ?? ''),
    latitude: toNumber(signalement?.latitude, Number.NaN),
    longitude: toNumber(signalement?.longitude, Number.NaN),
    surface: toNumber(signalement?.surface, 0),
    niveau: toNumber(signalement?.niveau, 1),
    photos: parsePhotos(signalement?.photos),
    typeProbleme: signalement?.typeProbleme ?? signalement?.type_probleme ?? 'autre',
    description: signalement?.description || '',
    dateAjoute: signalement?.dateAjoute ?? signalement?.date_ajoute ?? new Date(),
    statut: signalement?.statut || 'nouveau',
    budget: toNumber(signalement?.budget, 0),
    avancement: toNumber(signalement?.avancement, 0),
    entrepriseNom: signalement?.entrepriseNom ?? signalement?.entreprise_nom ?? '',
    lieuNom: signalement?.lieuNom ?? signalement?.lieu_nom ?? '',
    lieuVille: signalement?.lieuVille ?? signalement?.lieu_ville ?? '',
    lieuDescription: signalement?.lieuDescription ?? signalement?.lieu_description ?? '',
  };
};

const addPhoto = async (source?: CameraSource) => {
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      resultType: CameraResultType.DataUrl,
      source: source || CameraSource.Prompt,
      allowEditing: true,
      correctOrientation: true,
    });
    if (photo.dataUrl) {
      photos.value.push({
        url: photo.dataUrl,
        addedBy: 'mobile-user',
        addedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Erreur ajout photo:', error);
    // Ne pas afficher d'alerte si l'utilisateur annule simplement
  }
};

const takePhoto = () => addPhoto(CameraSource.Camera);
const pickFromGallery = () => addPhoto(CameraSource.Photos);

const removePhoto = (index: number) => {
  photos.value.splice(index, 1);
};

let mapInitPromise: Promise<void> | null = null;
let userLocationMarker: L.Marker | null = null;

const invalidateMapSize = () => {
  if (!map) return;
  window.requestAnimationFrame(() => {
    map?.invalidateSize();
  });
  window.setTimeout(() => {
    map?.invalidateSize();
  }, 220);
};

const addCustomZoomControl = (mapInstance: L.Map) => {
  const customZoomControl = new L.Control({ position: 'topright' });
  customZoomControl.onAdd = (instance: L.Map) => {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    div.style.backgroundColor = 'white';
    div.style.border = '2px solid rgba(0,0,0,0.2)';
    div.style.borderRadius = '4px';
    div.style.padding = '5px';
    div.style.marginTop = '10px';

    const zoomInBtn = L.DomUtil.create('button', '', div);
    zoomInBtn.innerHTML = '+';
    zoomInBtn.style.width = '30px';
    zoomInBtn.style.height = '30px';
    zoomInBtn.style.fontSize = '18px';
    zoomInBtn.style.cursor = 'pointer';
    zoomInBtn.style.marginBottom = '5px';
    zoomInBtn.onclick = () => instance.zoomIn(0.5);

    const zoomOutBtn = L.DomUtil.create('button', '', div);
    zoomOutBtn.innerHTML = '-';
    zoomOutBtn.style.width = '30px';
    zoomOutBtn.style.height = '30px';
    zoomOutBtn.style.fontSize = '18px';
    zoomOutBtn.style.cursor = 'pointer';
    zoomOutBtn.onclick = () => instance.zoomOut(0.5);

    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  customZoomControl.addTo(mapInstance);
};

const bindMapClickHandler = (mapInstance: L.Map) => {
  mapInstance.on('click', (e: L.LeafletMouseEvent) => {
    if (marker && mapInstance.hasLayer(marker)) {
      mapInstance.removeLayer(marker);
    }
    marker = L.marker(e.latlng).addTo(mapInstance);
    currentLatLng.value = e.latlng;
    showModal.value = true;
  });
};

const createMapInstance = (container: HTMLElement, lat: number, lng: number, zoom: number) => {
  const mapInstance = L.map(container, {
    zoomControl: true,
    zoomSnap: 0.1,
    zoomDelta: 0.1,
    wheelPxPerZoomLevel: 120,
    preferCanvas: true,
  }).setView([lat, lng], zoom);

  addBaseLayer(mapInstance);
  addCustomZoomControl(mapInstance);
  bindMapClickHandler(mapInstance);
  return mapInstance;
};

const cleanupMapInstance = () => {
  if (!map) return;
  const mapInstance = map;

  if (marker && mapInstance.hasLayer(marker)) {
    mapInstance.removeLayer(marker);
  }
  marker = null;

  if (userLocationMarker && mapInstance.hasLayer(userLocationMarker)) {
    mapInstance.removeLayer(userLocationMarker);
  }
  userLocationMarker = null;

  allMarkers.value.forEach((m) => {
    if (mapInstance.hasLayer(m)) {
      mapInstance.removeLayer(m);
    }
  });
  allMarkers.value = [];

  if (baseLayer && mapInstance.hasLayer(baseLayer)) {
    mapInstance.removeLayer(baseLayer);
  }
  baseLayer = null;

  mapInstance.off();
  mapInstance.remove();
  map = null;
};

const ensureMapInitialized = async () => {
  if (!mapInitPromise) {
    mapInitPromise = initMap().finally(() => {
      mapInitPromise = null;
    });
  }
  await mapInitPromise;
};

onMounted(async () => {
  await nextTick();
  window.setTimeout(() => {
    ensureMapInitialized().catch((error) => {
      console.error('Erreur initialisation carte:', error);
    });
  }, 100);

  const currentUser = parseCurrentUser();
  if (!currentUser) {
    toastMessage.value = 'Veuillez vous connecter';
    showToast.value = true;
  } else {
    startPresenceMonitoring();
    toastMessage.value = 'Carte initialisee avec succes';
    showToast.value = true;
  }

  await firebaseNotificationService.initialize();

  const unsubscribeSignalements = firebaseSyncService.subscribeToSignalements((firebaseSignalements) => {
    const mappedReports = firebaseSignalements
      .map((signalement) => normalizeSignalementForUi(signalement))
      .filter((report: any) => Number.isFinite(report.latitude) && Number.isFinite(report.longitude));

    const filteredReports =
      showOnlyMine.value
        ? mappedReports.filter((report: any) => matchesCurrentUser(currentUser, report.idUser))
        : mappedReports;

    updateMarkers(filteredReports);
    updateRecapData(filteredReports);
  });

  (window as any).firebaseUnsubscribe = unsubscribeSignalements;
});

onIonViewDidEnter(() => {
  window.setTimeout(() => {
    ensureMapInitialized()
      .then(() => {
        invalidateMapSize();
        loadAllReports();
      })
      .catch((error) => {
        console.error('Erreur reactive map:', error);
      });
  }, 120);
});

onUnmounted(() => {
  if (presenceHeartbeatTimer) {
    window.clearInterval(presenceHeartbeatTimer);
    presenceHeartbeatTimer = null;
  }
  if (pendingSyncTimer) {
    window.clearInterval(pendingSyncTimer);
    pendingSyncTimer = null;
  }
  if (reportsRefreshTimer) {
    window.clearInterval(reportsRefreshTimer);
    reportsRefreshTimer = null;
  }

  if ((window as any).firebaseUnsubscribe) {
    (window as any).firebaseUnsubscribe();
    (window as any).firebaseUnsubscribe = null;
  }

  firebaseNotificationService.cleanup();
  cleanupMapInstance();
  mapInitPromise = null;
});

const initMap = async () => {
  if (map) {
    invalidateMapSize();
    return;
  }

  const mapContainer = document.getElementById('map') as (HTMLElement & { _leaflet_id?: number }) | null;
  if (!mapContainer) {
    console.warn('Container #map introuvable.');
    return;
  }

  if (mapContainer._leaflet_id && !map) {
    mapContainer._leaflet_id = undefined;
  }

  try {
    const isAndroid = Capacitor.getPlatform() === 'android';

    if (isAndroid) {
      try {
        await Geolocation.requestPermissions();
      } catch (permError) {
        console.warn('Permissions de geolocalisation non accordees:', permError);
      }
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: isAndroid ? 10000 : 5000,
      maximumAge: isAndroid ? 60000 : 0,
    };

    let lat = -18.8792;
    let lng = 47.5079;

    try {
      const position = await Geolocation.getCurrentPosition(geoOptions);
      lat = position.coords.latitude;
      lng = position.coords.longitude;
    } catch (geoError) {
      console.warn('Impossible d obtenir la position GPS, utilisation de la position par defaut:', geoError);
    }

    map = createMapInstance(mapContainer, lat, lng, 15);
    invalidateMapSize();

    const userIcon = L.divIcon({
      className: 'user-marker',
      html: `<div style="
        background: linear-gradient(135deg, #21103f, #6731bf);
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 10px rgba(30, 58, 95, 0.5);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    userLocationMarker = L.marker([lat, lng], { icon: userIcon })
      .addTo(map)
      .bindPopup('Votre position');
  } catch (error) {
    console.error('Erreur de geolocalisation:', error);
    toastMessage.value =
      Capacitor.getPlatform() === 'android'
        ? 'Veuillez autoriser la geolocalisation dans les parametres de l application'
        : 'Erreur de geolocalisation';
    showToast.value = true;

    map = createMapInstance(mapContainer, -18.8792, 47.5079, 12);
    invalidateMapSize();
  }

  loadAllReports();
};
const loadAllReports = async () => {
  if (!map) return;
  allMarkers.value.forEach(m => {
    if (map) map.removeLayer(m);
  });
  allMarkers.value = [];
  try {
    const currentUser = parseCurrentUser();

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
    } catch (error) {
      console.warn('Chargement API fallback vers Firebase:', error);
      usedFirebaseFallback = true;
      signalements = await firebaseSyncService.getSignalements();
      travaux = await firebaseSyncService.getTravaux();
    }

    const normalizedSignalements = signalements.map((signalement: any) => normalizeSignalementForUi(signalement));
    const visibleSignalements = showOnlyMine.value
      ? normalizedSignalements.filter((signalement: any) => matchesCurrentUser(currentUser, signalement.idUser))
      : normalizedSignalements;

    const travauxBySignalement = new Map<number, any>();
    travaux.forEach((travail: any) => {
      const idSignalement = Number(
        travail?.signalement?.idSignalement ??
        travail?.signalementId ??
        travail?.id_signalement
      );
      if (Number.isFinite(idSignalement)) {
        travauxBySignalement.set(idSignalement, travail);
      }
    });

    visibleSignalements.forEach((signalement: any) => {
      const latitude = toNumber(signalement.latitude, Number.NaN);
      const longitude = toNumber(signalement.longitude, Number.NaN);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }
      const travauxAssocie = travauxBySignalement.get(Number(signalement.idSignalement));
      const photosList = parsePhotos(signalement.photos);
      const dateAjoute = signalement.dateAjoute ? new Date(signalement.dateAjoute) : new Date();
      const typeProbleme = signalement.typeProbleme || 'autre';

      const markerInstance = L.marker(
        [latitude, longitude],
        { icon: getIconForProblem(typeProbleme) }
      ).addTo(map!);

      let popupContent = `
        <div style="
          background: linear-gradient(135deg, #1a0d3f, #2b145c);
          border-radius: 12px;
          padding: 16px;
          min-width: 200px;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600;">${getProblemLabel(typeProbleme)}</h4>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: rgba(255,255,255,0.5); font-size: 12px;">Surface</span>
            <span style="font-size: 12px;">${toNumber(signalement.surface, 0)} m2</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: rgba(255,255,255,0.5); font-size: 12px;">Statut</span>
            <span style="font-size: 12px;">${signalement.statut || 'nouveau'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: rgba(255,255,255,0.5); font-size: 12px;">Date</span>
            <span style="font-size: 12px;">${dateAjoute.toLocaleDateString('fr-FR')}</span>
          </div>
      `;
      popupContent += `
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: rgba(255,255,255,0.5); font-size: 12px;">Niveau</span>
            <span style="font-size: 12px;">${toNumber(signalement.niveau, 1)}</span>
          </div>
      `;

      if (travauxAssocie) {
        popupContent += `
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: rgba(255,255,255,0.5); font-size: 12px;">Budget</span>
            <span style="font-size: 12px;">${toNumber(travauxAssocie.budget, 0).toLocaleString()} Ar</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0;">
            <span style="color: rgba(255,255,255,0.5); font-size: 12px;">Avancement</span>
            <span style="font-size: 12px;">${toNumber(travauxAssocie.avancement, 0)}%</span>
          </div>
        `;
      }

      popupContent += `
          <p style="margin: 10px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">${signalement.description || 'Aucune description'}</p>
          ${photosList.length > 0
            ? `<div style="margin-top:8px;font-size:12px;">
                <div style="margin-bottom:4px;color:rgba(255,255,255,0.7);">Photos (${photosList.length})</div>
                ${photosList.map((photo, index) =>
                  `<a href="${photo.url}" target="_blank" style="color:#d8c5fb;display:block;margin-top:4px;">Voir photo ${index + 1}</a>`
                ).join('')}
              </div>`
            : ''}
        </div>
      `;

      markerInstance.bindPopup(popupContent, {
        className: 'custom-popup-wrapper'
      });
      allMarkers.value.push(markerInstance);
    });

    if (usedFirebaseFallback) {
      toastMessage.value = 'Donnees chargees depuis Firebase avec succes';
      showToast.value = true;
    }
  } catch (error: any) {
    console.error('Erreur lors du chargement:', error);
    toastMessage.value = 'Erreur de chargement des signalements';
    showToast.value = true;
  }
};

// Fonction pour mettre à jour les marqueurs sur la carte
const updateMarkers = (reports: any[]) => {
  if (!map) return;
  
  // Supprimer tous les marqueurs existants
  allMarkers.value.forEach(m => {
    if (map) map.removeLayer(m);
  });
  allMarkers.value = [];
  
  // Ajouter les nouveaux marqueurs
  reports.forEach((signalement: any) => {
    const latitude = toNumber(signalement.latitude, Number.NaN);
    const longitude = toNumber(signalement.longitude, Number.NaN);
    
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }
    
    const typeProbleme = signalement.typeProbleme || 'autre';
    const markerInstance = L.marker(
      [latitude, longitude],
      { icon: getIconForProblem(typeProbleme) }
    ).addTo(map!);
    
    // Créer le contenu du popup
    const popupContent = `
      <div style="
        background: linear-gradient(135deg, #1a0d3f, #2b145c);
        border-radius: 12px;
        padding: 16px;
        min-width: 200px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600;">${getProblemLabel(typeProbleme)}</h4>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <span style="color: rgba(255,255,255,0.5); font-size: 12px;">Surface</span>
          <span style="font-size: 12px;">${toNumber(signalement.surface, 0)} m2</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <span style="color: rgba(255,255,255,0.5); font-size: 12px;">Statut</span>
          <span style="font-size: 12px;">${signalement.statut || 'nouveau'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <span style="color: rgba(255,255,255,0.5); font-size: 12px;">Date</span>
          <span style="font-size: 12px;">${new Date(signalement.dateAjoute || new Date()).toLocaleDateString('fr-FR')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <span style="color: rgba(255,255,255,0.5); font-size: 12px;">Niveau</span>
          <span style="font-size: 12px;">${toNumber(signalement.niveau, 1)}</span>
        </div>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">${signalement.description || 'Aucune description'}</p>
      </div>
    `;
    
    markerInstance.bindPopup(popupContent, {
      className: 'custom-popup-wrapper'
    });
    
    allMarkers.value.push(markerInstance);
  });
};

// Fonction pour mettre à jour les données de récapitulation
const updateRecapData = (reports: any[]) => {
  if (!reports || reports.length === 0) {
    recapData.value = { count: 0, totalSurface: 0, averageAvancement: 0, totalBudget: 0 };
    return;
  }
  
  const totalSurface = reports.reduce((sum, r) => sum + toNumber(r.surface, 0), 0);
  const totalBudget = reports.reduce((sum, r) => sum + toNumber(r.budget, 0), 0);
  const totalAvancement = reports.reduce((sum, r) => sum + toNumber(r.avancement, 0), 0);
  
  recapData.value = {
    count: reports.length,
    totalSurface,
    averageAvancement: reports.length > 0 ? totalAvancement / reports.length : 0,
    totalBudget
  };
};

const toggleMineFilter = () => {
  showOnlyMine.value = !showOnlyMine.value;
  loadAllReports();
};

const closeModal = () => {
  showModal.value = false;
  description.value = '';
  surface.value = '';
  typeProbleme.value = '';
  photos.value = [];
  if (marker && map) {
    map.removeLayer(marker as L.Layer);
    marker = null;
  }
  currentLatLng.value = null;
};

const submitReport = async () => {
  if (!currentLatLng.value) {
    toastMessage.value = 'Veuillez selectionner un emplacement';
    showToast.value = true;
    return;
  }
  if (!typeProbleme.value) {
    toastMessage.value = 'Veuillez selectionner un type de probleme';
    showToast.value = true;
    return;
  }
  if (!surface.value || parseFloat(surface.value) <= 0) {
    toastMessage.value = 'Veuillez entrer une surface valide';
    showToast.value = true;
    return;
  }

  try {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      toastMessage.value = 'Utilisateur non connecte';
      showToast.value = true;
      return;
    }
    const user = JSON.parse(userStr);
    const signalementOwnerId = getPreferredSignalementOwnerId(user);
    if (!signalementOwnerId) {
      toastMessage.value = 'Identifiant utilisateur introuvable';
      showToast.value = true;
      return;
    }

    const now = new Date();
    const basePayload = {
      idUser: signalementOwnerId,
      Id_User: signalementOwnerId,
      id_user: signalementOwnerId,
      latitude: currentLatLng.value.lat,
      longitude: currentLatLng.value.lng,
      surface: parseFloat(surface.value) || 0,
      niveau: 1,
      typeProbleme: typeProbleme.value,
      type_probleme: typeProbleme.value,
      description: description.value,
      photos: photos.value.map((p) => p.url),
      statut: 'nouveau',
      dateAjoute: now,
      date_ajoute: toLocalDateTime(now),
      source: 'mobile' as const,
    };

    let backendSaved = false;
    let firebaseSaved = false;
    let backendSignalementId: string | null = null;

    // 1. Si backend accessible, on cree d'abord localement pour conserver un ID stable.
    try {
      const response = await fetch(apiUrl('/api/signalements'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: currentLatLng.value.lat,
          longitude: currentLatLng.value.lng,
          idUser: signalementOwnerId,
          surface: parseFloat(surface.value) || 0,
          niveau: 1,
          typeProbleme: typeProbleme.value,
          description: description.value,
          photos: photos.value,
          statut: 'nouveau'
        }),
      });
      if (response.ok) {
        const signalementData = await response.json().catch(() => ({}));
        const signalementId = signalementData?.idSignalement;
        if (signalementId !== undefined && signalementId !== null) {
          backendSignalementId = String(signalementId);
        }
        backendSaved = true;
      }
    } catch (error) {
      console.warn('Erreur backend post signalement:', error);
      backendSaved = false;
    }

    // 2. Ecriture Firebase dans tous les cas.
    try {
      if (backendSignalementId) {
        await firebaseSyncService.updateSignalement(backendSignalementId, {
          ...basePayload,
          id: backendSignalementId,
          id_signalement: backendSignalementId,
        } as any);
      } else {
        await firebaseSyncService.addSignalement(basePayload as any);
      }
      firebaseSaved = true;
    } catch (firebaseError) {
      console.error('Erreur synchronisation Firebase:', firebaseError);
      firebaseSaved = false;
    }

    if (!backendSaved && !firebaseSaved) {
      throw new Error('Aucun backend accessible et ecriture Firebase echouee');
    }

    if (backendSaved && firebaseSaved) {
      toastMessage.value = 'Signalement envoye avec succes';
    } else if (firebaseSaved) {
      toastMessage.value = 'Signalement enregistre dans Firebase avec succes';
    } else {
      toastMessage.value = 'Signalement enregistre sur backend (sync Firebase en attente)';
    }

    showToast.value = true;
    closeModal();
    loadAllReports();
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi:', error);
    toastMessage.value = `Erreur lors de l'envoi: ${error.message || 'Connexion bloquee'}`;
    showToast.value = true;
  }
};

const bootstrapMobileUsers = async () => {
  try {
    const response = await fetch(apiUrl('/api/auth/mobile-bootstrap'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      return;
    }
  } catch (error) {
    console.warn('Erreur bootstrapMobileUsers:', error);
  }
};

const performLocalSync = async (trigger: 'manual' | 'remote' = 'manual') => {
  try {
    await bootstrapMobileUsers();
    const pushResult = await firebaseSyncService.syncPostgresToFirebase();
    const pullResult = await firebaseSyncService.syncAll();
    await loadAllReports();
    await loadRecapData();

    if (!pushResult.success && !pullResult.success) {
      throw new Error(`${pushResult.message} | ${pullResult.message}`);
    }

    toastMessage.value = trigger === 'remote'
      ? `Demande web recue: synchronisation mobile terminee (${pushResult.message})`
      : `Donnees synchronisees avec le serveur (${pushResult.message})`;
    showToast.value = true;
  } catch (error: any) {
    console.error('Erreur lors de la synchronisation:', error);
    toastMessage.value = `Erreur de synchronisation: ${error.message || 'Connexion bloquee'}`;
    showToast.value = true;
  }
};

const requestPeerSync = async (source: 'mobile' | 'web', requestedBy: string) => {
  await fetch(apiUrl('/api/presence/request-sync'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, requestedBy }),
  });
};

const ackPeerSync = async (target: 'mobile' | 'web', requestId: number) => {
  await fetch(apiUrl('/api/presence/ack-sync'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, requestId }),
  });
};

const heartbeatMobile = async () => {
  const currentUser = parseCurrentUser();
  const clientId = getPresenceClientId(currentUser, 'mobile-app');
  await fetch(apiUrl('/api/presence/heartbeat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientType: 'mobile', clientId }),
  });
};

const syncLocalToFirestore = async () => {
  try {
    await requestPeerSync('mobile', 'mobile-app');
  } catch (error) {
    console.warn('Erreur requestPeerSync:', error);
  }
  await performLocalSync('manual');
};

const startPresenceMonitoring = () => {
  heartbeatMobile().catch(() => {
    // no-op
  });

  presenceHeartbeatTimer = window.setInterval(() => {
    heartbeatMobile().catch(() => {
      // no-op
    });
  }, 15000);

  pendingSyncTimer = window.setInterval(async () => {
    try {
      const response = await fetch(apiUrl('/api/presence/pending-sync?target=mobile'));
      if (!response.ok) return;
      const pending = await response.json();
      if (!pending?.hasPending) return;

      toastMessage.value = 'Demande web recue: synchronisation automatique en cours...';
      showToast.value = true;
      await performLocalSync('remote');
      if (pending.requestId) {
        await ackPeerSync('mobile', Number(pending.requestId));
      }
    } catch (error) {
      console.warn('Erreur synchronisation automatique:', error);
    }
  }, 12000);
};

const openRecapModal = async () => {
  await loadRecapData();
  showRecapModal.value = true;
};

const loadRecapData = async () => {
  try {
    const currentUser = parseCurrentUser();

    const [sigRes, travRes] = await Promise.all([fetch(apiUrl('/api/signalements')), fetch(apiUrl('/api/travaux'))]);
    if (!sigRes.ok || !travRes.ok) {
      throw new Error('Echec chargement statistiques');
    }
    const signalements = await sigRes.json();
    const travaux = await travRes.json();

    const visibleSignalements = showOnlyMine.value
      ? signalements.filter((signalement: any) => matchesCurrentUser(currentUser, signalement.idUser))
      : signalements;

    let count = 0;
    let totalSurface = 0;
    visibleSignalements.forEach((signalement: any) => {
      count += 1;
      totalSurface += toNumber(signalement.surface, 0);
    });
    const visibleSignalementIds = new Set(
      visibleSignalements.map((signalement: any) => Number(signalement.idSignalement)).filter((id: number) => Number.isFinite(id))
    );

    let totalBudget = 0;
    let totalAvancement = 0;
    let travauxCount = 0;
    
    travaux.forEach((data: any) => {
      const idSignalement = Number(data?.signalement?.idSignalement);
      if (showOnlyMine.value && !visibleSignalementIds.has(idSignalement)) {
        return;
      }
      totalBudget += toNumber(data.budget, 0);
      totalAvancement += toNumber(data.avancement, 0);
      travauxCount++;
    });

    recapData.value = { 
      count, 
      totalSurface, 
      averageAvancement: travauxCount > 0 ? Math.round(totalAvancement / travauxCount) : 0,
      totalBudget 
    };
  } catch (error: any) {
    console.error('Erreur:', error);
    toastMessage.value = 'Erreur de chargement';
    showToast.value = true;
  }
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('fr-FR');
};

const loadCriticality = async () => {
  try {
    const response = await fetch(apiUrl('/api/analytics/criticality'));
    if (!response.ok) throw new Error('Donnees criticite indisponibles');
    criticalityRows.value = await response.json();
  } catch (error) {
    console.error('Erreur chargement criticite:', error);
    criticalityRows.value = [];
    throw error;
  }
};

const loadAudit = async () => {
  try {
    const response = await fetch(apiUrl('/api/analytics/audit?limit=80'));
    if (!response.ok) throw new Error('Donnees audit indisponibles');
    auditRows.value = await response.json();
  } catch (error) {
    console.error('Erreur chargement audit:', error);
    auditRows.value = [];
    throw error;
  }
};

const loadImpact = async () => {
  try {
    const response = await fetch(apiUrl('/api/analytics/impact'));
    if (!response.ok) throw new Error('Donnees impact indisponibles');
    impactData.value = await response.json();
  } catch (error) {
    console.error('Erreur chargement impact:', error);
    impactData.value = {
      totalSignalements: 0,
      openSignalements: 0,
      closedSignalements: 0,
      engagedBudget: 0,
      averageResolutionDays: 0,
    };
    throw error;
  }
};

const loadBlockedUsers = async () => {
  try {
    const response = await fetch(apiUrl('/api/analytics/blocked-users'));
    if (!response.ok) throw new Error('Donnees utilisateurs bloques indisponibles');
    blockedUsers.value = await response.json();
  } catch (error) {
    console.error('Erreur chargement utilisateurs bloques:', error);
    blockedUsers.value = [];
    throw error;
  }
};

const openCriticalityModal = async () => {
  try {
    await loadCriticality();
    showCriticalityModal.value = true;
  } catch (error: any) {
    toastMessage.value = 'Les donnees de criticite ne sont pas disponibles. Essayez plus tard.';
    showToast.value = true;
  }
};

const openAuditModal = async () => {
  try {
    await loadAudit();
    showAuditModal.value = true;
  } catch (error: any) {
    toastMessage.value = 'Le journal d\'audit n\'est pas disponible. Essayez plus tard.';
    showToast.value = true;
  }
};

const openImpactModal = async () => {
  try {
    await Promise.all([loadImpact(), loadBlockedUsers()]);
    showImpactModal.value = true;
  } catch (error: any) {
    toastMessage.value = 'Les donnees d\'impact ne sont pas disponibles. Essayez plus tard.';
    showToast.value = true;
  }
};
</script>

<style scoped>
.map-page {
  --background: #f6f2ff;
  height: 100%;
  position: relative;
}

.custom-toolbar {
  --background: #21103f;
  --color: white;
  --border-width: 0;
}

.custom-toolbar ion-title {
  font-weight: 600;
}

.recap-btn {
  --color: #6731bf;
  font-weight: 500;
}

.filter-btn {
  --color: #8b5cf6;
  font-weight: 500;
}

.sync-btn {
  --color: #6731bf;
  font-weight: 500;
}

#map {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.insight-fab-group {
  position: absolute;
  right: 14px;
  bottom: 18px;
  z-index: 450;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.insight-fab {
  --background: rgba(33, 16, 63, 0.92);
  --color: #ffffff;
  --border-radius: 999px;
  --padding-start: 14px;
  --padding-end: 14px;
  font-size: 12px;
  font-weight: 600;
}

.custom-modal {
  --background: transparent;
}

.custom-modal::part(content) {
  background: #ffffff;
  border-radius: 20px 20px 0 0;
  border-top: 1px solid #dbcdf2;
}

.modal-toolbar {
  --background: #21103f;
  --color: white;
  --border-width: 0;
}

.modal-toolbar ion-title {
  font-weight: 600;
}

.modal-content {
  --background: transparent;
}

.form-container {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #2a1250;
  margin-bottom: 8px;
}

.custom-select,
.custom-input,
.custom-textarea {
  --background: #f6f2ff;
  --border-radius: 12px;
  --padding-start: 16px;
  --padding-end: 16px;
  --color: #2a1250;
  --placeholder-color: #927ab8;
  border: 1px solid #dbcdf2;
  border-radius: 12px;
}

.submit-btn {
  --background: linear-gradient(135deg, #21103f, #47208c);
  --border-radius: 12px;
  --box-shadow: 0 10px 30px -10px rgba(30, 58, 95, 0.5);
  height: 52px;
  font-weight: 600;
  margin-top: 10px;
}

.add-photo-btn {
  --border-radius: 12px;
  --border-color: #d8c5fb;
  --color: #8c52e6;
  margin-bottom: 12px;
}

.photo-preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.photo-preview-item {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #dbcdf2;
  background: #f6f2ff;
}

.photo-preview-item img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  display: block;
}

.photo-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(17, 24, 39, 0.8);
  color: white;
  cursor: pointer;
  line-height: 20px;
  font-size: 12px;
}

.recap-modal::part(content) {
  height: 70vh;
  min-height: 450px;
  background: white;
}

.recap-modal .modal-toolbar {
  --background: linear-gradient(135deg, #21103f, #6731bf);
  --color: white;
}

.recap-modal .modal-content {
  --background: white;
}

.recap-container {
  padding: 20px;
}

.recap-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f8f2ff;
  border-radius: 16px;
  margin-bottom: 12px;
  border: 1px solid #dbcdf2;
}

.recap-card.purple .recap-icon { background: rgba(126, 63, 252, 0.22); }
.recap-card.green .recap-icon { background: rgba(103, 49, 191, 0.2); }
.recap-card.yellow .recap-icon { background: rgba(140, 82, 230, 0.2); }
.recap-card.red .recap-icon { background: rgba(177, 130, 255, 0.24); }

.recap-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.recap-info {
  display: flex;
  flex-direction: column;
}

.recap-label {
  font-size: 13px;
  color: #705e96;
}

.recap-value {
  font-size: 22px;
  font-weight: 700;
  color: #2a1250;
}

.refresh-btn {
  --background: #21103f;
  --border-radius: 12px;
  --color: white;
  margin-top: 8px;
  height: 48px;
}
</style>

<style>
.leaflet-popup-content-wrapper {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}

.leaflet-popup-content {
  margin: 0 !important;
}

.leaflet-popup-tip {
  background: #21103f !important;
}

.custom-popup-wrapper .leaflet-popup-content-wrapper {
  background: transparent !important;
}
</style>
