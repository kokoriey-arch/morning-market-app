/**
 * Types for Kiwoom REST API, Yahoo Finance VIX & US ETFs, and AI Analysis.
 */

// ---------------------------------------------------------------------------
// Kiwoom domestic stock models
// ---------------------------------------------------------------------------

export interface KisStockInfo {
  code: string;
  name: string;
  market: string; // KOSPI / KOSDAQ
  sector?: string;
  standardCode?: string;
  isFallback?: boolean;
}

export interface KisStockPrice {
  code: string;
  name: string;
  price: number;
  change: number;
  changeRate: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  tradeAmount: number; // 거래대금 (원)
  marketCap: number;   // 시가총액 (억원 또는 원)
  per: number;
  pbr: number;
  eps: number;
  bps: number;
  foreignHoldingRate: number; // 외국인 보유율 (%)
  isFallback?: boolean;
}

export interface KisInvestorTrend {
  code: string;
  date: string;
  individualNetBuy: number; // 개인 순매수 (주 또는 백만원)
  foreignNetBuy: number;    // 외국인 순매수
  institutionNetBuy: number;// 기관 순매수
  isFallback?: boolean;
}

export interface KisInvestorEstimate {
  code: string;
  time: string;
  foreignEstimateNetBuy: number;    // 외국인 추정 순매수
  institutionEstimateNetBuy: number;// 기관 추정 순매수
  isEstimate: true;
  isFallback?: boolean;
}

export interface KisProgramTrade {
  code: string;
  programNetBuy: number; // 프로그램 순매수 (주 또는 원)
  programBuy: number;    // 매수
  programSell: number;   // 매도
  totalVolume: number;
  isFallback?: boolean;
}

export interface KisIndexPrice {
  code: string;          // 0001 (KOSPI), 1001 (KOSDAQ)
  name: string;
  price: number;
  change: number;
  changeRate: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  tradeAmount: number;
  isFallback?: boolean;
}

// ---------------------------------------------------------------------------
// Yahoo Finance: VIX & US ETFs
// ---------------------------------------------------------------------------

export interface VixData {
  symbol: string;
  price: number;
  change: number;
  changeRate: number;
  level: 'LOW' | 'NORMAL' | 'HIGH';
}

export interface UsEtfData {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changeRate: number;
  volume: number;
  tradeAmount?: number;
  return1D: number;  // 1일 수익률 (%)
  return5D: number;  // 5일 수익률 (%)
  return20D: number; // 20일 수익률 (%)
}

// ---------------------------------------------------------------------------
// AI Market Signals & 종합 판단
// ---------------------------------------------------------------------------

export type SignalTrend = 'UP' | 'DOWN' | 'FLAT';
export type SignalLevel = 'LOW' | 'NORMAL' | 'HIGH';
export type SignalSentiment = 'BULLISH' | 'NEUTRAL' | 'BEARISH';
export type SignalFlow = 'BUY' | 'SELL' | 'NEUTRAL';

export interface MarketSignal {
  kospi_trend: SignalTrend;
  vix_level: SignalLevel;
  nasdaq_signal: SignalSentiment;
  semiconductor_signal: SignalSentiment;
  foreign_flow: SignalFlow;
  institution_flow: SignalFlow;
  program_flow: SignalFlow;

  // AI 종합 요약 해설
  overall_judgment: string;
  foreign_commentary: string;
  institution_commentary: string;
  program_commentary: string;
  us_tech_impact: string;
  semiconductor_impact: string;
  vix_risk: string;
}

// ---------------------------------------------------------------------------
// Unified Market Analysis Model
// ---------------------------------------------------------------------------

export interface StockAnalysisData {
  code: string;
  name: string;
  info?: KisStockInfo;
  price: KisStockPrice;
  investor?: KisInvestorTrend;
  investorEstimate?: KisInvestorEstimate;
  program?: KisProgramTrade;
}

export interface UnifiedMarketData {
  kospi: KisIndexPrice;
  kosdaq?: KisIndexPrice;
  vix: VixData;
  us_etf: Record<string, UsEtfData>;
  stocks: Record<string, StockAnalysisData>;
  signals: MarketSignal;
  lastUpdated: string;
  isKiwoomLive: boolean; // true면 실제 Kiwoom API 연동됨, false면 fallback/시뮬레이션
  sourceLabel: '🟢 KIWOOM LIVE' | '🟡 MOCK / FALLBACK';
}
