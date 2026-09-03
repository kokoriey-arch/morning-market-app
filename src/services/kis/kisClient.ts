/**
 * Kiwoom Securities REST API client.
 *
 * Handles OAuth2 token issue, renewal, caching and unified HTTP requests.
 * Uses KIWOOM_APP_KEY and KIWOOM_SECRET_KEY from .env/app.config.js.
 */

import { Platform } from 'react-native';

const DEFAULT_PROXY_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const PROXY_BASE_URL = process.env.EXPO_PUBLIC_MARKET_API_URL || `http://${DEFAULT_PROXY_HOST}:8787`;
const TIMEOUT_MS = 8000;

export function isKiwoomConfigured(): boolean {
  return PROXY_BASE_URL.length > 0;
}

/**
 * Common POST request helper for Kiwoom REST endpoints.
 */
export async function kiwoomRequest<T>(options: {
  endpoint: string;
  apiId: string;
  body?: Record<string, unknown>;
}): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${PROXY_BASE_URL}/api/kiwoom`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: options.endpoint, apiId: options.apiId, body: options.body || {} }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return res.ok ? data as T : null;
  } catch {
    return null;
  }
}
