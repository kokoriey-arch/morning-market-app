/**
 * AI Market Analysis Service.
 *
 * Integrates Kiwoom REST API + Yahoo VIX/ETFs, manages TTL caching,
 * and generates structured AI Market Signals and comprehensive commentary.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UnifiedMarketData,
  MarketSignal,
  StockAnalysisData,
  KisIndexPrice,
  VixData,
  UsEtfData,
  SignalTrend,
  SignalLevel,
  SignalSentiment,
  SignalFlow,
} from '../../types/aiAnalysis';
import {
  get_stock_info,
  get_stock_price,
  get_investor_trend,
  get_investor_estimate,
  get_program_trade,
  get_kospi_index,
} from '../kis/domesticStockService';
import { isKiwoomConfigured } from '../kis/kisClient';
import { get_vix, get_us_etf_data } from '../yahoo/yahooMarketService';
import { TARGET_STOCKS, SIGNAL_THRESHOLDS } from './marketSignalConfig';

const AI_CACHE_KEY = '@ai_analysis_unified_data_v1';

// In-memory cache with TTL timestamps
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = {
  stocks: {} as Record<string, CacheEntry<StockAnalysisData>>,
  kospi: null as CacheEntry<KisIndexPrice> | null,
  vix: null as CacheEntry<VixData> | null,
  etfs: null as CacheEntry<Record<string, UsEtfData>> | null,
};

const TTL = {
  stockPrice: 60_000,    // 60s
  kospi: 60_000,         // 60s
  vix: 300_000,          // 5m
  etfs: 300_000,         // 5m
};

/**
 * Generates market signals based on unified indicators.
 */
