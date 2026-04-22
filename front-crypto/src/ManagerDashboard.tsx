// front-crypto/src/ManagerDashboard.tsx - Realtime Database
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { MapContainer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ref, get } from 'firebase/database';
import { db } from './firebase';
import './styles/sync-modal.css';
import { apiUrl, TILE_URL } from './config/api';
import { ANTANANARIVO_BOUNDS, MAP_DEFAULT_ZOOM, MAP_MAX_ZOOM, MAP_MIN_ZOOM } from './config/map';
import OfflineVectorTileLayer from './components/OfflineVectorTileLayer';
import OfflinePlaceLabelsLayer from './components/OfflinePlaceLabelsLayer';
import ScreenshotCapture from './components/ScreenshotCapture';
import {
  firebaseSyncService,
  type Signalement as FirebaseSignalement,
  type Travaux as FirebaseTravaux,
  type Utilisateur as FirebaseUtilisateur,
} from './services/firebaseSyncService';

type View = 'map' | 'users' | 'reports' | 'config';

const resolveInitialView = (): View => {
  if (typeof window === 'undefined') {
    return 'map';
  }

  const requested = new URLSearchParams(window.location.search).get('view');
  if (requested === 'users' || requested === 'reports' || requested === 'config' || requested === 'map') {
    return requested;
  }

  return 'map';
};

interface User {
  idUtilisateur: number;
  nomUtilisateur: string;
  email: string;
  motDePasse?: string;
  role?: { nom: string };
  estBloque?: boolean;
  tentativesEchec?: number;
}

interface PhotoEntry {
  url: string;
  addedBy?: string;
  addedAt?: string;
}

interface Report {
  id: number;
  firestoreId?: string;
  latitude: number;
  longitude: number;
  idUser: string;
  surface: number;
  niveau: number;
  photos: PhotoEntry[];
  typeProbleme?: string;
  description: string;
  dateAjoute: Date;
  statut: string;
  entrepriseNom?: string;
  budget?: number;
  avancement?: number;
  travauxId?: number;
  entrepriseId?: number;
  dateDebut?: string;
  dateFin?: string;
  lieuNom?: string;
  lieuVille?: string;
  lieuDescription?: string;
}

interface Entreprise {
  idEntreprise: number;
  nom: string;
}

interface AuthParam {
  cle: string;
  valeur: string;
  description: string;
}

interface DelayStats {
  completedCount: number;
  averageDelayDays: number;
  minDelayDays: number;
  maxDelayDays: number;
}

type UserRole = 'MANAGER' | 'UTILISATEUR';

interface UserFormState {
  id: number;
  nom: string;
  email: string;
  password: string;
  role: UserRole;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;

const markerIcon = (color: string, symbol: string) =>
  L.divIcon({
    className: 'custom-marker custom-marker-modern',
    html: `<div style="position:relative;width:46px;height:56px;display:flex;align-items:flex-start;justify-content:center;">
      <svg width="46" height="56" viewBox="0 0 46 56" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
        <path d="M23 54C23 54 39 33.5 39 21.8C39 12.95 31.84 5.8 23 5.8C14.16 5.8 7 12.95 7 21.8C7 33.5 23 54 23 54Z" fill="${color}" />
        <circle cx="23" cy="21.8" r="12.2" fill="#ffffff" fill-opacity="0.97" />
        <circle cx="23" cy="21.8" r="15.4" fill="none" stroke="#ffffff" stroke-width="2.3" />
        <text x="23" y="26.6" text-anchor="middle" font-size="13.4" font-weight="800" fill="#1f2937" font-family="Segoe UI, Arial, sans-serif">${symbol}</text>
      </svg>
    </div>`,
    iconSize: [46, 56],
    iconAnchor: [23, 54],
    popupAnchor: [0, -50],
  });

const icons: Record<string, L.DivIcon> = {
  'nid-de-poule': markerIcon('#ef4444', 'NP'),
  'route-inondee': markerIcon('#3b82f6', 'IN'),
  'route-endommagee': markerIcon('#f97316', 'DE'),
  'signalisation-manquante': markerIcon('#eab308', 'SM'),
  'eclairage-defectueux': markerIcon('#8b5cf6', 'ED'),
  autre: markerIcon('#6b7280', 'OT'),
  default: markerIcon('#10b981', 'OK'),
};

const createEmptyReport = (): Report => ({
  id: 0,
  latitude: -18.8792,
  longitude: 47.5079,
  idUser: '',
  surface: 0,
  niveau: 1,
  photos: [],
  typeProbleme: 'autre',
  description: '',
  dateAjoute: new Date(),
  statut: 'nouveau',
  entrepriseNom: '',
  budget: 0,
  avancement: 0,
  travauxId: undefined,
  entrepriseId: undefined,
  dateDebut: '',
  dateFin: '',
});

const getProblemTypeLabel = (type?: string) => {
  const labels: Record<string, string> = {
    'nid-de-poule': 'Nid de poule',
    'route-inondee': 'Route inondée',
    'route-endommagee': 'Route endommagée',
    'signalisation-manquante': 'Signalisation manquante',
    'eclairage-defectueux': 'Éclairage défectueux',
    autre: 'Autre',
  };
  return labels[type || ''] || 'Problème routier';
};

const normalizeStatus = (status?: string) => {
  const value = (status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (value === 'en cours' || value === 'encours') return 'en cours';
  if (value === 'termine' || value === 'resolu' || value === 'resout') return 'termine';
  return 'nouveau';
};

const statusLabel = (status?: string) => {
  const value = normalizeStatus(status);
  if (value === 'en cours') return 'En cours';
  if (value === 'termine') return 'Terminé';
  return 'Nouveau';
};

const createPhotoEntry = (url: string, addedBy: string): PhotoEntry => ({
  url,
  addedBy,
  addedAt: new Date().toISOString(),
});

const parsePhotos = (value: unknown, fallbackActor = 'unknown'): PhotoEntry[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item: any) => {
        if (typeof item === 'string') {
          const url = item.trim();
          return url ? createPhotoEntry(url, fallbackActor) : null;
        }
        const url = String(item?.url || '').trim();
        if (!url) return null;
        return {
          url,
          addedBy: String(item?.addedBy || fallbackActor),
          addedAt: String(item?.addedAt || new Date().toISOString()),
        } as PhotoEntry;
      })
      .filter((photo): photo is PhotoEntry => photo !== null);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return parsePhotos(JSON.parse(trimmed), fallbackActor);
      } catch {
        return [];
      }
    }
  }

  return [];
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Lecture fichier impossible: ${file.name}`));
    reader.readAsDataURL(file);
  });

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toReportId = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  const raw = value == null ? '' : String(value).trim();
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  const normalized = Math.abs(hash);
  return normalized > 0 ? normalized : 1;
};

const toDateInput = (value?: string) => (value ? value.slice(0, 10) : '');

const FIREBASE_AUTH_API_KEY = (import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAgooGs6XiDVqu5FhDiBHC5Actg7n_CzP0').trim();

const createFirebaseAuthUser = async (email: string, password: string) => {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_AUTH_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  if (response.ok) {
    return;
  }

  const data = await response.json().catch(() => ({} as any));
  const code = data?.error?.message || 'FIREBASE_AUTH_ERROR';
  if (code === 'EMAIL_EXISTS') {
    return;
  }
  throw new Error(`Création Firebase impossible (${code})`);
};

const formatLastSeen = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) {
    return 'inconnu';
  }
  
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}min`;
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  } else {
    return `${Math.floor(seconds / 86400)}j`;
  }
};

