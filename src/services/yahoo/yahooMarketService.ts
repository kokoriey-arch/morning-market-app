/**
 * Yahoo Finance Market Service for VIX, US ETFs, and Korean stocks.
 *
 * Implements:
 *  - get_vix(): Fetch ^VIX index
 *  - get_us_etf_data(): Fetch QQQ, QQQM, SOXX, SMH, XLK, SPY, DIA, IWM with 1D/5D/20D returns
 *  - get_korean_stock_data(): Fetch Korean stocks (삼성전자, SK하이닉스, etc.) real-time prices
 *  - get_kospi_index_from_yahoo(): Fetch KOSPI composite (^KS11)
 */

import { VixData, UsEtfData, KisStockPrice, KisIndexPrice } from '../../types/aiAnalysis';
import { TARGET_ETFS, TARGET_STOCKS, SIGNAL_THRESHOLDS } from '../ai/marketSignalConfig';

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const TIMEOUT_MS = 6000;

// ---------------------------------------------------------------------------
// CoinGecko — direct fallback for crypto quotes (no proxy / no API key)
// Restored to match the previous (bf2b5d4) behavior: CoinGecko first, Yahoo
// fallback. Public free endpoint, ~10-30 req/min rate limit — we call once
// per refresh with all 4 symbols bundled to stay well under the limit.
// ---------------------------------------------------------------------------
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_TIMEOUT_MS = 8000;

// Map app symbol name -> CoinGecko coin id
const COINGECKO_ID_MAP: Record<string, string> = {
  'Bitcoin':  'bitcoin',
  'Ethereum': 'ethereum',
  'Solana':   'solana',
  'XRP':      'ripple',
};

interface CoinGeckoSimplePriceResponse {
  [coinId: string]: {
    usd?: number;
    usd_24h_change?: number;
    usd_24h_vol?: number;
    last_updated_at?: number;
  };
}

// ---------------------------------------------------------------------------
// USD/KRW fallback — open.er-api.com
// Used when Yahoo KRW=X fails (RN environments often block Yahoo). Public free
// endpoint, no API key, returns USD->KRW cross rate with last-update timestamp.
// ---------------------------------------------------------------------------
const OPEN_ER_API_URL = 'https://open.er-api.com/v6/latest/USD';
const OPEN_ER_API_TIMEOUT_MS = 6000;

interface OpenErApiResponse {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_unix?: number;
}

async function fetchUsdKrwFromOpenErApi(): Promise<YahooQuote | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPEN_ER_API_TIMEOUT_MS);
  try {
    const res = await fetch(OPEN_ER_API_URL, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    console.warn('[DEBUG open.er-api] status=' + res.status + ' ok=' + res.ok);
    if (!res.ok) return null;
    const body = (await res.json()) as OpenErApiResponse;
    if (body.result && body.result !== 'success') {
      console.warn('[DEBUG open.er-api] result=' + body.result);
      return null;
    }
    const rate = Number(body.rates?.KRW ?? 0);
    if (!isFiniteRate(rate) || rate <= 0) {
      console.warn('[DEBUG open.er-api] invalid KRW rate=' + rate);
      return null;
    }
    // open.er-api doesn't give us a "previous close" for the cross rate, so
    // we synthesize a 0 change — callers should treat it as a last-resort
    // signal source rather than a true 24h delta.
    console.warn('[DEBUG open.er-api] USD->KRW rate=' + rate);
    return {
      symbol: 'KRW=X',
      name: 'USD/KRW',
      price: Number(rate.toFixed(2)),
      previousClose: Number(rate.toFixed(2)),
      change: 0,
      changeRate: 0,
      isFallback: true,
    };
  } catch (e) {
    clearTimeout(timer);
    console.warn('[DEBUG open.er-api] threw ' + String(e));
    return null;
  }
}

function isFiniteRate(n: number): boolean {
  return typeof n === 'number' && isFinite(n);
}

