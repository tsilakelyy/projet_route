const rawApiBaseUrl = (import.meta.env.VITE_API_URL || '').trim();
const rawTileUrl = (import.meta.env.VITE_TILE_URL || '').trim();
const rawStyleUrl = (import.meta.env.VITE_STYLE_URL || '').trim();

const fallbackApiBaseUrl = typeof window !== 'undefined'
  ? window.location.origin
  : '';

export const API_BASE_URL = (rawApiBaseUrl || fallbackApiBaseUrl).replace(/\/+$/, '');
export const TILE_URL = rawTileUrl || '/data/antananarivo/{z}/{x}/{y}.pbf';
export const STYLE_URL = rawStyleUrl || '/styles/bright/style.json';

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) {
    return normalizedPath;
  }

  // Avoid "/api/api/..." when API_BASE_URL already ends with "/api".
  if (/\/api$/i.test(API_BASE_URL) && /^\/api(\/|$)/i.test(normalizedPath)) {
    const trimmedPath = normalizedPath.slice(4);
    return `${API_BASE_URL}${trimmedPath || ''}`;
  }

  return `${API_BASE_URL}${normalizedPath}`;
};
