/**
 * Market Provider — Unified Facade
 *
 * Combines Twelve Data (US markets) + Korea Market Provider (KRX/futures)
 * and returns data in the existing MarketItem[] format.
 *
 * Caller (marketData.ts / App.tsx) only talks to this module.
 */

import { MarketItem, MorningBriefing } from '../../types/market';
import {
  fetchTwelveDataPrices,
  fetchTwelveDataHistory,
  TWELVE_DATA_SYMBOL_MAP,
  TwelveDataLiveQuote,
  isTwelveDataConfigured,
} from './twelveDataProvider';
import {
  getKoreaMarketData,
} from './koreaMarketProvider';
import { getUsMarketTag } from '../../utils/formatters';
import { fetchMarketSentiment, FearGreedResult, MarketSentimentResult } from './sentimentProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FetchResult {
  items: MarketItem[];
  briefing: MorningBriefing;
  /** ISO timestamp of the successful fetch */
  fetchedAt: string;
  /** true when at least one data source returned live data */
  hasLiveData: boolean;
  /** per-item errors or warnings for logging */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// generateDynamicBriefing (migrated from marketData.ts)
// ---------------------------------------------------------------------------
function calculateFearAndGreed(vixPrice: number): { score: number; rating: string; previousClose: number } {
  let score = Math.round(100 - (vixPrice - 10) * 3.2);
  score = Math.max(5, Math.min(95, score));
  let rating = 'Neutral (중립)';
  if (score >= 75) rating = 'Extreme Greed (극단적 탐욕)';
  else if (score >= 60) rating = 'Greed (탐욕 - 매수 우세)';
  else if (score <= 25) rating = 'Extreme Fear (극단적 공포)';
  else if (score <= 40) rating = 'Fear (공포 - 매도 우세)';
  return { score, rating, previousClose: Math.max(5, Math.min(95, score - 2)) };
}

