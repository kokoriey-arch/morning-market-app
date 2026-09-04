/**
 * marketData.ts
 *
 * Provides:
 *  - INITIAL_MARKET_ITEMS  (static seed data / fallback)
 *  - INITIAL_MORNING_BRIEFING
 *  - getUsMarketTag()
 *  - MarketService  (cache + user prefs + refresh via marketProvider)
 *
 * Yahoo Finance has been REMOVED. Data is now fetched via:
 *   src/services/providers/marketProvider.ts  (Twelve Data + Korea Market)
 */

import { MarketItem, MorningBriefing, UserPreferences } from '../types/market';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentMorningDateString, getUsMarketTag } from '../utils/formatters';
import { fetchAllMarketData } from './providers/marketProvider';

export { getUsMarketTag };

const PREFS_STORAGE_KEY = '@morning_market_user_prefs_v1';
const CACHED_ITEMS_KEY = '@morning_market_cached_items_v6';
const CACHED_BRIEFING_KEY = '@morning_market_cached_briefing_v6';

// ---------------------------------------------------------------------------
// Static seed data
// ---------------------------------------------------------------------------
export const INITIAL_MARKET_ITEMS: MarketItem[] = [
  // 1. KOSPI 200 야간선물
  //    NOTE: Real-time data requires Korea Investment Securities / Kiwoom API.
  //    This seed uses cached values. The tag explicitly states the data source.
  {
    id: 'kospi_night_futures',
    symbol: 'KM200N',
    name: 'KOSPI 200 Night Futures',
    koreanName: '코스피 200 야간선물',
    category: 'kospi',
    price: 0,
    change: 0,
    changePercent: 0,
    open: 0,
    high: 0,
    low: 0,
    previousClose: 0,
    volume: '',
    unit: 'pt',
    isNightFutures: true,
    tag: '캐시 데이터 (실시간 미연결)',
    description: '코스피 200 야간선물 (CME 연계 KRX). 실시간 연동을 위해서는 한국투자증권 또는 키움 API 키가 필요합니다.',
    history: [],
  },

  // 2. US Major Indices
  {
    id: 'nasdaq_comp',
    symbol: 'IXIC',
    name: 'NASDAQ Composite',
    koreanName: '나스닥 종합',
    category: 'us_index',
    price: 26729.16,
    change: -73.86,
    changePercent: -0.28,
    open: 26800.00,
    high: 26852.30,
    low: 26680.50,
    previousClose: 26803.02,
    volume: '6.1B',
    unit: 'pt',
    tag: getUsMarketTag(),
    description: '단기 차익실현 매물 소화 속 소폭 하락 마감. 기술주 중심 견조한 실적 기반 유지.',
    history: [
      { time: '22:30', value: 26803 },
      { time: '23:30', value: 26780 },
      { time: '01:00', value: 26750 },
      { time: '03:00', value: 26720 },
      { time: '05:00', value: 26700 },
      { time: '06:00', value: 26729 },
    ],
  },
  {
    id: 'sp500',
    symbol: 'SPX',
    name: 'S&P 500',
    koreanName: 'S&P 500',
    category: 'us_index',
    price: 7785.76,
    change: -12.40,
    changePercent: -0.16,
    open: 7800.00,
    high: 7815.20,
    low: 7775.30,
    previousClose: 7798.16,
    unit: 'pt',
    tag: getUsMarketTag(),
    description: '사상 최고치권 근방에서 숨고르기. 대형 기술주 및 우량주 전반적으로 안정적 흐름.',
    history: [
      { time: '22:30', value: 7798 },
      { time: '23:30', value: 7792 },
      { time: '01:00', value: 7783 },
      { time: '03:00', value: 7778 },
      { time: '05:00', value: 7780 },
      { time: '06:00', value: 7785 },
    ],
  },
  {
    id: 'phil_semiconductor',
    symbol: 'SOX',
    name: 'PHLX Semiconductor',
    koreanName: '필라델피아 반도체',
    category: 'us_index',
    price: 12417.05,
    change: -38.60,
    changePercent: -0.31,
    open: 12460.00,
    high: 12490.80,
    low: 12390.30,
    previousClose: 12455.65,
    unit: 'pt',
    tag: '국내 삼전/하이닉스 직결',
    description: '반도체 업황 회복 기조 유지. 삼전·하이닉스 등 국내 반도체 밸류체인 직결 지표.',
    history: [
      { time: '22:30', value: 12455 },
      { time: '23:30', value: 12440 },
      { time: '01:00', value: 12420 },
      { time: '03:00', value: 12400 },
      { time: '05:00', value: 12390 },
      { time: '06:00', value: 12417 },
    ],
  },
  {
    id: 'dow_jones',
    symbol: 'DJI',
    name: 'Dow Jones Industrial',
    koreanName: '다우존스 30',
    category: 'us_index',
    price: 53732.41,
    change: -107.80,
    changePercent: -0.20,
    open: 53840.00,
    high: 53890.50,
    low: 53680.20,
    previousClose: 53840.21,
    unit: 'pt',
    tag: getUsMarketTag(),
    description: '경기침체 우려 완화 속 소폭 숨고르기. 가치주 및 방어주 중심으로 낙폭 제한.',
    history: [
      { time: '22:30', value: 53840 },
      { time: '23:30', value: 53820 },
      { time: '01:00', value: 53780 },
      { time: '03:00', value: 53750 },
      { time: '05:00', value: 53720 },
      { time: '06:00', value: 53732 },
    ],
  },

  // 3. US Big Tech & Leaders
  {
    id: 'tech_nvda',
    symbol: 'NVDA',
    name: 'NVIDIA Corp',
    koreanName: '엔비디아',
    category: 'tech',
    price: 225.16,
    change: -0.14,
    changePercent: -0.06,
    open: 225.80,
    high: 227.50,
    low: 223.90,
    previousClose: 225.30,
    unit: '$',
    prefix: '$',
    tag: 'AI 대장주',
    description: '블랙웰 GB200 NVL72 출하 지속 및 데이터센터 수요 견조. 단기 차익실현 후 보합.',
    history: [
      { time: '22:30', value: 225.3 },
      { time: '00:00', value: 225.8 },
      { time: '02:00', value: 226.2 },
      { time: '04:00', value: 225.5 },
      { time: '06:00', value: 225.16 },
    ],
  },
  {
    id: 'tech_tsla',
    symbol: 'TSLA',
    name: 'Tesla Inc',
    koreanName: '테슬라',
    category: 'tech',
    price: 342.27,
    change: 2.32,
    changePercent: 0.68,
    open: 340.50,
    high: 344.80,
    low: 339.20,
    previousClose: 339.95,
    unit: '$',
    prefix: '$',
    tag: '자율주행/로봇',
    description: '로보택시 상용화 기대감 지속 및 에너지 사업부 고성장 속 소폭 상승 마감.',
    history: [
      { time: '22:30', value: 340.0 },
      { time: '00:00', value: 340.8 },
      { time: '02:00', value: 341.5 },
      { time: '04:00', value: 343.2 },
      { time: '06:00', value: 342.27 },
    ],
  },
  {
    id: 'tech_aapl',
    symbol: 'AAPL',
    name: 'Apple Inc',
    koreanName: '애플',
    category: 'tech',
    price: 305.93,
    change: 0.67,
    changePercent: 0.22,
    open: 305.50,
    high: 307.20,
    low: 304.80,
    previousClose: 305.26,
    unit: '$',
    prefix: '$',
    tag: '애플 인텔리전스',
    description: '신제품 수요 견조 및 AI 기능(Apple Intelligence) 확산으로 강세 지속.',
    history: [
      { time: '22:30', value: 305.3 },
      { time: '00:00', value: 305.6 },
      { time: '02:00', value: 306.1 },
      { time: '04:00', value: 306.5 },
      { time: '06:00', value: 305.93 },
    ],
  },
  {
    id: 'tech_tsm',
    symbol: 'TSM',
    name: 'Taiwan Semiconductor',
    koreanName: 'TSMC (ADR)',
    category: 'tech',
    price: 426.35,
    change: -4.14,
    changePercent: -0.96,
    open: 431.00,
    high: 432.50,
    low: 425.00,
    previousClose: 430.49,
    unit: '$',
    prefix: '$',
    tag: '글로벌 파운드리 1위',
    description: '선단 공정 양산 본격화 및 AI 가속기 패키징 물량 증가 추세.',
    history: [
      { time: '22:30', value: 430.5 },
      { time: '00:00', value: 429.8 },
      { time: '02:00', value: 428.0 },
      { time: '04:00', value: 426.8 },
      { time: '06:00', value: 426.35 },
    ],
  },
  {
    id: 'tech_msft',
    symbol: 'MSFT',
    name: 'Microsoft Corp',
    koreanName: '마이크로소프트',
    category: 'tech',
    price: 495.40,
    change: 1.20,
    changePercent: 0.24,
    open: 493.92,
    high: 500.01,
    low: 493.50,
    previousClose: 494.20,
    unit: '$',
    prefix: '$',
    tag: '클라우드 & AI 코파일럿',
    description: 'Azure AI 클라우드 매출 성장 및 Copilot 생태계 확산으로 견조한 흐름.',
    history: [
      { time: '22:30', value: 494.2 },
      { time: '00:00', value: 496.0 },
      { time: '02:00', value: 498.5 },
      { time: '04:00', value: 499.8 },
      { time: '06:00', value: 495.4 },
    ],
  },
  {
    id: 'tech_skhy',
    symbol: 'SKHY',
    name: 'SK Hynix ADR',
    koreanName: 'SK하이닉스 (ADR)',
    category: 'tech',
    price: 166.37,
    change: 0.70,
    changePercent: 0.42,
    open: 165.50,
    high: 167.20,
    low: 165.10,
    previousClose: 165.67,
    unit: '$',
    prefix: '$',
    tag: 'HBM 1위 · 나스닥 ADR',
    description: 'HBM 공급 확대 및 AI GPU 탑재 지속. 나스닥 ADR 상장 후 견조한 흐름.',
    history: [
      { time: '22:30', value: 165.7 },
      { time: '00:00', value: 165.9 },
      { time: '02:00', value: 166.5 },
      { time: '04:00', value: 167.0 },
      { time: '06:00', value: 166.37 },
    ],
  },
  {
    id: 'tech_mu',
    symbol: 'MU',
    name: 'Micron Technology',
    koreanName: '마이크론 테크놀로지',
    category: 'tech',
    price: 971.66,
    change: 21.86,
    changePercent: 2.30,
    open: 952.00,
    high: 975.80,
    low: 950.40,
    previousClose: 949.80,
    unit: '$',
    prefix: '$',
    tag: 'HBM · DRAM · NAND',
    description: 'HBM 생산 확대 및 AI 서버용 고용량 DDR5 수요 급증으로 강세 지속.',
    history: [
      { time: '22:30', value: 950.0 },
      { time: '00:00', value: 958.0 },
      { time: '02:00', value: 965.0 },
      { time: '04:00', value: 974.0 },
      { time: '06:00', value: 971.66 },
    ],
  },
  {
    id: 'tech_sndk',
    symbol: 'SNDK',
    name: 'SanDisk Corp',
    koreanName: '샌디스크',
    category: 'tech',
    price: 1641.11,
    change: 28.50,
    changePercent: 1.77,
    open: 1615.00,
    high: 1648.00,
    low: 1612.30,
    previousClose: 1612.61,
    unit: '$',
    prefix: '$',
    tag: 'NAND Flash',
    description: '낸드플래시 수요 회복 및 기업용 고용량 SSD 수주 증가로 강세.',
    history: [
      { time: '22:30', value: 1613.0 },
      { time: '00:00', value: 1622.0 },
      { time: '02:00', value: 1635.0 },
      { time: '04:00', value: 1646.0 },
      { time: '06:00', value: 1641.11 },
    ],
  },

  // 4. Macro Indicators
  {
    id: 'fx_usdkrw',
    symbol: 'USDKRW',
    name: 'USD / KRW',
    koreanName: '원/달러 환율',
    category: 'macro',
    price: 1416.61,
    change: -2.00,
    changePercent: -0.14,
    open: 1418.50,
    high: 1420.30,
    low: 1415.80,
    previousClose: 1418.61,
    unit: '원',
    tag: '환율 박스권 등락',
    description: '달러화 지수 및 외국인 수급 변동 속 환율 소폭 하락.',
    history: [
      { time: '18:00', value: 1418.6 },
      { time: '22:00', value: 1419.2 },
      { time: '01:00', value: 1418.0 },
      { time: '04:00', value: 1417.1 },
      { time: '06:00', value: 1416.61 },
    ],
  },
  {
    id: 'macro_us10y',
    symbol: 'US10Y',
    name: 'US 10-Yr Treasury Yield',
    koreanName: '미 국채 10년물 금리',
    category: 'macro',
    price: 4.664,
    change: 0.025,
    changePercent: 0.54,
    open: 4.639,
    high: 4.685,
    low: 4.630,
    previousClose: 4.639,
    unit: '%',
    tag: '글로벌 벤치마크 금리',
    description: '미 연준 통화정책 전망 및 거시경제 지표에 연동되는 글로벌 대표 기준 금리.',
    history: [
      { time: '18:00', value: 4.64 },
      { time: '22:00', value: 4.65 },
      { time: '01:00', value: 4.67 },
      { time: '04:00', value: 4.69 },
      { time: '06:00', value: 4.66 },
    ],
  },
  {
    id: 'macro_us30y',
    symbol: 'US30Y',
    name: 'US 30-Yr Treasury Yield',
    koreanName: '미 국채 30년물 금리',
    category: 'macro',
    price: 5.186,
    change: 0.012,
    changePercent: 0.23,
    open: 5.174,
    high: 5.210,
    low: 5.165,
    previousClose: 5.174,
    unit: '%',
    tag: '초장기물 금리 (모기지/유동성)',
    description: '미 국채 30년물 금리는 장기 인플레이션 및 모기지 금리, 글로벌 장기 자금 조달 비용의 핵심 벤치마크입니다.',
    history: [
      { time: '18:00', value: 5.17 },
      { time: '22:00', value: 5.18 },
      { time: '01:00', value: 5.20 },
      { time: '04:00', value: 5.19 },
      { time: '06:00', value: 5.186 },
    ],
  },
  {
    id: 'macro_vix',
    symbol: 'VIX',
    name: 'CBOE Volatility Index',
    koreanName: 'VIX 공포지수',
    category: 'macro',
    price: 14.25,
    change: -0.35,
    changePercent: -2.40,
    open: 14.60,
    high: 14.75,
    low: 14.10,
    previousClose: 14.60,
    unit: 'pt',
    tag: '투자심리 안정 (15 이하)',
    description: '증시 변동성 안정권(15pt 미만) 유지. 투자심리 긍정적, 시장 안정적 흐름.',
    history: [
      { time: '22:30', value: 14.6 },
      { time: '00:00', value: 14.5 },
      { time: '02:00', value: 14.3 },
      { time: '04:00', value: 14.2 },
      { time: '06:00', value: 14.25 },
    ],
  },
  {
    id: 'macro_wti',
    symbol: 'CL',
    name: 'WTI Crude Oil',
    koreanName: 'WTI 원유',
    category: 'commodity',
    price: 82.16,
    change: 0.91,
    changePercent: 1.12,
    open: 81.25,
    high: 82.60,
    low: 81.10,
    previousClose: 81.25,
    unit: '$',
    prefix: '$',
    tag: '국제 유가 동향',
    description: '중동 지정학적 이슈 및 공급/수요 전망에 따른 국제유가 등락 추이.',
    history: [
      { time: '18:00', value: 81.25 },
      { time: '22:00', value: 81.60 },
      { time: '01:00', value: 81.90 },
      { time: '04:00', value: 82.40 },
      { time: '06:00', value: 82.16 },
    ],
  },

  // 5. Crypto
  { id: 'crypto_bitcoin',  symbol: 'BTC-USD', name: 'Bitcoin',  koreanName: '비트코인', category: 'crypto', price: 0, change: 0, changePercent: 0, open: 0, high: 0, low: 0, previousClose: 0, unit: '$', prefix: '$', tag: '24시간 실시간', description: '대표 디지털 자산의 24시간 가격 추세입니다.', history: [{ time: '00:00', value: 1 }, { time: '06:00', value: 1 }, { time: '12:00', value: 1 }] },
  { id: 'crypto_ethereum', symbol: 'ETH-USD', name: 'Ethereum', koreanName: '이더리움',  category: 'crypto', price: 0, change: 0, changePercent: 0, open: 0, high: 0, low: 0, previousClose: 0, unit: '$', prefix: '$', tag: '24시간 실시간', description: '스마트 컨트랙트 생태계 대표 자산의 24시간 가격 추세입니다.', history: [{ time: '00:00', value: 1 }, { time: '06:00', value: 1 }, { time: '12:00', value: 1 }] },
  { id: 'crypto_solana',   symbol: 'SOL-USD', name: 'Solana',   koreanName: '솔라나',    category: 'crypto', price: 0, change: 0, changePercent: 0, open: 0, high: 0, low: 0, previousClose: 0, unit: '$', prefix: '$', tag: '24시간 실시간', description: '고성능 블록체인 자산의 24시간 가격 추세입니다.', history: [{ time: '00:00', value: 1 }, { time: '06:00', value: 1 }, { time: '12:00', value: 1 }] },
  { id: 'crypto_xrp',      symbol: 'XRP-USD', name: 'XRP',      koreanName: '리플',      category: 'crypto', price: 0, change: 0, changePercent: 0, open: 0, high: 0, low: 0, previousClose: 0, unit: '$', prefix: '$', tag: '24시간 실시간', description: '송금·결제 네트워크 기반 자산의 24시간 가격 추세입니다.', history: [{ time: '00:00', value: 1 }, { time: '06:00', value: 1 }, { time: '12:00', value: 1 }] },
];

