import { Http } from '@capacitor/http';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpClientRequestOptions {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: unknown;
  connectTimeout?: number;
  readTimeout?: number;
}

export interface HttpClientResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

const withQueryParams = (url: string, params?: Record<string, string>) => {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const urlObj = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });
  return urlObj.toString();
};

const parseMaybeJson = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
};

const toFetchBody = (data: unknown, headers?: Record<string, string>) => {
  if (data === undefined || data === null) {
    return undefined;
  }

  if (typeof data === 'string') {
    return data;
  }

  const contentType = Object.entries(headers || {}).find(
    ([key]) => key.toLowerCase() === 'content-type'
  )?.[1];

  if (contentType && contentType.includes('application/json')) {
    return JSON.stringify(data);
  }

  return JSON.stringify(data);
};

export const httpRequest = async <T = unknown>(
  options: HttpClientRequestOptions
): Promise<HttpClientResponse<T>> => {
  const finalUrl = withQueryParams(options.url, options.params);

  try {
    const response = await Http.request({
      method: options.method,
      url: finalUrl,
      headers: options.headers,
      data: options.data,
      connectTimeout: options.connectTimeout,
      readTimeout: options.readTimeout,
    });

    return {
      status: response.status,
      data: parseMaybeJson(response.data) as T,
      headers: (response.headers || {}) as Record<string, string>,
    };
  } catch {
    // Fallback for platforms where Capacitor HTTP plugin is unavailable (e.g. iOS SPM setup).
    const controller = new AbortController();
    const timeoutMs = options.connectTimeout ?? 5000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(finalUrl, {
        method: options.method,
        headers: options.headers,
        body:
          options.method === 'GET' || options.method === 'DELETE'
            ? undefined
            : toFetchBody(options.data, options.headers),
        signal: controller.signal,
      });

      const text = await response.text();
      const data = parseMaybeJson(text) as T;
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        data,
        headers,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
};