export function generateMarketSignals(
  kospi: KisIndexPrice,
  vix: VixData,
  etfs: Record<string, UsEtfData>,
  stocks: Record<string, StockAnalysisData>,
): MarketSignal {
  // 1. KOSPI Trend
  let kospi_trend: SignalTrend = 'FLAT';
  if (kospi.changeRate >= SIGNAL_THRESHOLDS.kospiChange.up) kospi_trend = 'UP';
  else if (kospi.changeRate <= SIGNAL_THRESHOLDS.kospiChange.down) kospi_trend = 'DOWN';

  // 2. VIX Level
  const vix_level: SignalLevel = vix.level;

  // 3. Nasdaq Signal (QQQ & XLK)
  const qqqChg = etfs['QQQ']?.changeRate ?? 0;
  const xlkChg = etfs['XLK']?.changeRate ?? 0;
  const techAvg = (qqqChg + xlkChg) / 2;

  let nasdaq_signal: SignalSentiment = 'NEUTRAL';
  if (techAvg >= SIGNAL_THRESHOLDS.etfChange.bullish) nasdaq_signal = 'BULLISH';
  else if (techAvg <= SIGNAL_THRESHOLDS.etfChange.bearish) nasdaq_signal = 'BEARISH';

  // 4. Semiconductor Signal (SOXX & SMH)
  const soxxChg = etfs['SOXX']?.changeRate ?? 0;
  const smhChg = etfs['SMH']?.changeRate ?? 0;
  const semiAvg = (soxxChg + smhChg) / 2;

  let semiconductor_signal: SignalSentiment = 'NEUTRAL';
  if (semiAvg >= SIGNAL_THRESHOLDS.etfChange.bullish) semiconductor_signal = 'BULLISH';
  else if (semiAvg <= SIGNAL_THRESHOLDS.etfChange.bearish) semiconductor_signal = 'BEARISH';

  // 5. Domestic Flows across Target Stocks (Samsung, Hynix, etc.)
  let totalForeignNet = 0;
  let totalInstNet = 0;
  let totalProgNet = 0;

  for (const item of Object.values(stocks)) {
    if (item.investor) {
      totalForeignNet += item.investor.foreignNetBuy;
      totalInstNet += item.investor.institutionNetBuy;
    }
    if (item.program) {
      totalProgNet += item.program.programNetBuy;
    }
  }

  const foreign_flow: SignalFlow =
    totalForeignNet > 50_000 ? 'BUY' : totalForeignNet < -50_000 ? 'SELL' : 'NEUTRAL';
  const institution_flow: SignalFlow =
    totalInstNet > 30_000 ? 'BUY' : totalInstNet < -30_000 ? 'SELL' : 'NEUTRAL';
  const program_flow: SignalFlow =
    totalProgNet > 30_000 ? 'BUY' : totalProgNet < -30_000 ? 'SELL' : 'NEUTRAL';

  // 6. Detailed AI Synthesized Commentaries
  const isSemiStrong = semiconductor_signal === 'BULLISH';
  const isVixSafe = vix_level === 'LOW';

  let overall_judgment = '';
  if (nasdaq_signal === 'BULLISH' && (foreign_flow === 'BUY' || program_flow === 'BUY')) {
    overall_judgment = '미 기술주 강세와 수급 유입이 맞물려 적극적 우상향 시도가 기대되는 공격적 매수 우위 장세입니다.';
  } else if (vix_level === 'HIGH' || foreign_flow === 'SELL') {
    overall_judgment = '시장 변동성 확대 및 외국인 차익실현 매물로 인해 지수 방어 및 보수적 비중 조절이 권고되는 장세입니다.';
  } else {
    overall_judgment = '미 증시 숨고르기 속 실적 호전주 및 반도체 밸류체인 중심의 차별화된 개별종목 장세입니다.';
  }

  const foreign_commentary =
    foreign_flow === 'BUY'
      ? `대형 IT 및 주요 종목 중심으로 외국인 순매수(+${totalForeignNet.toLocaleString()}주)가 유입되며 지수 하방 지지력이 강력합니다.`
      : foreign_flow === 'SELL'
      ? `외국인 매도세(${totalForeignNet.toLocaleString()}주)가 지속되어 시가총액 상위 종목에 대한 단기 수급 부담이 존재합니다.`
      : '외국인 수급은 관망세를 유지하며 특정 반도체 핵심 종목에 선별적 포지셔닝을 보이고 있습니다.';

  const institution_commentary =
    institution_flow === 'BUY'
      ? `기관 순매수(+${totalInstNet.toLocaleString()}주)가 외국인과 동반 유입되어 우호적인 쌍끌이 장세 흐름을 조성하고 있습니다.`
      : institution_flow === 'SELL'
      ? `투신 및 연기금 등 기관의 차익실현 매물(${totalInstNet.toLocaleString()}주) 출회로 지수 상단이 제한적입니다.`
      : '기관 투자가는 업종별 롱숏 전략을 전개하며 지수 변동폭을 완화하는 중립 흐름입니다.';

  const program_commentary =
    program_flow === 'BUY'
      ? `차익/비차익 프로그램 순매수(+${totalProgNet.toLocaleString()}주)가 강하게 유입되어 지수 바스켓 매수세를 견인합니다.`
      : program_flow === 'SELL'
      ? `선물 베이시스 악화에 따른 프로그램 매도 우위(${totalProgNet.toLocaleString()}주)로 장중 낙폭 변동성에 유의해야 합니다.`
      : '프로그램 매매는 균형권에서 등락하며 시장 충격 요인이 낮습니다.';

  const us_tech_impact =
    nasdaq_signal === 'BULLISH'
      ? `나스닥(QQQ ${qqqChg >= 0 ? '+' : ''}${qqqChg.toFixed(2)}%) 및 기술주(XLK) 랠리가 국내 성장주 전반에 긍정적 온기를 공급합니다.`
      : nasdaq_signal === 'BEARISH'
      ? `미 대형 기술주 조정(QQQ ${qqqChg.toFixed(2)}%)으로 국내 IT 성장주들의 시초가 갭다운 및 보수적 접근이 예상됩니다.`
      : `미 기술주가 보합권(QQQ ${qqqChg >= 0 ? '+' : ''}${qqqChg.toFixed(2)}%)에서 소화되며 독자 모멘텀으로 전개됩니다.`;

  const semiconductor_impact = isSemiStrong
    ? `SOXX(${soxxChg >= 0 ? '+' : ''}${soxxChg.toFixed(2)}%) 및 SMH(${smhChg >= 0 ? '+' : ''}${smhChg.toFixed(2)}%) 동반 강세로 삼성전자·SK하이닉스·한미반도체의 강력한 주도주 랠리가 부각됩니다.`
    : `글로벌 반도체 지수(SOXX ${soxxChg >= 0 ? '+' : ''}${soxxChg.toFixed(2)}%) 숨고르기로 국내 반도체 종목은 HBM 차별화 실적에 주목할 시점입니다.`;

  const vix_risk = isVixSafe
    ? `VIX 지수가 ${vix.price}pt로 안정권(15pt 미만)에 머물며 시장 참여자들의 위험자산 선호 심리가 견조합니다.`
    : vix_level === 'HIGH'
    ? `VIX 지수가 ${vix.price}pt로 22pt를 상회하여 글로벌 거시 불안감에 따른 헤지 수요가 증가하고 있습니다.`
    : `VIX 지수는 ${vix.price}pt(중립 영역)로 안정적인 포트폴리오 운용이 가능한 변동성 수준입니다.`;

  return {
    kospi_trend,
    vix_level,
    nasdaq_signal,
    semiconductor_signal,
    foreign_flow,
    institution_flow,
    program_flow,
    overall_judgment,
    foreign_commentary,
    institution_commentary,
    program_commentary,
    us_tech_impact,
    semiconductor_impact,
    vix_risk,
  };
}