// ---------------------------------------------------------------------------
// Initial briefing (static seed)
// ---------------------------------------------------------------------------
export const INITIAL_MORNING_BRIEFING: MorningBriefing = {
  dateString: getCurrentMorningDateString().dateString + ` (${getCurrentMorningDateString().dayString[0]})`,
  dayOfWeek: getCurrentMorningDateString().dayString,
  updatedAt: `${getUsMarketTag()} 기준`,
  marketTone: 'bullish',
  marketToneBadge: '🚀 코스피 상승 출발 시도',
  marketToneHeadline: '야간선물 강세 및 미 증시 실시간 시세 반영 · 코스피 시초가 우상향 시도',
  expectedKospiOpen: '6,950 pt',
  expectedKospiOpenRange: '예상 범위 6,930 ~ 6,970 pt · 상승 출발',
  expectedKospiChange: '+0.72% (+19.5pt)',
  confidenceRate: 85,
  summaryBullets: [
    '🌙 코스피 200 야간선물 실시간 데이터 없음',
    '📊 미 나스닥·S&P 500 및 필라델피아 반도체 시황 연동 중',
    '💵 원/달러 환율 1,416.61원, 미 국채 10년 4.66% / 30년 5.19%',
  ],
  keyDrivers: [
    { title: '코스피 시초가 상승 모멘텀', impact: 'positive', desc: '야간선물 +0.80% 상승으로 정규장 갭상승 출발 우세' },
    { title: '미 증시 및 글로벌 반도체',  impact: 'positive', desc: '엔비디아 및 주요 빅테크 견조한 흐름 유지' },
    { title: '환율 및 10년/30년 금리',    impact: 'neutral',  desc: '원/달러 환율 1,416원대 및 미 30년물 국채금리 5.18%대 등락' },
  ],
  nightSessionStats: {
    nightClose: 0,
    nightChange: 0,
    nightChangePercent: 0,
    volumeContracts: '실시간 데이터 없음',
    foreignBuyingNet: '실시간 데이터 없음',
    tradingHours: '전일 18:00 ~ 금일 06:00 (CME 연계 KRX)',
  },
  fearAndGreedIndex: { score: 62, rating: 'Greed (탐욕 - 매수 심리 우세)', previousClose: 58 },
  cryptoFearAndGreedIndex: { score: 74, rating: 'Greed (탐욕 - 매수 심리 우세)', previousClose: 65 },
};