export function generateDynamicBriefing(
  items: MarketItem[],
  kospiCompositePrice?: number,
  updatedAt?: string,
  sentiment?: FearGreedResult | null,
  cryptoSentiment?: FearGreedResult | null,
): MorningBriefing {
  const now = new Date();
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const dateString = `${month}월 ${date}일 (${days[now.getDay()][0]})`;
  const dayOfWeek = days[now.getDay()];

  const nasdaq = items.find((i) => i.id === 'nasdaq_comp');
  const sox = items.find((i) => i.id === 'phil_semiconductor');
  const futures = items.find((i) => i.id === 'kospi_night_futures');
  const usdkrw = items.find((i) => i.id === 'fx_usdkrw');
  const us10y = items.find((i) => i.id === 'macro_us10y');
  const us30y = items.find((i) => i.id === 'macro_us30y');
  const vix = items.find((i) => i.id === 'macro_vix');
  const wti = items.find((i) => i.id === 'macro_wti');

  const nasdaqChg = nasdaq?.changePercent ?? 0;
  const soxChg = sox?.changePercent ?? 0;
  const futuresChg = futures?.changePercent ?? 0;
  const usdkrwVal = usdkrw?.price ?? 1416;
  const us10yVal = us10y?.price ?? 4.66;
  const us30yVal = us30y?.price ?? 5.18;
  const vixVal = vix?.price ?? 14.5;
  const wtiVal = wti?.price ?? 82.0;

  const baseKospi = (kospiCompositePrice && kospiCompositePrice > 0)
    ? kospiCompositePrice
    : 0;

  const hasFuturesData = Boolean(futures && futures.price > 0);
  const expectedChangePercent = hasFuturesData ? futuresChg * 0.9 : 0;
  let expectedKospiOpen: string;
  let expectedKospiOpenRange: string;
  let expectedKospiChange: string;

  if (baseKospi > 0) {
    const expectedCenterPrice = baseKospi * (1 + expectedChangePercent / 100);
    const deltaPoints = expectedCenterPrice - baseKospi;
    const spread = Math.max(8, baseKospi * 0.0035);
    const lowOpen = Math.round((expectedCenterPrice - spread) / 5) * 5;
    const highOpen = Math.round((expectedCenterPrice + spread) / 5) * 5;

    let openDirection = '보합권 출발';
    if (!hasFuturesData) openDirection = '야간선물 실시간 없음 · 전일 종가 기준';
    else if (futuresChg >= 0.5) openDirection = '상승 출발 (우상향 시도)';
    else if (futuresChg > 0.1) openDirection = '소폭 상승 출발';
    else if (futuresChg <= -0.5) openDirection = '하락 출발 (조정 압력)';
    else if (futuresChg < -0.1) openDirection = '소폭 하락 출발';

    expectedKospiOpen = `${(Math.round(expectedCenterPrice / 5) * 5).toLocaleString()} pt`;
    expectedKospiOpenRange = `예상 범위 ${lowOpen.toLocaleString()} ~ ${highOpen.toLocaleString()} pt · ${openDirection}`;
    expectedKospiChange = `${expectedChangePercent >= 0 ? '+' : ''}${expectedChangePercent.toFixed(2)}% (${deltaPoints >= 0 ? '+' : ''}${deltaPoints.toFixed(1)}pt)`;
  } else {
    // No live KOSPI quote from any source — do not invent a price level.
    expectedKospiOpen = '데이터 없음';
    expectedKospiOpenRange = '코스피 종가 실시간 수신 실패 · 잠시 후 다시 갱신됩니다';
    expectedKospiChange = '—';
  }

  let marketTone: 'bullish' | 'bearish' | 'neutral' | 'volatile' = 'neutral';
  let marketToneBadge = '🔄 혼조세 속 관망 흐름';
  let marketToneHeadline = '미 증시 주요 지수 및 야간 선물 실시간 시세 반영 중';

  if (futuresChg > 0.5 || (nasdaqChg > 0.5 && soxChg > 0.5)) {
    marketTone = 'bullish';
    marketToneBadge = '🚀 강세 기조 지속';
    marketToneHeadline = `나스닥(${nasdaqChg > 0 ? '+' : ''}${nasdaqChg.toFixed(2)}%) 및 반도체 호조로 국내 증시 상승 출발 기대`;
  } else if (futuresChg < -0.5 || (nasdaqChg < -0.5 && soxChg < -0.5)) {
    marketTone = 'bearish';
    marketToneBadge = '⚠️ 조정 및 차익실현 경계';
    marketToneHeadline = `미 기술주 조정(${nasdaqChg.toFixed(2)}%) 영향으로 국내 증시 단기 변동성 유의`;
  } else if (vixVal > 22) {
    marketTone = 'volatile';
    marketToneBadge = '⚡ 변동성 확대 장세';
    marketToneHeadline = `VIX 변동성(${vixVal.toFixed(1)}pt) 확대 속 혼조세`;
  }

  // CNN Fear & Greed when available; otherwise the VIX-based approximation.
  const fearGreed = sentiment
    ? {
        score: sentiment.score,
        rating: sentiment.rating,
        previousClose: sentiment.previousClose ?? Math.max(5, Math.min(95, sentiment.score - 2)),
      }
    : calculateFearAndGreed(vixVal);

  // Crypto Fear & Greed (Alternative.me) when available; otherwise fall back
  // to the VIX-based approximation.
  const cryptoFearGreed = cryptoSentiment
    ? {
        score: cryptoSentiment.score,
        rating: cryptoSentiment.rating,
        previousClose: cryptoSentiment.previousClose ?? Math.max(5, Math.min(95, cryptoSentiment.score - 2)),
      }
    : calculateFearAndGreed(vixVal);

  return {
    dateString,
    dayOfWeek,
    updatedAt: updatedAt ?? `${getUsMarketTag()} 기준`,
    marketTone,
    marketToneBadge,
    marketToneHeadline,
    expectedKospiOpen,
    expectedKospiChange,
    expectedKospiOpenRange,
    confidenceRate: 85,
    summaryBullets: [
      `🌙 코스피 200 야간선물: ${futures?.price ? `${futures.price.toFixed(2)}pt (${futuresChg >= 0 ? '+' : ''}${futuresChg.toFixed(2)}%)` : '실시간 데이터 없음'}`,
      `📊 美 나스닥(${nasdaqChg >= 0 ? '+' : ''}${nasdaqChg.toFixed(2)}%) · 필라델피아 반도체(${soxChg >= 0 ? '+' : ''}${soxChg.toFixed(2)}%)`,
      `💵 원/달러 환율 ${usdkrwVal.toLocaleString()}원 · 미 국채 10년 ${us10yVal.toFixed(2)}% / 30년 ${us30yVal.toFixed(2)}%`,
    ],
    keyDrivers: [
      {
        title: '미국 증시 & 기술주 방향성',
        impact: nasdaqChg >= 0 ? 'positive' : 'negative',
        desc: `나스닥 ${nasdaqChg >= 0 ? '+' : ''}${nasdaqChg.toFixed(2)}%, 반도체(SOX) ${soxChg >= 0 ? '+' : ''}${soxChg.toFixed(2)}%`,
      },
      {
        title: '금리 환경 (10년·30년물 국채)',
        impact: us10yVal < 4.5 ? 'positive' : 'neutral',
        desc: `미 국채 10년물 ${us10yVal.toFixed(2)}%, 30년물 ${us30yVal.toFixed(2)}% 수준 기록`,
      },
      {
        title: '외환 및 원자재 동향',
        impact: usdkrwVal < 1400 ? 'positive' : 'neutral',
        desc: `원/달러 환율 ${usdkrwVal.toLocaleString()}원, WTI 유가 $${wtiVal.toFixed(2)}`,
      },
    ],
    nightSessionStats: {
      nightClose: futures?.price ?? 0,
      nightChange: futures?.change ?? 0,
      nightChangePercent: futuresChg,
      volumeContracts: futures ? futures.volume || '실시간 데이터 없음' : '실시간 데이터 없음',
      foreignBuyingNet: futures ? (futuresChg >= 0 ? '외국인 순매수 우위' : '외국인 관망세') : '실시간 데이터 없음',
      tradingHours: '전일 18:00 ~ 금일 06:00 (CME 연계 KRX 야간)',
    },
    fearAndGreedIndex: fearGreed,
    cryptoFearAndGreedIndex: cryptoFearGreed,
  };
}

