/**
 * Twelve Data API Provider
 *
 * Covers: US equities, US indices, FX (USD/KRW), crypto, VIX, WTI
 * Data is requested through the server proxy; provider credentials stay server-side.
 *
 * Free plan limits: 8 req/min, 800 req/day
 * Strategy: batch all symbols into one /price call to use only 1 request.
 */

import { Platform } from 'react-native';

const DEFAULT_MARKET_API_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const MARKET_API_URL = process.env.EXPO_PUBLIC_MARKET_API_URL ?? `http://${DEFAULT_MARKET_API_HOST}:8787`;
// Optional bearer token for a cloud-hosted proxy (see DEPLOYMENT.md).
const MARKET_API_BEARER_TOKEN = process.env.EXPO_PUBLIC_MARKET_API_TOKEN || '';
const TIMEOUT_MS = 8000;
const HISTORY_REQUEST_WINDOW_MS = 60_000;
const MAX_HISTORY_REQUESTS_PER_WINDOW = 5;
let historyWindowStartedAt = 0;
let historyRequestsInWindow = 0;

// ---------------------------------------------------------------------------
// Symbol mapping: appItemId -> Twelve Data symbol
// ---------------------------------------------------------------------------
export interface TwelveDataSymbolConfig {
  symbol: string;
  type: 'stock' | 'etf' | 'index' | 'forex' | 'crypto' | 'commodity';
}

