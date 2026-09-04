/**
 * Market sentiment provider — Stock (CNN) & Crypto (Alternative.me) Fear & Greed indices.
 *
 * Fetches both stock and crypto Fear & Greed indices through the server proxy
 * (/api/sentiment). Returns null when unavailable; callers should fall back to
 * the VIX-based estimate in that case.
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

export interface MarketSentimentResult {
  stock: FearGreedResult | null;
  crypto: FearGreedResult | null;
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

function parseFearGreedBody(body: { score?: number; rating?: string; previousClose?: number; error?: string }): FearGreedResult | null {
  if (body.error || typeof body.score !== 'number' || !isFinite(body.score)) return null;
  return {
    score: Math.round(body.score),
    rating: body.rating || 'Neutral (중립)',
    ...(typeof body.previousClose === 'number' && body.previousClose > 0
      ? { previousClose: Math.round(body.previousClose) }
      : {}),
  };
}

/**
 * Fetch both Stock (CNN) and Crypto (Alternative.me) Fear & Greed indices.
 */
export async function fetchMarketSentiment(): Promise<MarketSentimentResult> {
  try {
    const res = await fetchWithTimeout(`${MARKET_API_URL}/api/sentiment`, TIMEOUT_MS, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(MARKET_API_BEARER_TOKEN ? { authorization: `Bearer ${MARKET_API_BEARER_TOKEN}` } : {}),
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return { stock: null, crypto: null };

    const json = await res.json() as {
      stock?: { score?: number; rating?: string; previousClose?: number; error?: string };
      crypto?: { score?: number; rating?: string; previousClose?: number; error?: string };
    };

    return {
      stock: json.stock ? parseFearGreedBody(json.stock) : null,
      crypto: json.crypto ? parseFearGreedBody(json.crypto) : null,
    };
  } catch {
    return { stock: null, crypto: null };
  }
}

/**
 * Legacy: Fetch only the crypto Fear & Greed index (Alternative.me).
 * Kept for backward compatibility.
 */
export async function fetchFearGreedIndex(): Promise<FearGreedResult | null> {
  const result = await fetchMarketSentiment();
  return result.crypto;
}