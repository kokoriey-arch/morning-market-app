/**
 * Korea Market Provider
 *
 * Provides an interface for Korean market data:
 *   - KOSPI 200 야간선물 (Night Futures)
 *   - KOSPI Composite
 *   - KOSDAQ (future)
 *
 * Current implementation: stub (returns cached/initial data).
 * Future: connect to the Kiwoom REST+WebSocket API.
 *
 * NOTE: Twelve Data does NOT support KRX futures on the free plan.
 * Do NOT claim real-time data when this stub is active.
 */

import { MarketItem } from '../../types/market';
import { get_kospi_index } from '../kis/domesticStockService';
import { getKOSPI200NightFutures } from './kospi200NightFuturesProvider';
import { fetchTwelveDataPrices } from './twelveDataProvider';

// This is an instrument identifier, not a credential. Leave it empty until the
// exact Kiwoom night-futures code is confirmed for the selected contract.
// ---------------------------------------------------------------------------
// Interface (implement with real provider when API keys are available)
// ---------------------------------------------------------------------------

export interface KoreaMarketData {
  /** KOSPI 200 야간선물 (KM200N / CME-Eurex linked) */
  nightFutures: Partial<MarketItem> | null;
  /** KOSPI Composite index for KOSPI open estimate */
  kospiCompositePrice: number | null;
  /** Data source label shown in the UI */
  dataSourceLabel: string;
}

export interface RealtimeUnsubscribeFn {
  (): void;
}

/**
 * Fetch latest Korean market data.
 * Returns null fields when no API key is configured.
 */
export async function getKoreaMarketData(): Promise<KoreaMarketData> {
  const [kospi, nightFuturesResult] = await Promise.all([
    get_kospi_index(),
    getKOSPI200NightFutures(),
  ]);

  let hasLiveKospi = Boolean(kospi && !kospi.isFallback && kospi.price > 0);
  let kospiPrice = hasLiveKospi ? kospi?.price ?? null : null;
  let dataSourceLabel = hasLiveKospi ? '키움 REST API' : '캐시 데이터 (실시간 미연결)';

  // Kiwoom unavailable (no credentials / network error): fall back to the
  // proxy's Yahoo (^KS11) quote so the KOSPI open estimate stays realistic
  // instead of showing a hardcoded placeholder level.
  if (!hasLiveKospi) {
    try {
      const quotes = await fetchTwelveDataPrices(['kospi_composite']);
      const quote = quotes.kospi_composite;
      if (quote && quote.price > 0) {
        kospiPrice = quote.price;
        hasLiveKospi = true;
        dataSourceLabel = 'Yahoo Finance (^KS11)';
      }
    } catch {
      // keep fallback label
    }
  }

  return {
    nightFutures: null,
    kospiCompositePrice: hasLiveKospi ? kospiPrice : null,
    dataSourceLabel,
  };
}

/**
 * Subscribe to real-time Korean market data via WebSocket.
 * Returns an unsubscribe function.
 * Currently a no-op stub.
 */
export function subscribeRealtime(
  _onUpdate: (data: KoreaMarketData) => void,
): RealtimeUnsubscribeFn {
  // TODO: Implement with Kiwoom WebSocket when API credentials are available.
  //
  // Example future implementation:
  //   const ws = new WebSocket('wss://openapi.kiwoom.com/...');
  //   ws.onmessage = (e) => { _onUpdate(parseKiwoomMessage(e.data)); };
  //   return () => ws.close();

  return () => {
    // no-op: no active connection
  };
}

/**
 * Unsubscribe from real-time updates.
 * Convenience alias — callers can also use the returned function from subscribeRealtime().
 */
export function unsubscribeRealtime(unsubFn: RealtimeUnsubscribeFn): void {
  unsubFn();
}

/**
 * Returns true if a real Korean market data API is configured.
 */
export function isKoreaMarketConnected(): boolean {
  return false;
}