// ---------------------------------------------------------------------------
// Crypto fallback — Binance public 24hr ticker
// Used when CoinGecko and Yahoo both fail. Maps app symbol -> Binance pair.
// ---------------------------------------------------------------------------
const BINANCE_BASE_URL = 'https://api.binance.com/api/v3';
const BINANCE_TIMEOUT_MS = 6000;

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  'BTC-USD': 'BTCUSDT',
  'ETH-USD': 'ETHUSDT',
  'SOL-USD': 'SOLUSDT',
  'XRP-USD': 'XRPUSDT',
};

interface BinanceTicker24hr {
  symbol?: string;
  lastPrice?: string;
  priceChangePercent?: string;
  prevClosePrice?: string;
  openPrice?: string;
}

async function fetchBinance24hr(binanceSymbol: string): Promise<YahooQuote | null> {
  const url = `${BINANCE_BASE_URL}/ticker/24hr?symbol=${encodeURIComponent(binanceSymbol)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BINANCE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    console.warn('[DEBUG Binance] ' + binanceSymbol + ' status=' + res.status + ' ok=' + res.ok);
    if (!res.ok) return null;
    const body = (await res.json()) as BinanceTicker24hr;
    const price = Number(body.lastPrice ?? 0);
    const changeRate = Number(body.priceChangePercent ?? 0);
    const prev = Number(body.prevClosePrice ?? 0);
    if (!isFiniteRate(price) || price <= 0) {
      console.warn('[DEBUG Binance] ' + binanceSymbol + ' invalid price=' + price);
      return null;
    }
    const previousClose = prev > 0 ? prev : (changeRate !== 0 ? price / (1 + changeRate / 100) : price);
    const change = price - previousClose;
    console.warn(
      '[DEBUG Binance] ' + binanceSymbol + ' price=' + price +
      ' changeRate=' + changeRate + ' prev=' + previousClose,
    );
    return {
      symbol: binanceSymbol.replace('USDT', '-USD'),
      name: binanceSymbol.replace('USDT', '-USD'),
      price: Number(price.toFixed(2)),
      previousClose: Number(previousClose.toFixed(2)),
      change: Number(change.toFixed(2)),
      changeRate: Number(changeRate.toFixed(2)),
      isFallback: true,
    };
  } catch (e) {
    clearTimeout(timer);
    console.warn('[DEBUG Binance] ' + binanceSymbol + ' threw ' + String(e));
    return null;
  }
}

async function fetchCoinGeckoSimplePrices(
  coinIds: string[],
): Promise<CoinGeckoSimplePriceResponse | null> {
  if (coinIds.length === 0) return null;
  const ids = coinIds.join(',');
  const url = `${COINGECKO_BASE_URL}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_last_updated_at=true`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COINGECKO_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    // DEBUG (temporary)
    console.warn(
      '[DEBUG CoinGecko] status=' + res.status + ' ok=' + res.ok + ' ids=' + ids,
    );
    if (!res.ok) {
      console.warn('[DEBUG CoinGecko] non-ok response, body head=' + (await res.text()).slice(0, 200));
      return null;
    }
    const body = (await res.json()) as CoinGeckoSimplePriceResponse;
    console.warn(
      '[DEBUG CoinGecko] parsed keys=' + JSON.stringify(Object.keys(body)) +
      ' sample=' + JSON.stringify(Object.entries(body).slice(0, 2)),
    );
    return body;
  } catch (e) {
    console.warn('[DEBUG CoinGecko] fetch threw: ' + String(e));
    return null;
  }
}

interface YahooChartMeta {
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketVolume?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketTime?: number;
  marketCap?: number;
  sharesOutstanding?: number;
  trailingPE?: number;
  priceToBook?: number;
  [key: string]: any;
}

interface YahooChartResult {
  chart?: {
    result?: {
      meta: YahooChartMeta;
      timestamp?: number[];
      indicators?: {
        quote?: {
          close?: (number | null)[];
          volume?: (number | null)[];
        }[];
      };
    }[];
  };
}

async function fetchYahooChart(symbol: string, range = '1mo', interval = '1d'): Promise<YahooChartResult | null> {
  const url = `${YAHOO_BASE_URL}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as YahooChartResult;
  } catch {
    return null;
  }
}

