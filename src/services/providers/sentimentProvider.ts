/**
 * Market sentiment provider — CNN Fear & Greed index.
 *
 * Fetches the widely-cited CNN Fear & Greed index through the server proxy
 * (/api/sentiment), so the gauge matches the published value instead of a
 * VIX-only approximation. Returns null when unavailable; callers should fall
 * back to the VIX-based estimate in that case.
 */

import { Platform } from 'react-native';

const DEFAULT_MARKET_API_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const MARKET_API_URL = process.env.EXPO_PUBLIC_MARKET_API_URL ?? `http://${DEFAULT_MARKET_API_HOST}:8787`;
// Optional bearer token for a cloud-hosted proxy (see DEPLOYMENT.md).
const MARKET_API_BEARER_TOKEN = process.env.EXPO_PUBLIC_MARKET_API_TOKEN || '';
const TIMEOUT_MS = 8000;

export interface FearGreedResult {
  score: number;
  rating: string;
  previousClose?: number;
}

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFearGreedIndex(): Promise<FearGreedResult | null> {
  try {
    // The proxy only accepts POST on its API routes — a GET would 404 and
    // silently drop us back to the VIX-based estimate.
    const res = await fetchWithTimeout(`${MARKET_API_URL}/api/sentiment`, TIMEOUT_MS, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(MARKET_API_BEARER_TOKEN ? { authorization: `Bearer ${MARKET_API_BEARER_TOKEN}` } : {}),
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;

    const json = await res.json() as { score?: number; rating?: string; previousClose?: number; error?: string };
    if (json.error || typeof json.score !== 'number' || !isFinite(json.score)) return null;

    return {
      score: Math.round(json.score),
      rating: json.rating || 'Neutral (중립)',
      ...(typeof json.previousClose === 'number' && json.previousClose > 0
        ? { previousClose: Math.round(json.previousClose) }
        : {}),
    };
  } catch {
    return null;
  }
}