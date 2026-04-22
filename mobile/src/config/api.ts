import { Capacitor } from '@capacitor/core';
import { httpRequest } from '../services/httpClient';

// Configuration pour la d??couverte automatique du backend
const BACKEND_DISCOVERY_PATH = '/api/auth/test';
const DISCOVERY_TIMEOUT = 1000; // 1000ms pour permettre une meilleure d??tection du backend

const PRIORITY_IP_SUFFIXES = ['1', '2', '100', '254'];
const COMMON_IP_SUFFIXES = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '30', '40', '50', '60', '70', '80',
  '90', '100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200',
  '210', '220', '230', '240', '250', '251', '252', '253', '254',
];
const COMMON_PRIVATE_RANGES = [
  '192.168.0', '192.168.1', '192.168.2', '192.168.3', '192.168.4', '192.168.5',
  '192.168.10', '192.168.20', '192.168.50', '192.168.100', '192.168.137',
  '10.0', '10.1', '10.2', '10.5', '10.10', '10.20',
  '172.16', '172.17', '172.18', '172.19', '172.20',
  '172.21', '172.22', '172.23', '172.24', '172.25', '172.26', '172.27', '172.28', '172.29', '172.30', '172.31',
];
const rawApiBaseUrl = (import.meta.env.VITE_API_URL || '').trim();
const apiHost = import.meta.env.VITE_API_HOST || 'localhost';
const apiPort = import.meta.env.VITE_API_PORT || '8082';
const rawTileUrl = (import.meta.env.VITE_TILE_URL || '').trim();
const rawVectorTileUrl = (import.meta.env.VITE_VECTOR_TILE_URL || '').trim();
const joinBackendUrl = (baseUrl: string, path: string): string => {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (/\/api$/i.test(normalizedBase) && /^\/api(\/|$)/i.test(normalizedPath)) {
    const trimmedPath = normalizedPath.slice(4);
    return `${normalizedBase}${trimmedPath || ''}`;
  }

  return `${normalizedBase}${normalizedPath}`;
};
const getManualApiBaseUrl = (): string | null => {
  try {
    const value = localStorage.getItem('mobile_api_base_url');
    if (!value) return null;
    const trimmed = value.trim().replace(/\/+$/, '');
    return trimmed || null;
  } catch {
    return null;
  }
};

export const setManualApiBaseUrl = (baseUrl: string) => {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) {
    localStorage.removeItem('mobile_api_base_url');
    cachedApiBaseUrl = null;
    cachedApiHost = null;
    return;
  }
  localStorage.setItem('mobile_api_base_url', normalized);
  cachedApiBaseUrl = normalized;
  try {
    const urlObj = new URL(normalized);
    cachedApiHost = urlObj.hostname;
  } catch {
    cachedApiHost = null;
  }
};

export const clearManualApiBaseUrl = () => {
  try {
    localStorage.removeItem('mobile_api_base_url');
  } catch {
    // no-op
  }
  cachedApiBaseUrl = null;
  cachedApiHost = null;
};

// Interface pour le r??sultat de la d??couverte
interface BackendDiscoveryResult {
  found: boolean;
  url?: string;
  error?: string;
}

// Fonction pour v??rifier si une URL est accessible
const checkUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await httpRequest({
      method: 'GET',
      url: joinBackendUrl(url, BACKEND_DISCOVERY_PATH),
      connectTimeout: DISCOVERY_TIMEOUT,
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

/**
 * Fonction pour obtenir l'adresse IP locale de l'appareil
 * Note: Cette fonction utilise une approche heuristique pour d??terminer l'adresse IP locale
 * Sur Capacitor, nous ne pouvons pas acc??der directement aux interfaces r??seau,
 * donc nous utilisons une liste de plages IP courantes
 */
const getLocalIpAddress = async (): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) {
    return 'localhost';
  }

  // iOS and Android do not expose LAN interfaces directly in JS; probe common private ranges.
  for (const range of COMMON_PRIVATE_RANGES) {
    for (const suffix of PRIORITY_IP_SUFFIXES) {
      const ip = `${range}.${suffix}`;
      const url = `http://${ip}:${apiPort}`;
      const isAccessible = await checkUrl(url);
      if (isAccessible) {
        return ip;
      }
    }
  }

  return null;
};