export const TWELVE_DATA_SYMBOL_MAP: Record<string, TwelveDataSymbolConfig> = {
  nasdaq_comp:        { symbol: 'IXIC',    type: 'index' },
  sp500:              { symbol: 'SPX',     type: 'index' },
  dow_jones:          { symbol: 'DJI',     type: 'index' },
  phil_semiconductor: { symbol: 'SOX',     type: 'index' },
  tech_nvda:          { symbol: 'NVDA',    type: 'stock' },
  tech_tsla:          { symbol: 'TSLA',    type: 'stock' },
  tech_aapl:          { symbol: 'AAPL',    type: 'stock' },
  tech_tsm:           { symbol: 'TSM',     type: 'stock' },
  tech_msft:          { symbol: 'MSFT',    type: 'stock' },
  tech_skhy:          { symbol: 'SKHY',    type: 'stock' },  // ADR – may not be supported; fallback applied
  tech_mu:            { symbol: 'MU',      type: 'stock' },
  tech_sndk:          { symbol: 'SNDK',    type: 'stock' },  // may not be supported; fallback applied
  fx_usdkrw:          { symbol: 'USD/KRW', type: 'forex' },
  macro_vix:          { symbol: 'VIX',     type: 'index' },
  macro_wti:          { symbol: 'WTI/USD', type: 'commodity' },
  // KOSPI composite is served through the proxy's Yahoo fallback (^KS11);
  // Twelve Data's free plan does not cover KRX indices.
  kospi_composite:    { symbol: '^KS11',   type: 'index' },
  crypto_bitcoin:     { symbol: 'BTC/USD', type: 'crypto' },
  crypto_ethereum:    { symbol: 'ETH/USD', type: 'crypto' },
  crypto_solana:      { symbol: 'SOL/USD', type: 'crypto' },
  crypto_xrp:         { symbol: 'XRP/USD', type: 'crypto' },
  // macro_us10y / macro_us30y: NOT supported by Twelve Data free plan – handled by fallback in marketProvider
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TwelveDataQuote {
  price: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  /** intraday history points for sparkline */
  history: { time: string; value: number }[];
}

type PriceBatchResponse = Record<string, { price?: string; previousClose?: string; status?: string; code?: number; message?: string }>;

/** Live quote returned per item (previousClose is optional — Yahoo fallback supplies it). */
export interface TwelveDataLiveQuote {
  price: number;
  previousClose?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function isApiKeyConfigured(): boolean {
  return MARKET_API_URL.trim().length > 0;
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

// ---------------------------------------------------------------------------
// Batch price fetch — /price?symbol=A,B,C returns one JSON with all prices
// ---------------------------------------------------------------------------
async function fetchBatchPrices(itemIds: string[]): Promise<Record<string, TwelveDataLiveQuote | null>> {
  const result: Record<string, TwelveDataLiveQuote | null> = {};

  if (!isApiKeyConfigured()) {
    for (const id of itemIds) result[id] = null;
    return result;
  }

  const configs = itemIds
    .map((id) => ({ id, cfg: TWELVE_DATA_SYMBOL_MAP[id] }))
    .filter((x): x is { id: string; cfg: TwelveDataSymbolConfig } => !!x.cfg);

  if (configs.length === 0) {
    for (const id of itemIds) result[id] = null;
    return result;
  }

  try {
    const res = await fetchWithTimeout(`${MARKET_API_URL}/api/twelve-data`, TIMEOUT_MS, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(MARKET_API_BEARER_TOKEN ? { authorization: `Bearer ${MARKET_API_BEARER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ operation: 'prices', itemIds: configs.map((x) => x.id) }),
    });
    if (!res.ok) {
      for (const id of itemIds) result[id] = null;
      return result;
    }

    const json = await res.json() as PriceBatchResponse | { price?: string; previousClose?: string; status?: string };

    for (const { id, cfg } of configs) {
      try {
        // When only one symbol is requested the response is a flat object; for multiple it's nested.
        const entry = configs.length === 1
          ? (json as { price?: string; previousClose?: string })
          : (json as PriceBatchResponse)[cfg.symbol];

        if (!entry || (entry as { status?: string }).status === 'error' || !(entry as { price?: string }).price) {
          result[id] = null;
        } else {
          const parsed = parseFloat((entry as { price: string }).price);
          if (isNaN(parsed) || parsed <= 0) {
            result[id] = null;
          } else {
            const prevRaw = (entry as { previousClose?: string }).previousClose;
            const prev = prevRaw !== undefined ? parseFloat(prevRaw) : NaN;
            result[id] = isFinite(prev) && prev > 0
              ? { price: parsed, previousClose: prev }
              : { price: parsed };
          }
        }
      } catch {
        result[id] = null;
      }
    }
  } catch (e) {
    // Network error / timeout
    for (const { id } of configs) result[id] = null;
  }

  // Items not in TWELVE_DATA_SYMBOL_MAP also get null
  for (const id of itemIds) {
    if (!(id in result)) result[id] = null;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Intraday time series for sparkline — /time_series
// We only call this for items where we have a live price (to save quota)
// ---------------------------------------------------------------------------
async function fetchIntraday(
  itemId: string,
): Promise<{ time: string; value: number }[] | null> {
  if (!isApiKeyConfigured()) return null;

  const now = Date.now();
  if (now - historyWindowStartedAt >= HISTORY_REQUEST_WINDOW_MS) {
    historyWindowStartedAt = now;
    historyRequestsInWindow = 0;
  }
  if (historyRequestsInWindow >= MAX_HISTORY_REQUESTS_PER_WINDOW) return null;
  historyRequestsInWindow += 1;

  try {
    const res = await fetchWithTimeout(`${MARKET_API_URL}/api/twelve-data`, TIMEOUT_MS, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(MARKET_API_BEARER_TOKEN ? { authorization: `Bearer ${MARKET_API_BEARER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ operation: 'history', itemId }),
    });
    if (!res.ok) return null;

    const json = await res.json() as {
      status?: string;
      values?: { datetime: string; close: string }[];
    };
    if (json.status === 'error' || !Array.isArray(json.values)) return null;

    const points = json.values
      .slice()
      .reverse()
      .map((v) => {
        const close = parseFloat(v.close);
        if (isNaN(close)) return null;
        // v.datetime = "2025-09-03 14:30:00"
        const timePart = v.datetime.split(' ')[1] ?? '';
        const hhmm = timePart.slice(0, 5);
        return { time: hhmm, value: close };
      })
      .filter((p): p is { time: string; value: number } => p !== null);

    return points.length >= 2 ? points : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the latest price for all supported item IDs in a single batch call.
 * Returns null for items that are unsupported, rate-limited, or errored.
 */
export async function fetchTwelveDataPrices(
  itemIds: string[],
): Promise<Record<string, TwelveDataLiveQuote | null>> {
  return fetchBatchPrices(itemIds);
}

/**
 * Fetch intraday sparkline history for one item ID.
 * Returns null when the API key is missing or the symbol is unsupported.
 */
export async function fetchTwelveDataHistory(
  itemId: string,
): Promise<{ time: string; value: number }[] | null> {
  const cfg = TWELVE_DATA_SYMBOL_MAP[itemId];
  if (!cfg) return null;
  return fetchIntraday(itemId);
}

export function isTwelveDataConfigured(): boolean {
  return isApiKeyConfigured();
}