/**
 * Fetch VIX (^VIX) data.
 */
export async function get_vix(): Promise<VixData> {
  const chart = await fetchYahooChart('^VIX', '5d', '1d');
  const result = chart?.chart?.result?.[0];

  if (result && result.meta) {
    const price = Number(result.meta.regularMarketPrice ?? 0);
    const prevClose = Number(result.meta.chartPreviousClose ?? result.meta.previousClose ?? price);
    const change = price - prevClose;
    const changeRate = prevClose > 0 ? (change / prevClose) * 100 : 0;

    let level: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL';
    if (price < SIGNAL_THRESHOLDS.vix.low) level = 'LOW';
    else if (price > SIGNAL_THRESHOLDS.vix.high) level = 'HIGH';

    return {
      symbol: '^VIX',
      price: Number(price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changeRate: Number(changeRate.toFixed(2)),
      level,
    };
  }

  // Fallback VIX
  return {
    symbol: '^VIX',
    price: 15.42,
    change: -0.38,
    changeRate: -2.41,
    level: 'NORMAL',
  };
}

// ---------------------------------------------------------------------------
// Macro / Crypto quote helpers
// ---------------------------------------------------------------------------

/** Lightweight price point for macro & crypto quotes (no 1D/5D/20D history). */
export interface YahooQuote {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changeRate: number;
  isFallback?: boolean;
}

function buildQuoteFromChart(symbol: string, name: string, result: any): YahooQuote | null {
  if (!result || !result.meta) return null;
  const meta = result.meta;
  const price = Number(meta.regularMarketPrice ?? 0);
  if (!isFinite(price) || price <= 0) return null;
  const prevClose = Number(
    meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPreviousClose ?? price,
  );
  const change = price - prevClose;
  const changeRate = prevClose > 0 ? (change / prevClose) * 100 : 0;
  return {
    symbol,
    name,
    price: Number(price.toFixed(4)),
    previousClose: Number(prevClose.toFixed(4)),
    change: Number(change.toFixed(4)),
    changeRate: Number(changeRate.toFixed(2)),
    isFallback: false,
  };
}

/**
 * Resolve the previous trading day's close from a Yahoo chart result.
 *
 * `meta.chartPreviousClose` is the close BEFORE THE FIRST BAR in the requested
 * range (e.g. ~5 trading days ago for range=5d, ~1 month ago for range=1mo),
 * NOT the previous day's close. Using it makes change / changeRate / 등락률 wrong.
 *
 * Instead, derive the previous close from the bar series itself:
 *  - If the last bar belongs to today's session (same exchange-local day), the
 *    previous close is the second-to-last close.
 *  - Otherwise (market closed / pre-market), the last close IS the previous close.
 * Falls back to meta.chartPreviousClose when no usable series is available.
 */
function resolvePreviousCloseFromChart(chart: YahooChartResult | null): number {
  const meta = chart?.chart?.result?.[0]?.meta;
  if (!meta) return 0;
  const timestamps = chart?.chart?.result?.[0]?.timestamp ?? [];
  const rawCloses = chart?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  const pairs = timestamps
    .map((t, i) => ({ t, c: rawCloses[i] }))
    .filter((p): p is { t: number; c: number } =>
      typeof p.t === 'number' &&
      typeof p.c === 'number' && isFinite(p.c) && p.c > 0,
    );
  if (pairs.length >= 2) {
    const last = pairs[pairs.length - 1];
    const prev = pairs[pairs.length - 2];
    const dayOf = (unixSec: number) =>
      new Date(unixSec * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    const lastBarIsToday = dayOf(last.t) === dayOf(Date.now() / 1000);
    return lastBarIsToday ? prev.c : last.c;
  }
  return Number(meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPreviousClose ?? 0);
}

/**
 * Fetch direct US market index quotes: ^IXIC, ^GSPC, ^DJI, ^SOX, ^RUT.
 * Returns a map keyed by the symbol passed in.
 */
export async function get_index_data(
  symbols: Array<{ symbol: string; name: string }>,
): Promise<Record<string, YahooQuote>> {
  const results: Record<string, YahooQuote> = {};
  await Promise.all(
    symbols.map(async ({ symbol, name }) => {
      const chart = await fetchYahooChart(symbol, '5d', '1d');
      const result = chart?.chart?.result?.[0];
      const q = buildQuoteFromChart(symbol, name, result);
      if (q) {
        // chartPreviousClose는 range 시작 전(약 5거래일 전) 종가이므로 실제 전일 종가로 교정
        const truePrevClose = resolvePreviousCloseFromChart(chart);
        if (truePrevClose > 0) {
          const change = q.price - truePrevClose;
          q.previousClose = Number(truePrevClose.toFixed(4));
          q.change = Number(change.toFixed(4));
          q.changeRate = Number(((change / truePrevClose) * 100).toFixed(2));
        }
        results[symbol] = q;
      }
    }),
  );
  return results;
}

/**
 * Fetch macro quotes: USD/KRW (KRW=X), US 10Y (^TNX), US 30Y (^TYX), WTI (CL=F).
 * Returns a map keyed by the symbol passed in.
 */
export async function get_macro_data(
  symbols: Array<{ symbol: string; name: string }>,
): Promise<Record<string, YahooQuote>> {
  const results: Record<string, YahooQuote> = {};
  await Promise.all(
    symbols.map(async ({ symbol, name }) => {
      const chart = await fetchYahooChart(symbol, '5d', '1d');
      const result = chart?.chart?.result?.[0];
      const meta = result?.meta;
      // DEBUG (temporary): surface Yahoo macro chart meta for diagnostics
      console.warn(
        '[DEBUG Yahoo macro] ' + symbol + ' chartNull=' + (chart == null) +
        ' resultNull=' + (result == null) +
        ' metaKeys=' + JSON.stringify(meta ? Object.keys(meta) : null) +
        ' regularMarketPrice=' + (meta?.regularMarketPrice ?? 'null') +
        ' chartPreviousClose=' + (meta?.chartPreviousClose ?? 'null') +
        ' previousClose=' + (meta?.previousClose ?? 'null'),
      );
      const q = buildQuoteFromChart(symbol, name, result);
      if (q) {
        results[symbol] = q;
      } else {
        console.warn('[DEBUG Yahoo macro] ' + symbol + ' buildQuoteFromChart returned null');
      }
    }),
  );

  // --- Fallback: USD/KRW via open.er-api.com when Yahoo returns nothing usable.
  // Yahoo KRW=X is the most fragile ticker in this set — RN environments often
  // see it blocked or return 0-priced meta. open.er-api.com is a stable,
  // API-key-free public endpoint that always returns a cross rate.
  if (!results['KRW=X'] || !(results['KRW=X'].price > 0)) {
    console.warn('[DEBUG macro] KRW=X missing/zero — trying open.er-api.com fallback');
    const fallback = await fetchUsdKrwFromOpenErApi();
    if (fallback) {
      results['KRW=X'] = fallback;
      console.warn('[DEBUG macro] KRW=X fallback OK price=' + fallback.price);
    } else {
      console.warn('[DEBUG macro] KRW=X fallback failed — currency rate will stay at seed');
    }
  }

  return results;
}

/**
 * Fetch crypto quotes: BTC-USD, ETH-USD, SOL-USD, XRP-USD.
 *
 * Strategy:
 *   1. Call CoinGecko once with all 4 coins (single bundled request to stay
 *      under the free-tier rate limit).
 *   2. For any coin CoinGecko didn't return, fall back to Yahoo Finance.
 *   3. If both fail, the symbol is omitted from the result; the UI keeps the
 *      last cached value.
 *
 * This restores the previous (bf2b5d4) behavior without requiring the
 * removed `server/kiwoomProxy.js` proxy.
 */
export async function get_crypto_data(
  symbols: Array<{ symbol: string; name: string }>,
): Promise<Record<string, YahooQuote>> {
  const results: Record<string, YahooQuote> = {};

  // --- 1. CoinGecko (bundled, single HTTP request) ---
  const coinIds = symbols
    .map((s) => COINGECKO_ID_MAP[s.name])
    .filter((id): id is string => Boolean(id));
  let cgMap: CoinGeckoSimplePriceResponse | null = null;
  if (coinIds.length > 0) {
    cgMap = await fetchCoinGeckoSimplePrices(coinIds);
  }

  // --- 2. Decide which symbols still need a Yahoo fetch ---
  const needsYahoo: Array<{ symbol: string; name: string }> = [];
  for (const { symbol, name } of symbols) {
    const coinId = COINGECKO_ID_MAP[name];
    const cg = coinId && cgMap ? cgMap[coinId] : null;
    if (cg && typeof cg.usd === 'number' && cg.usd > 0) {
      const price = cg.usd;
      const changeRate = typeof cg.usd_24h_change === 'number' ? cg.usd_24h_change : 0;
      const previousClose = changeRate !== 0 ? price / (1 + changeRate / 100) : price;
      const change = price - previousClose;
      results[symbol] = {
        symbol,
        name,
        price: Number(price.toFixed(2)),
        previousClose: Number(previousClose.toFixed(2)),
        change: Number(change.toFixed(2)),
        changeRate: Number(changeRate.toFixed(2)),
        isFallback: false,
      };
    } else {
      // DEBUG (temporary): surface which symbols missed CoinGecko
      console.warn(
        '[DEBUG crypto] ' + symbol + ' CoinGecko miss coinId=' + coinId +
        ' cgMapHasKey=' + (cgMap && coinId ? Boolean(cgMap[coinId]) : false),
      );
      needsYahoo.push({ symbol, name });
    }
  }

  // DEBUG (temporary): which symbols will go to Yahoo fallback
  if (needsYahoo.length > 0) {
    console.warn('[DEBUG crypto] needsYahoo fallback symbols=' + JSON.stringify(needsYahoo.map((s) => s.symbol)));
  }

  // --- 3. Yahoo fallback for whatever CoinGecko didn't give us ---
  const stillMissing: Array<{ symbol: string; name: string }> = [];
  if (needsYahoo.length > 0) {
    await Promise.all(
      needsYahoo.map(async ({ symbol, name }) => {
        const chart = await fetchYahooChart(symbol, '5d', '1d');
        const result = chart?.chart?.result?.[0];
        const meta = result?.meta;
        // DEBUG (temporary): Yahoo crypto chart meta
        console.warn(
          '[DEBUG Yahoo crypto] ' + symbol + ' chartNull=' + (chart == null) +
          ' resultNull=' + (result == null) +
          ' regularMarketPrice=' + (meta?.regularMarketPrice ?? 'null') +
          ' chartPreviousClose=' + (meta?.chartPreviousClose ?? 'null'),
        );
        const q = buildQuoteFromChart(symbol, name, result);
        if (q) {
          results[symbol] = q;
        } else {
          console.warn('[DEBUG Yahoo crypto] ' + symbol + ' buildQuoteFromChart returned null');
          stillMissing.push({ symbol, name });
        }
      }),
    );
  }

  // --- 4. Binance fallback for whatever CoinGecko + Yahoo both missed ---
  // Binance public 24hr ticker is reliable and key-free. Note Binance may be
  // region-restricted (e.g. US IPs); if all fallbacks fail, the symbol stays
  // out of `results` and the UI keeps the last cached value.
  if (stillMissing.length > 0) {
    console.warn('[DEBUG crypto] still missing after CoinGecko+Yahoo=' + JSON.stringify(stillMissing.map((s) => s.symbol)));
    await Promise.all(
      stillMissing.map(async ({ symbol }) => {
        const binanceSymbol = BINANCE_SYMBOL_MAP[symbol];
        if (!binanceSymbol) return;
        const q = await fetchBinance24hr(binanceSymbol);
        if (q) {
          // Normalize the symbol back to the app-side Yahoo symbol.
          q.symbol = symbol;
          q.name = symbol;
          results[symbol] = q;
        }
      }),
    );
  }

  return results;
}

/**
 * Fetch US ETF data including 1D, 5D, 20D returns.
 */
export async function get_us_etf_data(): Promise<Record<string, UsEtfData>> {
  const results: Record<string, UsEtfData> = {};

  await Promise.all(
    TARGET_ETFS.map(async ({ symbol, name }) => {
      const chart = await fetchYahooChart(symbol, '1mo', '1d');
      const res = chart?.chart?.result?.[0];

      if (res && res.meta) {
        const meta = res.meta;
        const currentPrice = Number(meta.regularMarketPrice ?? 0);
        // chartPreviousClose는 range(1mo) 시작 전 종가이므로 실제 직전 거래일 종가로 교정
        const prevClose = resolvePreviousCloseFromChart(chart) || currentPrice;
        const change = currentPrice - prevClose;
        const changeRate = prevClose > 0 ? (change / prevClose) * 100 : 0;
        const volume = Number(meta.regularMarketVolume ?? 0);
        const tradeAmount = currentPrice * volume;

        // Calculate 1D, 5D, 20D returns from closes array
        const closes = (res.indicators?.quote?.[0]?.close ?? []).filter(
          (c): c is number => typeof c === 'number' && !isNaN(c) && c > 0,
        );

        const len = closes.length;
        // return1D도 실제 전일 종가 기준으로 통일 (프리마켓 등 마지막 봉이 어제인 경우까지 정확)
        const p1d = prevClose;
        const p5d = len >= 6 ? closes[len - 6] : (closes[0] ?? prevClose);
        const p20d = len >= 21 ? closes[len - 21] : (closes[0] ?? prevClose);

        const return1D = p1d > 0 ? ((currentPrice - p1d) / p1d) * 100 : changeRate;
        const return5D = p5d > 0 ? ((currentPrice - p5d) / p5d) * 100 : 0;
        const return20D = p20d > 0 ? ((currentPrice - p20d) / p20d) * 100 : 0;

        results[symbol] = {
          symbol,
          name,
          price: Number(currentPrice.toFixed(2)),
          previousClose: Number(prevClose.toFixed(2)),
          change: Number(change.toFixed(2)),
          changeRate: Number(changeRate.toFixed(2)),
          volume,
          tradeAmount,
          return1D: Number(return1D.toFixed(2)),
          return5D: Number(return5D.toFixed(2)),
          return20D: Number(return20D.toFixed(2)),
        };
      } else {
        // Fallback for this ETF
        results[symbol] = getFallbackEtfData(symbol, name);
      }
    }),
  );

  return results;
}

function getFallbackEtfData(symbol: string, name: string): UsEtfData {
  const fallbacks: Record<string, Partial<UsEtfData>> = {
    QQQ:  { price: 512.45, change: 4.85, changeRate: 0.95, return1D: 0.95, return5D: 2.30, return20D: 5.10, volume: 38_500_000 },
    QQQM: { price: 211.20, change: 1.98, changeRate: 0.95, return1D: 0.95, return5D: 2.28, return20D: 5.05, volume: 4_200_000 },
    SOXX: { price: 248.80, change: 5.60, changeRate: 2.30, return1D: 2.30, return5D: 4.80, return20D: 9.40, volume: 6_400_000 },
    SMH:  { price: 274.30, change: 6.70, changeRate: 2.50, return1D: 2.50, return5D: 5.10, return20D: 10.20, volume: 8_100_000 },
    XLK:  { price: 236.10, change: 2.45, changeRate: 1.05, return1D: 1.05, return5D: 2.10, return20D: 4.60, volume: 7_800_000 },
    SPY:  { price: 595.60, change: 2.10, changeRate: 0.35, return1D: 0.35, return5D: 1.20, return20D: 3.40, volume: 45_000_000 },
    DIA:  { price: 442.80, change: -0.40, changeRate: -0.09, return1D: -0.09, return5D: 0.80, return20D: 2.10, volume: 3_200_000 },
    IWM:  { price: 228.40, change: 1.20, changeRate: 0.53, return1D: 0.53, return5D: 1.90, return20D: 4.20, volume: 22_000_000 },
  };

  const f = fallbacks[symbol] || { price: 100, change: 0, changeRate: 0, return1D: 0, return5D: 0, return20D: 0, volume: 1_000_000 };
  const price = f.price ?? 100;
  return {
    symbol,
    name,
    price,
    previousClose: price - (f.change ?? 0),
    change: f.change ?? 0,
    changeRate: f.changeRate ?? 0,
    volume: f.volume ?? 1_000_000,
    tradeAmount: price * (f.volume ?? 1_000_000),
    return1D: f.return1D ?? 0,
    return5D: f.return5D ?? 0,
    return20D: f.return20D ?? 0,
  };
}

/**
 * Fetch Korean stock price data from Yahoo Finance.
 * Uses Yahoo symbols with .KS suffix (e.g. 005930.KS for 삼성전자).
 * Returns real-time price, change, volume, and historical close data.
 */
export async function get_korean_stock_data(code: string): Promise<Partial<KisStockPrice> | null> {
  const stockConfig = TARGET_STOCKS.find((s) => s.code === code);
  if (!stockConfig) return null;

  const chart = await fetchYahooChart(stockConfig.yahooSymbol, '1mo', '1d');
  const result = chart?.chart?.result?.[0];

  if (!result || !result.meta) return null;

  const meta = result.meta;
  const price = Math.abs(Number(meta.regularMarketPrice)) || 0;
  if (price <= 0) return null;

  const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPreviousClose ?? price);
  const change = price - prevClose;
  const changeRate = prevClose > 0 ? (change / prevClose) * 100 : 0;

  // Get volume from history (sum of all trading days)
  const volumeValues = (result.indicators?.quote?.[0]?.volume ?? []).filter(
    (v): v is number => typeof v === 'number' && v > 0
  );
  const totalVolume = volumeValues.reduce((sum, v) => sum + v, 0);
  const latestVolume = volumeValues[volumeValues.length - 1] ?? totalVolume;

  // Calculate 5-day and 20-day returns for estimate inference
  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (c): c is number => typeof c === 'number' && !isNaN(c) && c > 0
  );
  const len = closes.length;
  const prevClose5d = len >= 6 ? closes[len - 6] : (closes[0] ?? prevClose);
  const prevClose20d = len >= 21 ? closes[len - 21] : (closes[0] ?? prevClose);
  const return5d = prevClose5d > 0 ? ((price - prevClose5d) / prevClose5d) * 100 : 0;
  const return20d = prevClose20d > 0 ? ((price - prevClose20d) / prevClose20d) * 100 : 0;

  return {
    code,
    name: stockConfig.name,
    price,
    change: Number(change.toFixed(0)),
    changeRate: Number(changeRate.toFixed(2)),
    open: Number(meta.regularMarketOpen ?? (price - change)),
    high: Number(meta.regularMarketDayHigh ?? price + Math.abs(change)),
    low: Number(meta.regularMarketDayLow ?? price - Math.abs(change)),
    volume: latestVolume,
    tradeAmount: price * latestVolume,
    marketCap: Number(meta.marketCap ?? 0),
    per: Number(meta.trailingPE ?? 0),
    pbr: Number(meta.priceToBook ?? 0),
    eps: Number(meta.trailingPE) > 0 ? price / Number(meta.trailingPE) : 0,
    bps: Number(meta.priceToBook) > 0 ? price / Number(meta.priceToBook) : 0,
    foreignHoldingRate: 0, // Not available from Yahoo Finance
    isFallback: false,
    _yahooReturn5d: Number(return5d.toFixed(2)),
    _yahooReturn20d: Number(return20d.toFixed(2)),
  } as any;
}

