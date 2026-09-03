/**
 * Kiwoom domestic stock quotation service.
 *
 * Implements:
 *  A. get_stock_info(stock_code)      - CTPF1002R
 *  B. get_stock_price(stock_code)     - FHKST01010100
 *  C. get_investor_trend(stock_code)  - FHKST01010900
 *  D. get_investor_estimate(stock_code)- HHPTJ04160200
 *  E. get_program_trade(stock_code)   - FHPPG04650100
 *  F. get_kospi_index() / get_index_price() - FHPUP02100000
 */

import {
  KisStockInfo,
  KisStockPrice,
  KisInvestorTrend,
  KisInvestorEstimate,
  KisProgramTrade,
  KisIndexPrice,
} from '../../types/aiAnalysis';
import { kiwoomRequest, isKiwoomConfigured } from './kisClient';
import { TARGET_STOCKS } from '../ai/marketSignalConfig';

// ---------------------------------------------------------------------------
// A. 종목 기본정보 (CTPF1002R)
// ---------------------------------------------------------------------------
export async function get_stock_info(stock_code: string): Promise<KisStockInfo | null> {
  if (!isKiwoomConfigured()) {
    return getFallbackStockInfo(stock_code);
  }

  interface InfoResponse {
    stk_cd?: string;
    stk_nm?: string;
    mac?: string;
    for_exh_rt?: string;
    per?: string;
    pbr?: string;
    eps?: string;
    bps?: string;
  }

  const res = await kiwoomRequest<InfoResponse>({
    endpoint: '/api/dostk/stkinfo',
    apiId: 'ka10001',
    body: { stk_cd: stock_code },
  });

  if (!res || !res.stk_nm) {
    return getFallbackStockInfo(stock_code);
  }

  const out = res;
  return {
    code: stock_code,
    name: out.stk_nm || getStockName(stock_code),
    market: 'KOSPI',
    standardCode: out.stk_cd || stock_code,
    isFallback: false,
  };
}

// ---------------------------------------------------------------------------
// B. 국내주식 시세표성정보 (ka10007)
// ---------------------------------------------------------------------------
export async function get_stock_price(stock_code: string): Promise<KisStockPrice | null> {
  if (!isKiwoomConfigured()) {
    return getFallbackStockPrice(stock_code);
  }

  interface PriceResponse {
    cur_prc?: string;
    pred_rt?: string;
    flu_rt?: string;
    open_pric?: string;
    high_pric?: string;
    low_pric?: string;
    trde_qty?: string;
    trde_prica?: string;
    flo_stkcnt?: string;
    for_exh_rt?: string;
    per?: string;
    pbr?: string;
    eps?: string;
    bps?: string;
  }

  const res = await kiwoomRequest<PriceResponse>({
    endpoint: '/api/dostk/mrkcond',
    apiId: 'ka10007',
    body: { stk_cd: stock_code },
  });

  if (!res || !res.cur_prc) {
    return getFallbackStockPrice(stock_code);
  }

  const out = res;
  const price = Math.abs(Number(out.cur_prc)) || 0;
  const change = Number(out.pred_rt) || 0;
  const changeRate = Number(out.flu_rt) || 0;

  return {
    code: stock_code,
    name: getStockName(stock_code),
    price,
    change,
    changeRate,
    open: Math.abs(Number(out.open_pric)) || price,
    high: Math.abs(Number(out.high_pric)) || price,
    low: Math.abs(Number(out.low_pric)) || price,
    volume: Math.abs(Number(out.trde_qty)) || 0,
    tradeAmount: Math.abs(Number(out.trde_prica)) || 0,
    marketCap: Math.abs(Number(out.flo_stkcnt)) * price || 0,
    per: Number(out.per) || 0,
    pbr: Number(out.pbr) || 0,
    eps: Number(out.eps) || 0,
    bps: Number(out.bps) || 0,
    foreignHoldingRate: Number(out.for_exh_rt) || 0,
    isFallback: false,
  };
}