// ---------------------------------------------------------------------------
// Main fetch function
// ---------------------------------------------------------------------------

/**
 * Fetch all market data from available providers.
 * Falls back to `currentItems` for any failed or unsupported items.
 */
export async function fetchAllMarketData(
  currentItems: MarketItem[],
): Promise<FetchResult> {
  const warnings: string[] = [];
  const usTag = getUsMarketTag();

  // IDs that Twelve Data handles
  const twelveDataIds = currentItems
    .map((i) => i.id)
    .filter((id) => id in TWELVE_DATA_SYMBOL_MAP);

  // ── 1. Twelve Data batch price fetch ──────────────────────────────────────
  let priceMap: Record<string, TwelveDataLiveQuote | null> = {};
  try {
    priceMap = await fetchTwelveDataPrices(twelveDataIds);
  } catch (e) {
    warnings.push(`Twelve Data batch fetch error: ${String(e)}`);
    for (const id of twelveDataIds) priceMap[id] = null;
  }

  // ── 1.5 Global sentiment (Stock CNN + Crypto Alternative.me) ───────────────
  let sentiment: FearGreedResult | null = null;
  let cryptoSentiment: FearGreedResult | null = null;
  try {
    const marketSentiment = await fetchMarketSentiment();
    sentiment = marketSentiment.stock;
    cryptoSentiment = marketSentiment.crypto;
  } catch {
    sentiment = null;
    cryptoSentiment = null;
  }
  if (!sentiment) {
    warnings.push('Stock Fear & Greed unavailable — VIX-based estimate used');
  }
  if (!cryptoSentiment) {
    warnings.push('Crypto Fear & Greed unavailable');
  }

  // ── 2. Korea Market Provider ───────────────────────────────────────────────
  let kospiCompositePrice: number | null = null;
  let koreaFuturesPartial: Partial<MarketItem> | null = null;
  let koreaSourceLabel = '캐시 데이터 (실시간 미연결)';
  try {
    const koreaData = await getKoreaMarketData();
    kospiCompositePrice = koreaData.kospiCompositePrice;
    koreaFuturesPartial = koreaData.nightFutures;
    koreaSourceLabel = koreaData.dataSourceLabel;
  } catch (e) {
    warnings.push(`Korea market provider error: ${String(e)}`);
  }

  // ── 3. Merge into MarketItem[] ─────────────────────────────────────────────
  const updatedItems: MarketItem[] = await Promise.all(
    currentItems.map(async (item): Promise<MarketItem> => {
      // --- KOSPI 200 야간선물 (Korea provider) ---
      if (item.id === 'kospi_night_futures') {
        if (koreaFuturesPartial && koreaFuturesPartial.price && koreaFuturesPartial.price > 0) {
          return { ...item, ...koreaFuturesPartial } as MarketItem;
        }
        // No real data: keep existing values but update tag to be honest
        return {
          ...item,
          price: 0,
          change: 0,
          changePercent: 0,
          open: 0,
          high: 0,
          low: 0,
          volume: '',
          tag: koreaSourceLabel,
        };
      }

      // --- Twelve Data items ---
      const liveQuote = priceMap[item.id] as TwelveDataLiveQuote | null | undefined;
      const livePrice = liveQuote ? liveQuote.price : null;
      if (livePrice === undefined || livePrice === null || livePrice <= 0) {
        // Not supported or fetch failed — keep existing item
        if (item.id in TWELVE_DATA_SYMBOL_MAP) {
          warnings.push(`No live price for ${item.id} (${TWELVE_DATA_SYMBOL_MAP[item.id]?.symbol})`);
        }
        // Still update US index tags
        if (item.category === 'us_index' && item.id !== 'phil_semiconductor') {
          return { ...item, tag: usTag };
        }
        return item;
      }

      // Prefer the previous close returned by the live source (Yahoo fallback
      // provides it) over the hardcoded seed value, so change/% are accurate.
      const livePrevious = liveQuote?.previousClose;
      const previousClose = (livePrevious !== undefined && livePrevious > 0)
        ? livePrevious
        : (item.previousClose > 0 ? item.previousClose : livePrice);
      const change = livePrice - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

      // Attempt to fetch sparkline history (best-effort, don't fail the whole refresh)
      let history = item.history;
      try {
        const liveHistory = await fetchTwelveDataHistory(item.id);
        if (liveHistory && liveHistory.length >= 3) {
          history = liveHistory;
        }
      } catch {
        // keep existing history
      }

      // Dynamic tag for US indices
      let dynamicTag = item.tag;
      if (item.category === 'us_index' && item.id !== 'phil_semiconductor') {
        dynamicTag = usTag;
      }

      const decimalPlaces = item.category === 'macro' && item.unit === '%' ? 3 : 2;

      return {
        ...item,
        price: Number(livePrice.toFixed(decimalPlaces)),
        change: Number(change.toFixed(decimalPlaces)),
        changePercent: Number(changePercent.toFixed(2)),
        previousClose: Number(previousClose.toFixed(decimalPlaces)),
        tag: dynamicTag,
        history,
      };
    }),
  );

  // ── 4. Generate briefing ───────────────────────────────────────────────────
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const fetchedAt = now.toISOString();

  const hasLiveData = isTwelveDataConfigured() && Object.values(priceMap).some((v) => v !== null && v.price > 0);
  const updatedAtLabel = hasLiveData
    ? `마지막 업데이트 ${hh}:${mm}:${ss}`
    : `캐시 데이터 (${getUsMarketTag()} 기준)`;

  const briefing = generateDynamicBriefing(updatedItems, kospiCompositePrice ?? undefined, updatedAtLabel, sentiment, cryptoSentiment);

  return { items: updatedItems, briefing, fetchedAt, hasLiveData, warnings };
}