const discoverBackend = async (): Promise<BackendDiscoveryResult> => {
  if (!Capacitor.isNativePlatform()) {
    const localUrl = `http://${apiHost}:${apiPort}`;
    const isAccessible = await checkUrl(localUrl);

    if (isAccessible) {
      return { found: true, url: localUrl };
    }

    return { found: false, error: 'Backend non trouve sur localhost' };
  }

  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    // Android emulator -> host machine bridge.
    const emulatorUrl = `http://10.0.2.2:${apiPort}`;
    const isEmulatorAccessible = await checkUrl(emulatorUrl);
    if (isEmulatorAccessible) {
      return { found: true, url: emulatorUrl };
    }
  }

  if (platform === 'ios' && (apiHost === 'localhost' || apiHost === '127.0.0.1')) {
    // iOS simulator can usually reach host services via localhost.
    const simulatorCandidates = [`http://localhost:${apiPort}`, `http://127.0.0.1:${apiPort}`];
    for (const candidate of simulatorCandidates) {
      const isAccessible = await checkUrl(candidate);
      if (isAccessible) {
        return { found: true, url: candidate };
      }
    }
  }

  const localIp = await getLocalIpAddress();
  if (localIp && localIp !== 'localhost') {
    const parts = localIp.split('.');
    if (parts.length === 4) {
      const subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
      const otherIps = Array.from({ length: 254 }, (_, i) => String(i + 1))
        .filter((ip) => !PRIORITY_IP_SUFFIXES.includes(ip));

      for (const suffix of [...PRIORITY_IP_SUFFIXES, ...otherIps]) {
        const url = `http://${subnetPrefix}.${suffix}:${apiPort}`;
        const isAccessible = await checkUrl(url);
        if (isAccessible) {
          return { found: true, url };
        }
      }
    }
  }

  for (const range of COMMON_PRIVATE_RANGES) {
    for (const suffix of COMMON_IP_SUFFIXES) {
      const url = `http://${range}.${suffix}:${apiPort}`;
      const isAccessible = await checkUrl(url);
      if (isAccessible) {
        return { found: true, url };
      }
    }
  }

  const defaultUrl = `http://${apiHost}:${apiPort}`;
  const isAccessible = await checkUrl(defaultUrl);
  if (isAccessible) {
    return { found: true, url: defaultUrl };
  }

  return {
    found: false,
    error: `Backend non trouve automatiquement (${platform}). Configurez une URL manuelle si besoin.`,
  };
};