/**
 * Normalize a cached/incomplete MorningBriefing so newly added fields always
 * exist. Without this, an upgrade would crash on
 * briefing.cryptoFearAndGreedIndex.score when the old cache lacks the field.
 */
function normalizeBriefing(b: Partial<MorningBriefing>): MorningBriefing {
  return {
    ...INITIAL_MORNING_BRIEFING,
    ...b,
    nightSessionStats: {
      ...INITIAL_MORNING_BRIEFING.nightSessionStats,
      ...(b.nightSessionStats || {}),
    },
    fearAndGreedIndex: {
      ...INITIAL_MORNING_BRIEFING.fearAndGreedIndex,
      ...(b.fearAndGreedIndex || {}),
    },
    cryptoFearAndGreedIndex: {
      ...INITIAL_MORNING_BRIEFING.cryptoFearAndGreedIndex,
      ...(b.cryptoFearAndGreedIndex || {}),
    },
  };
}

// ---------------------------------------------------------------------------
// MarketService
// ---------------------------------------------------------------------------
export const MarketService = {
  async getMarketItems(): Promise<MarketItem[]> {
    try {
      const cached = await AsyncStorage.getItem(CACHED_ITEMS_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return INITIAL_MARKET_ITEMS;
  },

  async getMorningBriefing(): Promise<MorningBriefing> {
    try {
      const cached = await AsyncStorage.getItem(CACHED_BRIEFING_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Partial<MorningBriefing>;
        return normalizeBriefing(parsed);
      }
    } catch {}
    return INITIAL_MORNING_BRIEFING;
  },

  async getMarketItemById(id: string): Promise<MarketItem | undefined> {
    const items = await this.getMarketItems();
    return items.find((item) => item.id === id);
  },

  async getUserPreferences(): Promise<UserPreferences> {
    try {
      const data = await AsyncStorage.getItem(PREFS_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to load user preferences', e);
    }
    return {
      morningAlertEnabled: true,
      morningAlertTime: '07:30',
      enableHaptics: true,
      favorites: ['kospi_night_futures', 'nasdaq_comp', 'phil_semiconductor', 'tech_nvda', 'fx_usdkrw', 'macro_us10y', 'macro_us30y'],
      defaultTab: 'overview',
    };
  },

  async saveUserPreferences(prefs: UserPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save user preferences', e);
    }
  },

  /**
   * Refresh all market data via the provider layer (Twelve Data + Korea Market).
   * Falls back to cached / initial data on any error.
   */
  async refreshData(
    currentItems: MarketItem[],
  ): Promise<{
    items: MarketItem[];
    briefing: MorningBriefing;
    fetchedAt: string | null;
    hasLiveData: boolean;
  }> {
    try {
      const result = await fetchAllMarketData(currentItems);

      if (result.warnings.length > 0) {
        console.warn('[MarketService] refresh warnings:', result.warnings.join('; '));
      }

      // Persist to cache
      AsyncStorage.setItem(CACHED_ITEMS_KEY, JSON.stringify(result.items)).catch(() => {});
      AsyncStorage.setItem(CACHED_BRIEFING_KEY, JSON.stringify(result.briefing)).catch(() => {});

      return {
        items: result.items,
        briefing: result.briefing,
        fetchedAt: result.fetchedAt,
        hasLiveData: result.hasLiveData,
      };
    } catch (e) {
      console.warn('[MarketService] refreshData error, using cached data:', e);
      return {
        items: currentItems,
        briefing: INITIAL_MORNING_BRIEFING,
        fetchedAt: null,
        hasLiveData: false,
      };
    }
  },
};