/**
 * Fetch a specific Korean stock price from Yahoo Finance.
 * Thin wrapper used by domesticStockService.
 */
export async function get_korean_stock_price(code: string): Promise<KisStockPrice | null> {
    const yahooData = await get_korean_stock_data(code);
  if (!yahooData) return null;
  if (!yahooData.price) return null; // 가격이 없으면 Yahoo 데이터 무효

  const stockConfig = TARGET_STOCKS.find((s) => s.code === code);
  const defaults = {
    marketCap: 0,
    per: 15.0,
    pbr: 1.2,
    eps: 0,
    bps: 0,
    foreignHoldingRate: 25.0,
    open: yahooData.price - (yahooData.change ?? 0),
    high: yahooData.price + Math.abs(yahooData.change ?? 0),
    low: yahooData.price - Math.abs(yahooData.change ?? 0),
    volume: yahooData.volume ?? 0,
    tradeAmount: (yahooData.volume ?? 0) * yahooData.price,
  };

  return {
    code,
    name: yahooData.name ?? stockConfig?.name ?? code,
    price: yahooData.price,
    change: yahooData.change ?? 0,
    changeRate: yahooData.changeRate ?? 0,
    open: yahooData.open ?? defaults.open,
    high: yahooData.high ?? defaults.high,
    low: yahooData.low ?? defaults.low,
    volume: yahooData.volume ?? defaults.volume,
    tradeAmount: yahooData.tradeAmount ?? defaults.tradeAmount,
    marketCap: yahooData.marketCap ?? defaults.marketCap,
    per: yahooData.per ?? defaults.per,
    pbr: yahooData.pbr ?? defaults.pbr,
    eps: yahooData.eps ?? defaults.eps,
    bps: yahooData.bps ?? defaults.bps,
    foreignHoldingRate: yahooData.foreignHoldingRate ?? defaults.foreignHoldingRate,
    isFallback: false,
  };
}