const getBackendUrlWithRetry = async (retries = 3): Promise<BackendDiscoveryResult> => {
  for (let i = 0; i < retries; i++) {
    const result = await discoverBackend();

    if (result.found && result.url) {
      return result;
    }

    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  return { found: false, error: 'Impossible de se connecter au backend apres plusieurs tentatives' };
};

let cachedApiHost: string | null = null;

const resolveApiHost = async (): Promise<string> => {
  if (!Capacitor.isNativePlatform()) {
    return apiHost;
  }

  // On native builds, localhost points to the device itself.
  if (apiHost === 'localhost' || apiHost === '127.0.0.1') {
    const discoveryResult = await getBackendUrlWithRetry(3);

    if (discoveryResult.found && discoveryResult.url) {
      try {
        const urlObj = new URL(discoveryResult.url);
        cachedApiHost = urlObj.hostname;
        return cachedApiHost;
      } catch {
        // fallback below
      }
    }

    const possibleIps = [
      ...(Capacitor.getPlatform() === 'android' ? ['10.0.2.2'] : []),
      '0.0.0.0',
      '192.168.1.1', '192.168.1.2', '192.168.1.100', '192.168.1.254',
      '192.168.0.1', '192.168.0.2', '192.168.0.100', '192.168.0.254',
      '192.168.2.1', '192.168.2.2', '192.168.2.100', '192.168.2.254',
    ];

    for (const ip of possibleIps) {
      try {
        const response = await httpRequest({
          method: 'GET',
          url: joinBackendUrl(`http://${ip}:${apiPort}`, BACKEND_DISCOVERY_PATH),
          connectTimeout: 2000,
        });

        if (response.status === 200) {
          cachedApiHost = ip;
          return cachedApiHost;
        }
      } catch {
        // try next candidate
      }
    }

    cachedApiHost = Capacitor.getPlatform() === 'android' ? '10.0.2.2' : apiHost;
    return cachedApiHost || apiHost;
  }

  return apiHost;
};

let cachedApiBaseUrl: string | null = null;

const getApiBaseUrl = async (): Promise<string> => {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  const manualBaseUrl = getManualApiBaseUrl();
  if (manualBaseUrl) {
    cachedApiBaseUrl = manualBaseUrl;
    return cachedApiBaseUrl;
  }

  if (!Capacitor.isNativePlatform()) {
    cachedApiBaseUrl = API_BASE_URL;
    return API_BASE_URL;
  }

  const discoveryResult = await getBackendUrlWithRetry(3);
  if (discoveryResult.found && discoveryResult.url) {
    cachedApiBaseUrl = discoveryResult.url;
    return cachedApiBaseUrl;
  }

  const resolvedHost = await resolveApiHost();
  cachedApiBaseUrl = `http://${resolvedHost}:${apiPort}`;
  return cachedApiBaseUrl;
};

// Fallback pour le cas synchrone (utilis? dans les imports)
const resolveApiHostSync = () => {
  if (!Capacitor.isNativePlatform()) {
    return apiHost;
  }

  // On Android native builds, localhost points to the device itself.
  if ((apiHost === 'localhost' || apiHost === '127.0.0.1') && Capacitor.getPlatform() === 'android') {
    return '10.0.2.2';
  }

  return apiHost;
};

const fallbackApiBaseUrl = `http://${resolveApiHostSync()}:${apiPort}`;
const fallbackTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const fallbackVectorTileUrl = '';

export const API_BASE_URL = (rawApiBaseUrl || fallbackApiBaseUrl).replace(/\/+$/, '');
export const TILE_URL = rawTileUrl || fallbackTileUrl;
export const VECTOR_TILE_URL = rawVectorTileUrl || fallbackVectorTileUrl;
export const ENABLE_VECTOR_TILE_LAYER = Boolean(rawVectorTileUrl);

// Version synchrone pour les cas o?? async n'est pas support??
export const apiUrl = (path: string) => {
  const base = (getManualApiBaseUrl() || cachedApiBaseUrl || API_BASE_URL).replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Avoid "/api/api/..." when VITE_API_URL is "/api" and callers already use "/api/...".
  if (/\/api$/i.test(base) && /^\/api(\/|$)/i.test(normalizedPath)) {
    const trimmedPath = normalizedPath.slice(4);
    return `${base}${trimmedPath || ''}`;
  }

  return `${base}${normalizedPath}`;
};

// Version asynchrone pour les cas o?? la d??tection automatique est n??cessaire
export const apiUrlAsync = async (path: string) => {
  const base = (await getApiBaseUrl()).replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Avoid "/api/api/..." when VITE_API_URL is "/api" and callers already use "/api/...".
  if (/\/api$/i.test(base) && /^\/api(\/|$)/i.test(normalizedPath)) {
    const trimmedPath = normalizedPath.slice(4);
    return `${base}${trimmedPath || ''}`;
  }

  return `${base}${normalizedPath}`;
};

/**
 * Fonction pour rafra??chir le cache de l'URL de base de l'API
 * Cette fonction force une nouvelle d??couverte du backend
 */
export const refreshApiBaseUrl = async () => {
  cachedApiBaseUrl = null;
  cachedApiHost = null;
  return await getApiBaseUrl();
};

/**
 * Fonction pour obtenir l'??tat de la connexion au backend
 */
export const getBackendStatus = async () => {
  try {
    const baseUrl = await getApiBaseUrl();
    const response = await httpRequest({
      method: 'GET',
      url: joinBackendUrl(baseUrl, BACKEND_DISCOVERY_PATH),
      connectTimeout: 2000,
    });

    return {
      connected: response.status === 200,
      url: baseUrl,
      error: response.status !== 200 ? 'Backend non accessible' : undefined
    };
  } catch (error) {
    return {
      connected: false,
      url: cachedApiBaseUrl || API_BASE_URL,
      error: 'Erreur de connexion au backend'
    };
  }
};

