/**
 * Main function: Fetch all unified market data with TTL caching.
 */
export async function getUnifiedMarketData(forceRefresh = false): Promise<UnifiedMarketData> {
  const now = Date.now();

  // 1. KOSPI Index
  let kospiData: KisIndexPrice;
  if (!forceRefresh && cache.kospi && cache.kospi.timestamp + TTL.kospi > now) {
    kospiData = cache.kospi.data;
  } else {
    const fresh = await get_kospi_index();
    kospiData = fresh ?? (cache.kospi?.data || {
      code: '0001',
      name: '코스피',
      price: 2685.45,
      change: 18.25,
      changeRate: 0.68,
      open: 2672.00,
      high: 2690.10,
      low: 2668.50,
      volume: 480_000_000,
      tradeAmount: 9_450_000_000_000,
    });
    cache.kospi = { data: kospiData, timestamp: now };
  }

  // 2. VIX & US ETFs
  let vixData: VixData;
  if (!forceRefresh && cache.vix && cache.vix.timestamp + TTL.vix > now) {
    vixData = cache.vix.data;
  } else {
    vixData = await get_vix();
    cache.vix = { data: vixData, timestamp: now };
  }

  let etfData: Record<string, UsEtfData>;
  if (!forceRefresh && cache.etfs && cache.etfs.timestamp + TTL.etfs > now) {
    etfData = cache.etfs.data;
  } else {
    etfData = await get_us_etf_data();
    cache.etfs = { data: etfData, timestamp: now };
  }

  // 3. Domestic Stocks (5 target stocks)
  const stockResults: Record<string, StockAnalysisData> = {};

  await Promise.all(
    TARGET_STOCKS.map(async ({ code, name }) => {
      const cached = cache.stocks[code];
      if (!forceRefresh && cached && cached.timestamp + TTL.stockPrice > now) {
        stockResults[code] = cached.data;
        return;
      }

      const [info, price, investor, estimate, program] = await Promise.all([
        get_stock_info(code),
        get_stock_price(code),
        get_investor_trend(code),
        get_investor_estimate(code),
        get_program_trade(code),
      ]);

      const data: StockAnalysisData = {
        code,
        name,
        info: info ?? undefined,
        price: price ?? {
          code,
          name,
          price: 70000,
          change: 0,
          changeRate: 0,
          open: 70000,
          high: 70000,
          low: 70000,
          volume: 0,
          tradeAmount: 0,
          marketCap: 0,
          per: 15,
          pbr: 1.2,
          eps: 4500,
          bps: 55000,
          foreignHoldingRate: 50,
          isFallback: true,
        },
        investor: investor ?? undefined,
        investorEstimate: estimate ?? undefined,
        program: program ?? undefined,
      };

      cache.stocks[code] = { data, timestamp: now };
      stockResults[code] = data;
    }),
  );

  // 4. Generate AI Market Signals
  const signals = generateMarketSignals(kospiData, vixData, etfData, stockResults);

  const unified: UnifiedMarketData = {
    kospi: kospiData,
    vix: vixData,
    us_etf: etfData,
    stocks: stockResults,
    signals,
    lastUpdated: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    isKiwoomLive: isKiwoomConfigured()
      && !kospiData.isFallback
      && Object.values(stockResults).every(({ info, price, investor, investorEstimate, program }) =>
        info?.isFallback === false
        && price.isFallback === false
        && investor?.isFallback === false
        && program?.isFallback === false,
      ),
    sourceLabel: isKiwoomConfigured()
      && !kospiData.isFallback
      && Object.values(stockResults).every(({ info, price, investor, investorEstimate, program }) =>
        info?.isFallback === false
        && price.isFallback === false
        && investor?.isFallback === false
        && program?.isFallback === false,
      )
      ? '🟢 KIWOOM LIVE'
      : '🟡 MOCK / FALLBACK',
  };

  // Persist to AsyncStorage for offline / launch immediate display
  AsyncStorage.setItem(AI_CACHE_KEY, JSON.stringify(unified)).catch(() => {});

  return unified;
}
