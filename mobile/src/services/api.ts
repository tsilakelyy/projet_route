import { httpRequest } from './httpClient';
import { apiUrlAsync, refreshApiBaseUrl, getBackendStatus } from '../config/api';

/**
 * Service API pour les requÃªtes HTTP vers le backend
 * Ce service utilise automatiquement la dÃ©couverte du backend sur le rÃ©seau WiFi
 */

// Interface pour les options de requÃªte
interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
}

// Interface pour la rÃ©ponse API
interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

/**
 * Effectue une requÃªte GET vers l'API
 */
export const get = async <T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> => {
  const url = await apiUrlAsync(path);
  const response = await httpRequest({
    method: 'GET',
    url,
    headers: options?.headers,
    params: options?.params,
  });

  return {
    data: response.data as T,
    status: response.status,
    headers: response.headers as Record<string, string>,
  };
};

/**
 * Effectue une requÃªte POST vers l'API
 */
export const post = async <T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> => {
  const url = await apiUrlAsync(path);
  const response = await httpRequest({
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    params: options?.params,
    data: body,
  });

  return {
    data: response.data as T,
    status: response.status,
    headers: response.headers as Record<string, string>,
  };
};

/**
 * Effectue une requÃªte PUT vers l'API
 */
export const put = async <T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> => {
  const url = await apiUrlAsync(path);
  const response = await httpRequest({
    method: 'PUT',
    url,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    params: options?.params,
    data: body,
  });

  return {
    data: response.data as T,
    status: response.status,
    headers: response.headers as Record<string, string>,
  };
};

/**
 * Effectue une requÃªte DELETE vers l'API
 */
export const del = async <T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> => {
  const url = await apiUrlAsync(path);
  const response = await httpRequest({
    method: 'DELETE',
    url,
    headers: options?.headers,
    params: options?.params,
  });

  return {
    data: response.data as T,
    status: response.status,
    headers: response.headers as Record<string, string>,
  };
};

/**
 * RafraÃ®chit la connexion au backend
 */
export const refreshConnection = async () => {
  return await refreshApiBaseUrl();
};

/**
 * VÃ©rifie l'Ã©tat de la connexion au backend
 */
export const checkConnection = async () => {
  return await getBackendStatus();
};