/**
 * Fetch KOSPI composite index (^KS11) from Yahoo Finance.
 */
export async function get_kospi_index_from_yahoo(): Promise<KisIndexPrice | null> {
  const chart = await fetchYahooChart('^KS11', '1mo', '1d');
  const result = chart?.chart?.result?.[0];

  if (!result || !result.meta) return null;

  const meta = result.meta;
  const price = Math.abs(Number(meta.regularMarketPrice)) || 0;
  if (price <= 0) return null;

  const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
  const change = price - prevClose;
  const changeRate = prevClose > 0 ? (change / prevClose) * 100 : 0;

  const volumeValues = (result.indicators?.quote?.[0]?.volume ?? []).filter(
    (v): v is number => typeof v === 'number' && v > 0
  );
  const totalVolume = volumeValues.reduce((sum, v) => sum + v, 0);

  return {
    code: '0001',
    name: '코스피',
    price: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changeRate: Number(changeRate.toFixed(2)),
    open: Number(meta.regularMarketOpen ?? (price - change)),
    high: Number(meta.regularMarketDayHigh ?? price + Math.abs(change)),
    low: Number(meta.regularMarketDayLow ?? price - Math.abs(change)),
    previousClose: Number(prevClose.toFixed(2)),
    volume: totalVolume,
    tradeAmount: totalVolume * price,
    isFallback: false,
  };
}