// ---------------------------------------------------------------------------
// C. 투자자별 매매동향 (FHKST01010900)
// ---------------------------------------------------------------------------
export async function get_investor_trend(stock_code: string): Promise<KisInvestorTrend | null> {
  if (!isKiwoomConfigured()) {
    return getFallbackInvestorTrend(stock_code);
  }

  interface InvestorResponse {
    stk_orgn_trde_trnsn?: {
      dt?: string;
      orgn_daly_nettrde_qty?: string;
      for_daly_nettrde_qty?: string;
    }[];
  }

  const res = await kiwoomRequest<InvestorResponse>({
    endpoint: '/api/dostk/mrkcond',
    apiId: 'ka10045',
    body: {
      stk_cd: stock_code,
      strt_dt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, ''),
      end_dt: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      orgn_prsm_unp_tp: '1',
      for_prsm_unp_tp: '1',
    },
  });

  const latest = res?.stk_orgn_trde_trnsn?.[0];
  if (!latest) {
    return getFallbackInvestorTrend(stock_code);
  }

  return {
    code: stock_code,
    date: latest.dt || new Date().toISOString().slice(0, 10),
    individualNetBuy: 0,
    foreignNetBuy: Number(latest.for_daly_nettrde_qty) || 0,
    institutionNetBuy: Number(latest.orgn_daly_nettrde_qty) || 0,
    isFallback: false,
  };
}

// ---------------------------------------------------------------------------
// D. 장중 외국인/기관 추정 수급 (HHPTJ04160200)
// ---------------------------------------------------------------------------
export async function get_investor_estimate(stock_code: string): Promise<KisInvestorEstimate | null> {
  return getFallbackInvestorEstimate(stock_code);
}

// ---------------------------------------------------------------------------
// E. 프로그램 매매 (FHPPG04650100)
// ---------------------------------------------------------------------------
export async function get_program_trade(stock_code: string): Promise<KisProgramTrade | null> {
  if (!isKiwoomConfigured()) {
    return getFallbackProgramTrade(stock_code);
  }

  interface ProgramResponse {
    stk_prm_trde_prst?: {
      stk_cd?: string;
      buy_cntr_qty?: string;
      sel_cntr_qty?: string;
      netprps_prica?: string;
    }[];
  }

  const res = await kiwoomRequest<ProgramResponse>({
    endpoint: '/api/dostk/stkinfo',
    apiId: 'ka90004',
    body: { dt: new Date().toISOString().slice(0, 10).replace(/-/g, ''), mrkt_tp: 'P00101', stex_tp: '3' },
  });

  const out = Array.isArray(res?.stk_prm_trde_prst)
    ? res.stk_prm_trde_prst.find((item) => item.stk_cd === stock_code)
    : undefined;
  if (!out) {
    return getFallbackProgramTrade(stock_code);
  }

  return {
    code: stock_code,
    programNetBuy: Number(out.netprps_prica) || 0,
    programBuy: Number(out.buy_cntr_qty) || 0,
    programSell: Number(out.sel_cntr_qty) || 0,
    totalVolume: Number(out.buy_cntr_qty) + Number(out.sel_cntr_qty) || 0,
    isFallback: false,
  };
}

// ---------------------------------------------------------------------------
// F. KOSPI / KOSDAQ 지수 (FHPUP02100000)
// ---------------------------------------------------------------------------
export async function get_index_price(indexCode: '0001' | '1001' = '0001'): Promise<KisIndexPrice | null> {
  const isKospi = indexCode === '0001';
  const name = isKospi ? '코스피' : '코스닥';

  if (!isKiwoomConfigured()) {
    return getFallbackIndexPrice(indexCode);
  }

  interface IndexResponse {
    cur_prc?: string;
    pred_pre?: string;
    flu_rt?: string;
    open_pric?: string;
    high_pric?: string;
    low_pric?: string;
    acc_trde_qty?: string;
    trde_prica?: string;
  }

  const res = await kiwoomRequest<IndexResponse>({
    endpoint: '/api/dostk/sect',
    apiId: 'ka20001',
    body: { mrkt_tp: isKospi ? '0' : '1', inds_cd: isKospi ? '001' : '101' },
  });

  const out = res;
  if (!out) {
    return getFallbackIndexPrice(indexCode);
  }

  const price = Math.abs(Number(out.cur_prc)) || 0;
  return {
    code: indexCode,
    name,
    price,
    change: Number(out.pred_pre) || 0,
    changeRate: Number(out.flu_rt) || 0,
    open: Math.abs(Number(out.open_pric)) || price,
    high: Math.abs(Number(out.high_pric)) || price,
    low: Math.abs(Number(out.low_pric)) || price,
    volume: Math.abs(Number(out.acc_trde_qty)) || 0,
    tradeAmount: Math.abs(Number(out.trde_prica)) || 0,
    isFallback: false,
  };
}