export default function ManagerDashboard() {
  const [view, setView] = useState<View>(() => resolveInitialView());
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [params, setParams] = useState<AuthParam[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [delayStats, setDelayStats] = useState<DelayStats>({
    completedCount: 0,
    averageDelayDays: 0,
    minDelayDays: 0,
    maxDelayDays: 0,
  });
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Report | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>({
    id: 0,
    nom: '',
    email: '',
    password: '',
    role: 'UTILISATEUR',
  });
  const [syncRequest, setSyncRequest] = useState<{ hasRequest: boolean; requestId?: number; source?: string }>({ hasRequest: false });
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [otherClients, setOtherClients] = useState<any[]>([]);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);

  const handleScreenshotCapture = (dataUrl: string) => {
    setScreenshotDataUrl(dataUrl);
    setShowScreenshotModal(true);
  };

  const changeView = (nextView: View) => {
    setView(nextView);

    if (typeof window === 'undefined') {
      return;
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('view', nextView);
    window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  };

  const prixM2 = useMemo(() => {
    const raw = paramValues.prix_par_m2 ?? params.find((p) => p.cle === 'prix_par_m2')?.valeur ?? '100000';
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 100000;
  }, [paramValues, params]);

  const calculateBudgetPreview = (surface: number, niveau: number) => {
    const safeSurface = Number.isFinite(surface) && surface > 0 ? surface : 0;
    const safeNiveau = Math.min(10, Math.max(1, Number.isFinite(niveau) ? niveau : 1));
    return Math.round(prixM2 * safeSurface * safeNiveau);
  };

  // ✅ TOUTES LES FONCTIONS UTILITAIRES DÉFINIES ICI
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Session invalide: token absent');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/';
      throw new Error('Session invalide');
    }
    if (response.status === 403) {
      throw new Error('Acces refuse: droits manager requis');
    }

    return response;
  };

  const parseJsonOrThrow = async (response: Response, label: string) => {
    const raw = await response.text();
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`${label}: réponse non JSON -> ${raw.slice(0, 140)}`);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [usersRes, entreprisesRes, paramsRes, signalementsRes, travauxRes, delayRes] = await Promise.all([
        authFetch(apiUrl('/api/auth/users')),
        authFetch(apiUrl('/api/entreprises')),
        authFetch(apiUrl('/api/auth/params')),
        authFetch(apiUrl('/api/signalements')),
        authFetch(apiUrl('/api/travaux')),
        authFetch(apiUrl('/api/travaux/stats/delais')),
      ]);

      const [usersData, entreprisesData, paramsData, signalementsData, travauxData, delayData] = await Promise.all([
        parseJsonOrThrow(usersRes, 'GET /api/auth/users'),
        parseJsonOrThrow(entreprisesRes, 'GET /api/entreprises'),
        parseJsonOrThrow(paramsRes, 'GET /api/auth/params'),
        parseJsonOrThrow(signalementsRes, 'GET /api/signalements'),
        parseJsonOrThrow(travauxRes, 'GET /api/travaux'),
        parseJsonOrThrow(delayRes, 'GET /api/travaux/stats/delais'),
      ]);

      setUsers(usersData);
      setEntreprises(entreprisesData);
      setParams(paramsData);
      setParamValues(
        (paramsData as AuthParam[]).reduce((acc, item) => {
          acc[item.cle] = item.valeur;
          return acc;
        }, {} as Record<string, string>)
      );

      const travauxBySignalement = new Map<number, any>();
      for (const travail of travauxData) {
        const signalementId = Number(travail?.signalement?.idSignalement);
        if (!Number.isNaN(signalementId)) {
          travauxBySignalement.set(signalementId, travail);
        }
      }

      const mappedReports = (signalementsData as any[])
        .map((signalement) => {
          const travail = travauxBySignalement.get(Number(signalement.idSignalement));
          const latitude = toNumber(signalement.latitude, Number.NaN);
          const longitude = toNumber(signalement.longitude, Number.NaN);

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }

          return {
            id: Number(signalement.idSignalement),
            firestoreId: signalement.firestoreId ? String(signalement.firestoreId) : undefined,
            latitude,
            longitude,
            idUser: signalement.idUser || '',
            surface: toNumber(signalement.surface, 0),
            niveau: toNumber(signalement.niveau, 1),
            photos: parsePhotos(signalement.photos, String(signalement.idUser || 'mobile')),
            typeProbleme: signalement.typeProbleme,
            description: signalement.description || '',
            dateAjoute: signalement.dateAjoute ? new Date(signalement.dateAjoute) : new Date(),
            statut: normalizeStatus(signalement.statut),
            travauxId: travail?.id,
            entrepriseId: travail?.entreprise?.idEntreprise,
            entrepriseNom: travail?.entreprise?.nom,
            budget: toNumber(travail?.budget, 0),
            avancement: toNumber(travail?.avancement, 0),
            dateDebut: travail?.dateDebutTravaux || '',
            dateFin: travail?.dateFinTravaux || '',
            lieuNom: signalement?.lieu?.libelle || '',
            lieuVille: signalement?.lieu?.ville || '',
            lieuDescription: signalement?.lieu?.description || '',
          } as Report;
        })
        .filter((report: Report | null): report is Report => report !== null);

      setReports(mappedReports);
      setDelayStats({
        completedCount: Number(delayData?.completedCount || 0),
        averageDelayDays: Number(delayData?.averageDelayDays || 0),
        minDelayDays: Number(delayData?.minDelayDays || 0),
        maxDelayDays: Number(delayData?.maxDelayDays || 0),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAuthError = errorMessage.includes('Session invalide') || errorMessage.includes('Acces refuse');
      if (!isAuthError) {
        try {
          const [firebaseSignalements, firebaseTravaux, firebaseUsers] = await Promise.all([
            firebaseSyncService.getSignalements(),
            firebaseSyncService.getTravaux(),
            firebaseSyncService.getUtilisateurs(),
          ]);

          const mappedUsers: User[] = firebaseUsers.map((utilisateur) => ({
            idUtilisateur: toReportId(utilisateur.id),
            nomUtilisateur: utilisateur.nomUtilisateur || '',
            email: utilisateur.email || '',
            role: { nom: utilisateur.role || 'UTILISATEUR' },
            estBloque: utilisateur.estBloque || false,
            tentativesEchec: utilisateur.tentativesEchec || 0,
          }));

          const travauxBySignalement = new Map<number, any>();
          for (const travail of firebaseTravaux) {
            const signalementId = Number((travail as any)?.signalementId ?? (travail as any)?.id_signalement);
            if (Number.isFinite(signalementId)) {
              travauxBySignalement.set(signalementId, travail);
            }
          }

          const mappedReports: Report[] = firebaseSignalements
            .map((signalement: any) => {
              const latitude = toNumber(signalement.latitude, Number.NaN);
              const longitude = toNumber(signalement.longitude, Number.NaN);
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return null;
              }

              const signalementKey = signalement?.id_signalement ?? signalement?.id;
              const signalementNumericId = Number(signalementKey);
              const reportId = toReportId(signalementKey);
              const travail = Number.isFinite(signalementNumericId) ? travauxBySignalement.get(signalementNumericId) : undefined;

              return {
                id: reportId,
                firestoreId: signalement?.id ? String(signalement.id) : undefined,
                latitude,
                longitude,
                idUser: String(signalement?.idUser ?? signalement?.Id_User ?? signalement?.id_user ?? ''),
                surface: toNumber(signalement.surface, 0),
                niveau: toNumber(signalement.niveau, 1),
                photos: parsePhotos(signalement.photos, String(signalement?.idUser ?? signalement?.Id_User ?? signalement?.id_user ?? 'mobile')),
                typeProbleme: signalement?.typeProbleme ?? signalement?.type_probleme,
                description: signalement?.description || '',
                dateAjoute: signalement?.dateAjoute ? new Date(signalement.dateAjoute) : signalement?.date_ajoute ? new Date(signalement.date_ajoute) : new Date(),
                statut: normalizeStatus(signalement?.statut),
                travauxId: travail?.id ? Number(travail.id) : undefined,
                entrepriseId: travail?.entrepriseId ? Number(travail.entrepriseId) : travail?.id_entreprise ? Number(travail.id_entreprise) : undefined,
                entrepriseNom: travail?.entreprise_nom || '',
                budget: toNumber(travail?.budget, 0),
                avancement: toNumber(travail?.avancement, 0),
                dateDebut: (travail as any)?.dateDebut ? String((travail as any).dateDebut) : (travail as any)?.date_debut_travaux || '',
                dateFin: (travail as any)?.dateFin ? String((travail as any).dateFin) : (travail as any)?.date_fin_travaux || '',
                lieuNom: signalement?.lieuNom || '',
                lieuVille: signalement?.lieuVille || '',
                lieuDescription: signalement?.lieuDescription || '',
              } as Report;
            })
            .filter((report: Report | null): report is Report => report !== null);

          setUsers(mappedUsers);
          setReports(mappedReports);
          setDelayStats({
            completedCount: mappedReports.filter((r) => normalizeStatus(r.statut) === 'termine').length,
            averageDelayDays: 0,
            minDelayDays: 0,
            maxDelayDays: 0,
          });
          console.warn('Backend indisponible: donnees chargees depuis Firebase Realtime Database');
          return;
        } catch (firebaseFallbackError) {
          console.error('Erreur fallback Firebase manager:', firebaseFallbackError);
        }
      }

      console.error('Erreur chargement manager:', error);
      alert(`Erreur chargement: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const heartbeatWeb = async () => {
    try {
      const response = await fetch(apiUrl('/api/presence/heartbeat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientType: 'web', 
          clientId: 'manager-dashboard',
          timestamp: Date.now(),
        }),
      });
      const data = await response.json();
      
      // Mettre à jour la liste des autres clients connectés
      if (data.otherClients) {
        setOtherClients(Object.values(data.otherClients));
      }
    } catch (error) {
      console.error('Erreur heartbeat web:', error);
    }
  };

  const requestPeerSync = async (source: 'web' | 'mobile', requestedBy: string) => {
    await fetch(apiUrl('/api/presence/request-sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, requestedBy }),
    });
  };

  const ackPeerSync = async (target: 'web' | 'mobile', requestId: number) => {
    await fetch(apiUrl('/api/presence/ack-sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, requestId }),
    });
  };

  const checkSyncRequests = async () => {
    try {
      const response = await authFetch(apiUrl('/api/presence/pending-sync?target=web'));
      if (!response.ok) return;
      
      const pending = await response.json();
      if (pending?.hasPending) {
        setSyncRequest((current) => {
          if (current.hasRequest) {
            return current;
          }
          setShowSyncModal(true);
          return {
            hasRequest: true,
            requestId: pending.requestId,
            source: pending.source,
          };
        });
      }
    } catch {
      // no-op
    }
  };

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const readMobilePresence = async (maxAgeSeconds = 180) => {
    const response = await fetch(apiUrl(`/api/presence/mobile-active?maxAgeSeconds=${maxAgeSeconds}`));
    return response.json().catch(() => ({ active: false }));
  };

  const detectMobileWithRetry = async () => {
    const attempts = [0, 2000, 4000, 6000, 8000];
    let status: any = { active: false };
    for (const delayMs of attempts) {
      if (delayMs > 0) {
        await wait(delayMs);
      }
      status = await readMobilePresence(180);
      if (Boolean(status?.active)) {
        break;
      }
    }
    return status;
  };

  const syncFull = async (announceToMobile = true) => {
    setSyncing(true);
    try {
      if (announceToMobile) {
        const mobileStatus = await detectMobileWithRetry();
        const mobileActive = Boolean(mobileStatus?.active);
        if (!mobileActive) {
          const proceed = window.confirm(
            `Vérification mobile: l'application mobile n'est pas détectée comme active (dernier signal ${mobileStatus?.secondsSinceLastSeen ?? 'inconnu'}s). Continuer quand même ? La sync sera mise en attente pour le prochain lancement mobile.`
          );
          if (!proceed) {
            return;
          }
        }

        // Queue the sync request even if mobile is offline.
        await requestPeerSync('web', 'manager-dashboard');
      }

      // 1. Synchroniser PostgreSQL ↔ Realtime Database via backend
      console.log('🔄 Synchronisation PostgreSQL ↔ Realtime DB...');
      const backendSyncResponse = await authFetch(apiUrl('/api/sync/full'), {
        method: 'POST',
      });

      const backendSyncData = await backendSyncResponse.json().catch(() => ({}));
      if (!backendSyncResponse.ok) {
        throw new Error(backendSyncData?.message || 'Erreur lors de la synchronisation avec Firebase');
      }

      // 2. Synchroniser avec Realtime DB frontend
      console.log('🔄 Synchronisation frontend Realtime DB...');
      const frontendSyncResult = await firebaseSyncService.syncAll();
      
      if (!frontendSyncResult.success) {
        throw new Error(frontendSyncResult.message);
      }

      const pulled = backendSyncData?.pull || {};
      const pushed = backendSyncData?.push || {};
      const errors = Array.isArray(backendSyncData?.errors) ? backendSyncData.errors.length : 0;
      
      alert(
        `✅ Synchronisation avec Firebase réussie!\n\n` +
        `Données importées: ${pulled.signalements || 0} signalements, ${pulled.travaux || 0} travaux\n` +
        `Données exportées: ${pushed.signalements || 0} signalements, ${pushed.travaux || 0} travaux\n` +
        `${errors > 0 ? `Erreurs: ${errors}` : 'Aucune erreur'}`
      );

      await loadAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Erreur synchronisation complète:', error);
      alert(`Erreur de synchronisation avec Firebase: ${errorMessage}`);
    } finally {
      setSyncing(false);
    }
  };

  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(error);
      alert(`Erreur: ${errorMessage}`);
    }
  };

  // Monitorer la connexion Realtime Database - UN SEUL useEffect
  useEffect(() => {
    const checkRealtimeDBConnection = async () => {
      try {
        // Test simple de connexion Realtime Database
        await get(ref(db, 'signalements'));
        console.log('✅ Connexion Realtime Database OK');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Connexion Realtime Database KO:', errorMessage);
        // Note: Ne pas afficher d'alert ici pour éviter les boucles
      }
    };

    checkRealtimeDBConnection();
  }, []); // ✅ Array vide = exécution une seule fois au montage

  useEffect(() => {
    loadAll();
    heartbeatWeb();

    const heartbeatTimer = window.setInterval(() => {
      heartbeatWeb().catch(() => {
        // no-op
      });
    }, 15000);

    const pendingTimer = window.setInterval(async () => {
      try {
        const response = await fetch(apiUrl('/api/presence/pending-sync?target=web'));
        if (!response.ok) return;
        const pending = await response.json();
        if (!pending?.hasPending) return;

        // Afficher une notification visuelle et une modal pour la demande de synchronisation
        setSyncRequest((current) => {
          if (current.hasRequest) {
            return current;
          }
          setShowSyncModal(true);
          return {
            hasRequest: true,
            requestId: pending.requestId,
            source: pending.source,
          };
        });
      } catch {
        // no-op
      }
    }, 12000);

    // Synchronisation automatique avec Realtime Database
    let unsubscribeSignalements: (() => void) | null = null;
    let unsubscribeTravaux: (() => void) | null = null;
    let unsubscribeUtilisateurs: (() => void) | null = null;

    // ✅ INITIALISATION DES ABONNEMENTS AVEC TYPES EXPLICITES
    unsubscribeSignalements = firebaseSyncService.subscribeToSignalements((firebaseSignalements) => {
      const mappedReports = firebaseSignalements.map((signalement) => {
        const latitude = toNumber(signalement.latitude, Number.NaN);
        const longitude = toNumber(signalement.longitude, Number.NaN);
        const reportId = toReportId((signalement as any).id_signalement ?? signalement.id);
        
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }
        
        return {
          id: reportId,
          firestoreId: signalement.id ? String(signalement.id) : undefined,
          latitude,
          longitude,
          idUser: signalement.idUser || '',
          surface: toNumber(signalement.surface, 0),
          niveau: toNumber(signalement.niveau, 1),
          photos: parsePhotos(signalement.photos, String(signalement.idUser || 'mobile')),
          typeProbleme: signalement.typeProbleme,
          description: signalement.description || '',
          dateAjoute: signalement.dateAjoute ? new Date(signalement.dateAjoute) : new Date(),
          statut: normalizeStatus(signalement.statut),
          budget: toNumber(signalement.budget, 0),
          avancement: toNumber(signalement.avancement, 0),
          entrepriseNom: signalement.entrepriseNom || '',
          lieuNom: signalement.lieuNom || '',
          lieuVille: signalement.lieuVille || '',
          lieuDescription: signalement.lieuDescription || '',
        } as Report;
      }).filter((report: Report | null): report is Report => report !== null);
      
      setReports(mappedReports);
    });

    unsubscribeTravaux = firebaseSyncService.subscribeToTravaux((_firebaseTravaux) => {
      // Mettre à jour les travaux dans l'état
      // Les travaux sont déjà inclus dans les signalements via le mapping
      // Cette méthode peut être utilisée pour des mises à jour spécifiques
    });

    unsubscribeUtilisateurs = firebaseSyncService.subscribeToUtilisateurs((firebaseUtilisateurs) => {
      // Mettre à jour les utilisateurs dans l'état
      const mappedUsers = firebaseUtilisateurs.map((utilisateur) => ({
        idUtilisateur: toReportId(utilisateur.id),
        nomUtilisateur: utilisateur.nomUtilisateur || '',
        email: utilisateur.email || '',
        role: { nom: utilisateur.role || 'UTILISATEUR' },
        estBloque: utilisateur.estBloque || false,
        tentativesEchec: utilisateur.tentativesEchec || 0,
      } as User));
      
      setUsers(mappedUsers);
    });

    // ✅ CLEANUP CORRIGÉ - TOUTES LES VARIABLES SONT ACCESSIBLES
    return () => {
      window.clearInterval(heartbeatTimer);
      window.clearInterval(pendingTimer);
      
      // ✅ CORRECTION : Vérifier avant d'appeler ET vérifier le type
      if (unsubscribeSignalements && typeof unsubscribeSignalements === 'function') {
        unsubscribeSignalements();
      }
      if (unsubscribeTravaux && typeof unsubscribeTravaux === 'function') {
        unsubscribeTravaux();
      }
      if (unsubscribeUtilisateurs && typeof unsubscribeUtilisateurs === 'function') {
        unsubscribeUtilisateurs();
      }
    };

  }, []);

  const saveUser = async () => {
    if (!userForm.nom.trim() || !userForm.email.trim()) {
      alert('Nom et email obligatoires');
      return;
    }

    if (!userForm.id && !userForm.password.trim()) {
      alert('Mot de passe obligatoire pour la création');
      return;
    }
    if (!userForm.id && userForm.password.trim().length < 6) {
      alert('Mot de passe trop court: minimum 6 caractères (requis pour Firebase mobile)');
      return;
    }
    if (userForm.id && userForm.password.trim() && userForm.password.trim().length < 6) {
      alert('Mot de passe trop court: minimum 6 caractères (requis pour Firebase mobile)');
      return;
    }

    const payload: Record<string, string> = {
      nomUtilisateur: userForm.nom.trim(),
      email: userForm.email.trim(),
      role: userForm.role,
    };

    if (userForm.password.trim()) {
      payload.password = userForm.password;
    }

    const isUpdate = Boolean(userForm.id);
    const url = isUpdate ? apiUrl(`/api/auth/users/${userForm.id}`) : apiUrl('/api/auth/users');
    const method = isUpdate ? 'PUT' : 'POST';

    // 1. Sauvegarder dans PostgreSQL via le backend
    const response = await authFetch(url, {
      method,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    // 2. Récupérer l'utilisateur créé/mis à jour
    let userId = userForm.id;
    if (!userId) {
      try {
        const usersRes = await authFetch(apiUrl('/api/auth/users'));
        if (usersRes.ok) {
          const localUsers: User[] = await usersRes.json();
          const createdUser = localUsers.find(u => u.email === userForm.email.trim());
          if (createdUser) {
            userId = createdUser.idUtilisateur;
          }
        }
      } catch (error) {
        console.error('Erreur récupération utilisateur:', error);
      }
    }

    // 3. Synchroniser avec Firebase Realtime Database
    try {
      if (userId) {
        const firebasePayload: Omit<FirebaseUtilisateur, 'id' | 'dateSync'> = {
          nomUtilisateur: userForm.nom.trim(),
          email: userForm.email.trim(),
          role: userForm.role,
          estBloque: false,
          tentativesEchec: 0,
          dateCreation: new Date(),
          source: 'web',
        };

        await firebaseSyncService.updateUtilisateur(userId.toString(), {
          ...firebasePayload,
          dateCreation: isUpdate ? undefined : firebasePayload.dateCreation,
        });
        console.log('✅ Utilisateur synchronisé avec Firebase Realtime Database');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Erreur synchronisation Firebase utilisateur:', errorMessage);
      // Ne pas bloquer l'opération si Firebase échoue, PostgreSQL a déjà été mis à jour
    }

    // 4. Synchroniser avec Firebase Auth
    const firebaseSyncErrors: string[] = [];
    try {
      const usersRes = await authFetch(apiUrl('/api/auth/users'));
      if (usersRes.ok) {
        const localUsers: User[] = await usersRes.json();
        for (const localUser of localUsers) {
          const roleName = (localUser.role?.nom || '').toUpperCase();
          if (roleName === 'MANAGER') {
            continue;
          }
          if (!localUser.email || !localUser.motDePasse) {
            continue;
          }
          try {
            await createFirebaseAuthUser(localUser.email, localUser.motDePasse);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            firebaseSyncErrors.push(`${localUser.email}: ${errorMessage}`);
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      firebaseSyncErrors.push(`sync_global: ${errorMessage}`);
    }

    let mobileActive = false;
    try {
      const mobileStatus = await detectMobileWithRetry();
      mobileActive = Boolean(mobileStatus?.active);

      // Always queue sync so mobile can catch up at next launch.
      await requestPeerSync('web', `manager-user-save:${payload.email}`);
    } catch {
      // no-op
    }

    setUserForm({ id: 0, nom: '', email: '', password: '', role: 'UTILISATEUR' });
    await loadAll();

    const infoLines = [
      'Compte enregistré dans PostgreSQL.',
      mobileActive
        ? 'Mobile actif détecté: demande de synchronisation envoyée.'
        : 'Mobile non détecté actif: synchronisation mise en attente, elle sera prise au prochain lancement mobile.',
    ];
    if (firebaseSyncErrors.length > 0) {
      infoLines.push(`Attention Firebase: ${firebaseSyncErrors[0]}`);
    } else {
      infoLines.push('Comptes locaux synchronisés vers Firebase Auth.');
    }
    alert(infoLines.join('\n'));
  };

  const deleteUser = async (user: User) => {
    if (!window.confirm(`Supprimer l'utilisateur ${user.nomUtilisateur} ?`)) {
      return;
    }

    // 1. Supprimer de PostgreSQL via le backend
    await authFetch(apiUrl(`/api/auth/users/${user.idUtilisateur}`), { method: 'DELETE' });

    // 2. Supprimer de Firebase Realtime Database
    try {
      const blockedPayload: Partial<FirebaseUtilisateur> = {
        estBloque: true,
        source: 'web',
      };
      await firebaseSyncService.updateUtilisateur(user.idUtilisateur.toString(), blockedPayload);
      console.log('✅ Utilisateur marqué comme bloqué dans Firebase Realtime Database');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Erreur synchronisation Firebase:', errorMessage);
      // Ne pas bloquer l'opération si Firebase échoue, PostgreSQL a déjà été supprimé
    }

    await loadAll();
  };

  const unlockUser = async (id: number) => {
    await authFetch(apiUrl(`/api/auth/reset-lock/${id}`), { method: 'POST' });
    await loadAll();
  };

  const addPhotosToEditing = async (files: FileList | null) => {
    if (!editing || !files || files.length === 0) {
      return;
    }

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('Sélectionnez au moins une image valide.');
      return;
    }

    const encodedPhotos = await Promise.all(imageFiles.map((file) => fileToDataUrl(file)));
    const entries = encodedPhotos.map((url) => createPhotoEntry(url, 'manager-web'));
    setEditing((current) => (current ? { ...current, photos: [...current.photos, ...entries] } : current));
  };

  const handleEditingPhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    await addPhotosToEditing(event.target.files);
    event.target.value = '';
  };

  const removeEditingPhoto = (index: number) => {
    setEditing((current) => (current ? { ...current, photos: current.photos.filter((_, i) => i !== index) } : current));
  };

  const clearEditingPhotos = () => {
    setEditing((current) => (current ? { ...current, photos: [] } : current));
  };

  const saveReport = async () => {
    if (!editing) {
      return;
    }

    if (!editing.idUser.trim()) {
      alert('Identifiant utilisateur obligatoire');
      return;
    }

    const isCreate = editing.id <= 0;

    const sigPayload = {
      surface: editing.surface,
      latitude: editing.latitude,
      longitude: editing.longitude,
      idUser: editing.idUser.trim(),
      description: editing.description,
      statut: normalizeStatus(editing.statut),
      niveau: Math.min(10, Math.max(1, editing.niveau || 1)),
      photos: editing.photos,
      typeProbleme: editing.typeProbleme,
    };

    // 1. Sauvegarder dans PostgreSQL via le backend
    const sigRes = await authFetch(isCreate ? apiUrl('/api/signalements') : apiUrl(`/api/signalements/${editing.id}`), {
      method: isCreate ? 'POST' : 'PUT',
      body: JSON.stringify(sigPayload),
    });
    if (!sigRes.ok) {
      const errorText = await sigRes.text();
      throw new Error(errorText);
    }

    const sigData = await sigRes.json().catch(() => ({}));
    const signalementId = isCreate
      ? Number(sigData?.idSignalement || 0)
      : editing.id;

    if (!signalementId) {
      throw new Error('Signalement invalide après sauvegarde');
    }

    // 2. Synchroniser avec Firebase Realtime Database
    try {
      const firebasePayload: Omit<FirebaseSignalement, 'id' | 'dateSync'> = {
        idUser: editing.idUser.trim(),
        latitude: editing.latitude,
        longitude: editing.longitude,
        surface: editing.surface,
        niveau: editing.niveau || 1,
        typeProbleme: editing.typeProbleme,
        description: editing.description,
        statut: normalizeStatus(editing.statut),
        photos: editing.photos.map((photo) => photo.url).filter((url) => url.trim().length > 0),
        dateAjoute: editing.dateAjoute ? new Date(editing.dateAjoute) : new Date(),
        source: 'web',
        lieuNom: editing.lieuNom || '',
        lieuVille: editing.lieuVille || '',
        lieuDescription: editing.lieuDescription || '',
      };

      const firebaseSignalementKey = String(sigData?.firestoreId || signalementId);
      await firebaseSyncService.updateSignalement(firebaseSignalementKey, firebasePayload);
      console.log('✅ Signalement synchronisé avec Firebase Realtime Database');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Erreur synchronisation Firebase:', errorMessage);
      // Ne pas bloquer l'opération si Firebase échoue, PostgreSQL a déjà été mis à jour
    }

    // 3. Gérer les travaux si nécessaire
    if (editing.entrepriseId && editing.dateDebut) {
      const travauxPayload = {
        signalement: { idSignalement: signalementId },
        entreprise: { idEntreprise: editing.entrepriseId },
        dateDebutTravaux: toDateInput(editing.dateDebut),
        dateFinTravaux: toDateInput(editing.dateFin),
      };

      const travauxRes = editing.travauxId
        ? await authFetch(apiUrl(`/api/travaux/${editing.travauxId}`), {
            method: 'PUT',
            body: JSON.stringify(travauxPayload),
          })
        : await authFetch(apiUrl('/api/travaux'), {
            method: 'POST',
            body: JSON.stringify(travauxPayload),
          });

      if (!travauxRes.ok) {
        const errorText = await travauxRes.text();
        throw new Error(errorText);
      }

      // 4. Synchroniser les travaux avec Firebase Realtime Database
      try {
        const travauxData = await travauxRes.json().catch(() => ({}));
        const travauxId = editing.travauxId || travauxData?.id;

        if (travauxId) {
          const firebaseTravauxPayload: Omit<FirebaseTravaux, 'id' | 'dateSync'> = {
            signalementId: signalementId.toString(),
            description: editing.description,
            dateDebut: editing.dateDebut ? new Date(editing.dateDebut) : new Date(),
            dateFin: editing.dateFin ? new Date(editing.dateFin) : undefined,
            statut: normalizeStatus(editing.statut),
            entrepriseId: editing.entrepriseId,
            budget: editing.budget,
            avancement: editing.avancement,
            source: 'web',
          };

          const firebaseTravauxKey = String(travauxData?.firestoreId || travauxId);
          await firebaseSyncService.updateTravaux(firebaseTravauxKey, firebaseTravauxPayload);
          console.log('✅ Travaux synchronisés avec Firebase Realtime Database');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Erreur synchronisation Firebase travaux:', errorMessage);
        // Ne pas bloquer l'opération si Firebase échoue, PostgreSQL a déjà été mis à jour
      }
    }

    setEditing(null);
    await loadAll();
  };

  const deleteReport = async (id: number) => {
    if (!window.confirm(`Supprimer le signalement #${id} ?`)) {
      return;
    }

    // 1. Supprimer de PostgreSQL via le backend
    const response = await authFetch(apiUrl(`/api/signalements/${id}`), { method: 'DELETE' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    const report = reports.find((item) => item.id === id);
    const firebaseSignalementKey = report?.firestoreId ? String(report.firestoreId) : String(id);

    // 2. Supprimer de Firebase Realtime Database
    try {
      await firebaseSyncService.deleteSignalement(firebaseSignalementKey);
      console.log('✅ Signalement supprimé de Firebase Realtime Database');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Erreur suppression Firebase:', errorMessage);
      // Ne pas bloquer l'opération si Firebase échoue, PostgreSQL a déjà été supprimé
    }

    await loadAll();
  };

  const saveParam = async (cle: string) => {
    const valeur = (paramValues[cle] || '').trim();
    if (!valeur) {
      alert('Valeur vide non autorisée');
      return;
    }

    const response = await authFetch(apiUrl(`/api/auth/params/${cle}`), {
      method: 'PUT',
      body: JSON.stringify({ valeur }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    await loadAll();
  };

  const stats = useMemo(() => {
    const total = reports.length;
    const totalSurface = reports.reduce((acc, report) => acc + (Number(report.surface) || 0), 0);
    const totalBudget = reports.reduce((acc, report) => acc + (Number(report.budget) || calculateBudgetPreview(report.surface, report.niveau)), 0);
    const avgAvancement = total
      ? Math.round((reports.reduce((acc, report) => acc + (Number(report.avancement) || 0), 0) / total) * 100) / 100
      : 0;
    return { total, totalSurface, totalBudget, avgAvancement };
  }, [reports, prixM2]);

  return (
    <div className="dashboard-container">
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">RW</div>
          <span className="sidebar-title">RouteWatch</span>
        </div>

        <div className="nav-menu">
          <button className={`nav-item ${view === 'map' ? 'active' : ''}`} onClick={() => changeView('map')}>Carte</button>
          <button className={`nav-item ${view === 'users' ? 'active' : ''}`} onClick={() => changeView('users')}>Utilisateurs</button>
          <button className={`nav-item ${view === 'reports' ? 'active' : ''}`} onClick={() => changeView('reports')}>Signalements</button>
          <button className={`nav-item ${view === 'config' ? 'active' : ''}`} onClick={() => changeView('config')}>Configuration</button>
          <button className="nav-item" onClick={() => { window.location.href = '/analytics/criticality'; }}>Criticité</button>
          <button className="nav-item" onClick={() => { window.location.href = '/analytics/audit'; }}>Audit</button>
          <button className="nav-item" onClick={() => { window.location.href = '/analytics/impact'; }}>Impact</button>
          <button className="nav-item" onClick={() => { window.location.href = '/analytics/charts'; }}>Graphiques</button>
        </div>

        <button
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/';
          }}
        >
          Déconnexion
        </button>
      </nav>

      <main className="main-content">
        <div className="toolbar">
          <button className="btn btn-primary" onClick={() => runAction(() => syncFull())} disabled={syncing || loading}>
            {syncing ? 'Synchronisation...' : 'Synchroniser Realtime DB'}
          </button>
          <button className="btn btn-secondary" onClick={loadAll} disabled={loading || syncing}>
            {loading ? 'Chargement...' : 'Rafraîchir local'}
          </button>
        </div>

        {view === 'map' && (
          <div className="map-container" style={{ height: '70vh', minHeight: '500px' }}>
            <button className="btn btn-screenshot" onClick={() => {
              const mapContainer = document.querySelector('.map-container');
              if (mapContainer && (mapContainer as any).captureScreenshot) {
                (mapContainer as any).captureScreenshot();
              }
            }}>
              📸 Capturer
            </button>
            {!loading && reports.length === 0 && (
              <div className="tile-offline-warning">
                Aucun signalement disponible dans la base locale. Créez un signalement ou lancez la synchronisation
                depuis ce tableau de bord.
              </div>
            )}
            <ScreenshotCapture onCapture={handleScreenshotCapture}>
              <MapContainer
              center={[-18.8792, 47.5079]}
              zoom={MAP_DEFAULT_ZOOM}
              minZoom={MAP_MIN_ZOOM}
              maxZoom={MAP_MAX_ZOOM}
              zoomAnimation={false}
              fadeAnimation={false}
              markerZoomAnimation={false}
              maxBounds={ANTANANARIVO_BOUNDS}
              maxBoundsViscosity={0.85}
              zoomSnap={0.25}
              zoomDelta={0.5}
              wheelPxPerZoomLevel={95}
              style={{ height: '100%', width: '100%' }}
            >
              <OfflineVectorTileLayer url={TILE_URL} />
              <OfflinePlaceLabelsLayer url={TILE_URL} />
              {reports.map((report) => (
                <Marker key={report.id} position={[report.latitude, report.longitude]} icon={icons[report.typeProbleme || ''] || icons.default}>
                  <Popup className="custom-popup">
                    <div className="popup-content">
                      <div className="popup-row">
                        <span className="popup-label">Type</span>
                        <span className="popup-value">{getProblemTypeLabel(report.typeProbleme)}</span>
                      </div>
                      <div className="popup-row">
                        <span className="popup-label">Date</span>
                        <span className="popup-value">{report.dateAjoute.toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="popup-row">
                        <span className="popup-label">Statut</span>
                        <span className="popup-value">{statusLabel(report.statut)}</span>
                      </div>
                      <div className="popup-row">
                        <span className="popup-label">Niveau</span>
                        <span className="popup-value">{report.niveau}</span>
                      </div>
                      <div className="popup-row">
                        <span className="popup-label">Surface</span>
                        <span className="popup-value">{report.surface} m²</span>
                      </div>
                      <div className="popup-row">
                        <span className="popup-label">Budget</span>
                        <span className="popup-value">{(report.budget || calculateBudgetPreview(report.surface, report.niveau)).toLocaleString()} Ar</span>
                      </div>
                      <div className="popup-row">
                        <span className="popup-label">Avancement</span>
                        <span className="popup-value">{report.avancement || 0}%</span>
                      </div>
                      <div className="popup-row">
                        <span className="popup-label">Entreprise</span>
                        <span className="popup-value">{report.entrepriseNom || '-'}</span>
                      </div>
                      <div className="popup-row">
                        <span className="popup-label">Lieu</span>
                        <span className="popup-value">
                          {report.lieuNom || '-'}
                          {report.lieuVille ? ` (${report.lieuVille})` : ''}
                        </span>
                      </div>
                      {report.lieuDescription && (
                        <div className="popup-row" style={{ display: 'block', marginTop: 8 }}>
                          <span className="popup-label">Description du lieu</span>
                          <div className="popup-value" style={{ marginTop: 4 }}>
                            {report.lieuDescription}
                          </div>
                        </div>
                      )}
                      <div className="popup-row" style={{ display: 'block', marginTop: 8 }}>
                        <span className="popup-label">Description</span>
                        <div className="popup-value" style={{ marginTop: 4 }}>
                          {report.description || 'Aucune description'}
                        </div>
                      </div>
                      {report.photos.length > 0 && (
                        <div className="popup-row" style={{ display: 'block', marginTop: 8 }}>
                          <span className="popup-label">Photos</span>
                          <div className="popup-value" style={{ marginTop: 4 }}>
                            {report.photos.map((photo, index) => (
                              <a
                                key={`${report.id}-photo-${index}`}
                                href={photo.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'block' }}
                              >
                                Voir photo {index + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            </ScreenshotCapture>
          </div>
        )}

        {view === 'users' && (
          <div className="card">
            <h3>Comptes utilisateurs</h3>

            <div className="form-group">
              <input
                className="form-input"
                placeholder="Nom"
                value={userForm.nom}
                onChange={(event) => setUserForm({ ...userForm, nom: event.target.value })}
              />
            </div>

            <div className="form-group">
              <input
                className="form-input"
                placeholder="Email"
                value={userForm.email}
                onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
              />
            </div>

            <div className="form-group">
              <input
                className="form-input"
                placeholder={userForm.id ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'}
                value={userForm.password}
                onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
              />
            </div>

            <div className="form-group">
              <select
                className="form-input"
                value={userForm.role}
                onChange={(event) => setUserForm({ ...userForm, role: event.target.value as UserRole })}
              >
                <option value="UTILISATEUR">Non manager</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>

            <div className="toolbar">
              <button className="btn btn-primary" onClick={() => runAction(saveUser)}>Sauvegarder</button>
              {userForm.id > 0 && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setUserForm({ id: 0, nom: '', email: '', password: '', role: 'UTILISATEUR' })}
                >
                  Annuler
                </button>
              )}
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Mot de passe</th>
                  <th>Rôle</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.idUtilisateur}>
                    <td>{user.nomUtilisateur}</td>
                    <td>{user.email}</td>
                    <td>{user.motDePasse || '-'}</td>
                    <td>{user.role?.nom || '-'}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-icon"
                        onClick={() =>
                          setUserForm({
                            id: user.idUtilisateur,
                            nom: user.nomUtilisateur,
                            email: user.email,
                            password: '',
                            role: user.role?.nom?.toUpperCase() === 'MANAGER' ? 'MANAGER' : 'UTILISATEUR',
                          })
                        }
                      >
                        E
                      </button>{' '}
                      <button className="btn btn-danger btn-icon" onClick={() => runAction(() => deleteUser(user))}>
                        X
                      </button>{' '}
                      {user.estBloque && (
                        <button className="btn btn-success" onClick={() => runAction(() => unlockUser(user.idUtilisateur))}>
                          Débloquer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'reports' && (
          <div className="card">
            <h3>Signalements</h3>
            <div className="toolbar">
              <button className="btn btn-primary" onClick={() => setEditing(createEmptyReport())}>
                Nouveau signalement
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total points</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalSurface}</div>
                <div className="stat-label">Surface totale (m²)</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.avgAvancement}%</div>
                <div className="stat-label">Avancement moyen</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalBudget.toLocaleString()}</div>
                <div className="stat-label">Budget total (Ar)</div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <h4>Délai moyen de traitement</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Travaux clôturés</th>
                    <th>Délai moyen (jours)</th>
                    <th>Délai min</th>
                    <th>Délai max</th>
                    <th>Budget total (Ar)</th>
                    <th>Avancement moyen (%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{delayStats.completedCount}</td>
                    <td>{delayStats.averageDelayDays}</td>
                    <td>{delayStats.minDelayDays}</td>
                    <td>{delayStats.maxDelayDays}</td>
                    <td>{stats.totalBudget.toLocaleString()}</td>
                    <td>{stats.avgAvancement}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Surface</th>
                  <th>Niveau</th>
                  <th>Statut</th>
                  <th>Budget</th>
                  <th>Photos</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>{getProblemTypeLabel(report.typeProbleme)}</td>
                    <td>{report.surface}</td>
                    <td>{report.niveau}</td>
                    <td>{normalizeStatus(report.statut)}</td>
                    <td>{(report.budget || calculateBudgetPreview(report.surface, report.niveau)).toLocaleString()}</td>
                    <td>{report.photos.length}</td>
                    <td>
                      <button className="btn btn-secondary btn-icon" onClick={() => setEditing({ ...report })}>E</button>{' '}
                      <button className="btn btn-danger btn-icon" onClick={() => runAction(() => deleteReport(report.id))}>X</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {editing && (
              <div className="card" style={{ marginTop: 16 }}>
                <h4>{editing.id > 0 ? `Édition signalement #${editing.id}` : 'Création signalement'}</h4>

                <div className="form-group">
                  <input
                    className="form-input"
                    placeholder="Identifiant utilisateur (mobile/Firebase)"
                    value={editing.idUser}
                    onChange={(event) => setEditing({ ...editing, idUser: event.target.value })}
                  />
                </div>

                <div className="form-group">
                  <input
                    className="form-input"
                    type="number"
                    step="0.000001"
                    placeholder="Latitude"
                    value={editing.latitude}
                    onChange={(event) => setEditing({ ...editing, latitude: Number(event.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <input
                    className="form-input"
                    type="number"
                    step="0.000001"
                    placeholder="Longitude"
                    value={editing.longitude}
                    onChange={(event) => setEditing({ ...editing, longitude: Number(event.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <select
                    className="form-select"
                    value={editing.typeProbleme || 'autre'}
                    onChange={(event) => setEditing({ ...editing, typeProbleme: event.target.value })}
                  >
                    <option value="nid-de-poule">Nid de poule</option>
                    <option value="route-inondee">Route inondée</option>
                    <option value="route-endommagee">Route endommagée</option>
                    <option value="signalisation-manquante">Signalisation manquante</option>
                    <option value="eclairage-defectueux">Éclairage défectueux</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div className="form-group">
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={editing.surface}
                    onChange={(event) => setEditing({ ...editing, surface: Number(event.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={10}
                    value={editing.niveau}
                    onChange={(event) => setEditing({ ...editing, niveau: Number(event.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <textarea
                    className="form-textarea"
                    value={editing.description}
                    onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                  />
                </div>

                <div className="form-group">
                  <select
                    className="form-select"
                    value={normalizeStatus(editing.statut)}
                    onChange={(event) => setEditing({ ...editing, statut: event.target.value })}
                  >
                    <option value="nouveau">Nouveau</option>
                    <option value="en cours">En cours</option>
                    <option value="termine">Terminé</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Dossier photo (web + mobile)</label>
                  <input
                    className="form-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleEditingPhotoUpload}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    Format appliqué: <code>photos[] = {'{'}url, addedBy, addedAt{'}'}</code>
                  </div>
                  {editing.photos.length > 0 && (
                    <div style={{ marginTop: 10, border: '1px solid #dbcdf2', borderRadius: 10, padding: 10 }}>
                      {editing.photos.map((photo, index) => (
                        <div key={`${index}-${photo.url.slice(0, 20)}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <a href={photo.url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                            Photo {index + 1}
                          </a>
                          <span style={{ fontSize: 11, color: '#666' }}>
                            {photo.addedBy || 'unknown'} {photo.addedAt ? `| ${new Date(photo.addedAt).toLocaleString('fr-FR')}` : ''}
                          </span>
                          <button
                            type="button"
                            className="btn btn-danger btn-icon"
                            onClick={() => removeEditingPhoto(index)}
                            title="Supprimer photo"
                          >
                            X
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-secondary" onClick={clearEditingPhotos}>
                        Vider dossier photo
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <select
                    className="form-select"
                    value={editing.entrepriseId || ''}
                    onChange={(event) =>
                      setEditing({ ...editing, entrepriseId: Number(event.target.value) || undefined })
                    }
                  >
                    <option value="">Entreprise</option>
                    {entreprises.map((entreprise) => (
                      <option key={entreprise.idEntreprise} value={entreprise.idEntreprise}>
                        {entreprise.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <input
                    className="form-input"
                    type="date"
                    value={toDateInput(editing.dateDebut)}
                    onChange={(event) => setEditing({ ...editing, dateDebut: event.target.value })}
                  />
                </div>

                <div className="form-group">
                  <input
                    className="form-input"
                    type="date"
                    value={toDateInput(editing.dateFin)}
                    onChange={(event) => setEditing({ ...editing, dateFin: event.target.value })}
                  />
                </div>

                <div className="toolbar">
                  <button className="btn btn-primary" onClick={() => runAction(saveReport)}>Sauvegarder</button>
                  <button className="btn btn-secondary" onClick={() => setEditing(null)}>Annuler</button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'config' && (
          <div className="card">
            <h3>Paramètres</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Clé</th>
                  <th>Valeur</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {params.map((param) => (
                  <tr key={param.cle}>
                    <td>{param.cle}</td>
                    <td>
                      <input
                        className="form-input"
                        value={paramValues[param.cle] ?? ''}
                        onChange={(event) =>
                          setParamValues((current) => ({
                            ...current,
                            [param.cle]: event.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>{param.description}</td>
                    <td>
                      <button className="btn btn-primary" onClick={() => runAction(() => saveParam(param.cle))}>
                        Sauver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Budget automatique: prix_par_m2 ({prixM2}) x niveau x surface</p>
          </div>
        )}
        
        {/* Affichage des autres clients connectés */}
        {otherClients.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Autres clients connectés</h3>
            <div className="other-clients-list">
              {otherClients.map((client: any) => (
                <div key={client.clientId} className="client-item">
                  <span className="client-icon">{client.type === 'mobile' ? '📱' : '💻'}</span>
                  <span className="client-type">{client.type === 'mobile' ? 'Mobile' : 'Web'}</span>
                  <span className="client-id">{client.clientId}</span>
                  <span className="client-last-seen">Vu il y a {formatLastSeen(client.secondsSinceLastSeen)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      
      {/* Modal de demande de synchronisation */}
      {showSyncModal && (
        <div className="modal-overlay" onClick={() => setShowSyncModal(false)}>
          <div className="modal-content sync-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Demande de synchronisation</h3>
              <button className="modal-close" onClick={() => setShowSyncModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="sync-info">
                <div className="sync-icon">📱</div>
                <p>Une demande de synchronisation avec Firebase a été reçue depuis {syncRequest.source === "mobile" ? "l'application mobile" : "le web"}.</p>
                <p>Cela mettra à jour les données entre les deux services. Voulez-vous continuer ?</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSyncModal(false)}>
                Refuser
              </button>
              <button 
                className="btn btn-primary" 
                onClick={async () => {
                  setShowSyncModal(false);
                  setSyncRequest({ hasRequest: false });
                  await runAction(() => syncFull(false));
                  if (syncRequest.requestId) {
                    await ackPeerSync('web', Number(syncRequest.requestId));
                  }
                }}
              >
                Accepter et synchroniser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