export async function get_kospi_index(): Promise<KisIndexPrice | null> {
  return get_index_price('0001');
}

// ---------------------------------------------------------------------------
// Helpers & Fallbacks (키 미입력 또는 통신 실패 시 정상 UI 유지를 위한 모의 데이터)
// ---------------------------------------------------------------------------

function getStockName(code: string): string {
  const match = TARGET_STOCKS.find((s) => s.code === code);
  return match ? match.name : code;
}

function getFallbackStockInfo(code: string): KisStockInfo {
  return {
    code,
    name: getStockName(code),
    market: 'KOSPI',
    sector: code === '005930' || code === '000660' || code === '042700' ? '전기전자 / 반도체' : '기계 / 중공업',
    isFallback: true,
  };
}

function getFallbackStockPrice(code: string): KisStockPrice {
  const defaults: Record<string, { price: number; change: number; changeRate: number; per: number; pbr: number }> = {
    '005930': { price: 74200, change: 1100, changeRate: 1.50, per: 14.8, pbr: 1.25 },
    '000660': { price: 218500, change: 6500, changeRate: 3.07, per: 11.2, pbr: 2.10 },
    '034220': { price: 11250, change: -150, changeRate: -1.32, per: 0.0, pbr: 0.72 },
    '034020': { price: 19800, change: 400, changeRate: 2.06, per: 24.5, pbr: 1.45 },
    '042700': { price: 124500, change: 3200, changeRate: 2.64, per: 32.1, pbr: 5.40 },
  };

  const d = defaults[code] || { price: 50000, change: 0, changeRate: 0, per: 15, pbr: 1.5 };
  return {
    code,
    name: getStockName(code),
    price: d.price,
    change: d.change,
    changeRate: d.changeRate,
    open: d.price - d.change,
    high: d.price + Math.abs(d.change) * 1.2,
    low: d.price - Math.abs(d.change) * 0.8,
    volume: 12_850_000,
    tradeAmount: 954_000_000_000,
    marketCap: d.price * 5_969_782_550,
    per: d.per,
    pbr: d.pbr,
    eps: Math.round(d.price / (d.per || 1)),
    bps: Math.round(d.price / (d.pbr || 1)),
    foreignHoldingRate: code === '005930' ? 52.8 : code === '000660' ? 54.2 : 24.1,
    isFallback: true,
  };
}

function getFallbackInvestorTrend(code: string): KisInvestorTrend {
  const isMajor = code === '005930' || code === '000660';
  return {
    code,
    date: new Date().toISOString().slice(0, 10),
    individualNetBuy: isMajor ? -420_000 : 85_000,
    foreignNetBuy: isMajor ? 310_000 : -45_000,
    institutionNetBuy: isMajor ? 110_000 : -40_000,
    isFallback: true,
  };
}

function getFallbackInvestorEstimate(code: string): KisInvestorEstimate {
  const isMajor = code === '005930' || code === '000660';
  return {
    code,
    time: '14:30',
    foreignEstimateNetBuy: isMajor ? 280_000 : -35_000,
    institutionEstimateNetBuy: isMajor ? 95_000 : -20_000,
    isEstimate: true,
    isFallback: true,
  };
}

function getFallbackProgramTrade(code: string): KisProgramTrade {
  const isMajor = code === '005930' || code === '000660';
  return {
    code,
    programNetBuy: isMajor ? 245_000 : -25_000,
    programBuy: 850_000,
    programSell: isMajor ? 605_000 : 875_000,
    totalVolume: 3_500_000,
    isFallback: true,
  };
}

function getFallbackIndexPrice(indexCode: '0001' | '1001'): KisIndexPrice {
  const isKospi = indexCode === '0001';
  return {
    code: indexCode,
    name: isKospi ? '코스피' : '코스닥',
    price: isKospi ? 2685.45 : 842.10,
    change: isKospi ? 18.25 : 3.40,
    changeRate: isKospi ? 0.68 : 0.41,
    open: isKospi ? 2672.00 : 840.00,
    high: isKospi ? 2690.10 : 844.50,
    low: isKospi ? 2668.50 : 838.20,
    volume: 480_000_000,
    tradeAmount: 9_450_000_000_000,
    isFallback: true,
  };
}
