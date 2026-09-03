/**
 * Configuration for AI Market Signal evaluation and stock watchlists.
 */

export interface TargetStockConfig {
  code: string;
  name: string;
  category: string;
}

export const TARGET_STOCKS: TargetStockConfig[] = [
  { code: '005930', name: '삼성전자', category: '반도체 / 대형주' },
  { code: '000660', name: 'SK하이닉스', category: '반도체 / HBM' },
  { code: '034220', name: 'LG디스플레이', category: 'IT / 디스플레이' },
  { code: '034020', name: '두산에너빌리티', category: '원전 / 에너지' },
  { code: '042700', name: '한미반도체', category: '반도체 / 후공정' },
];

export const TARGET_ETFS = [
  { symbol: 'QQQ',  name: 'Invesco QQQ (Nasdaq-100)' },
  { symbol: 'QQQM', name: 'Invesco NASDAQ 100 ETF' },
  { symbol: 'SOXX', name: 'iShares Semiconductor ETF' },
  { symbol: 'SMH',  name: 'VanEck Semiconductor ETF' },
  { symbol: 'XLK',  name: 'Technology Select Sector SPDR' },
  { symbol: 'SPY',  name: 'SPDR S&P 500 ETF' },
  { symbol: 'DIA',  name: 'SPDR Dow Jones Industrial' },
  { symbol: 'IWM',  name: 'iShares Russell 2000 ETF' },
];

export const SIGNAL_THRESHOLDS = {
  vix: {
    low: 15.0,    // VIX < 15: LOW (안정/위험선호)
    high: 22.0,   // VIX > 22: HIGH (공포/위험회피)
  },
  etfChange: {
    bullish: 0.5, // > +0.5%: BULLISH
    bearish: -0.5,// < -0.5%: BEARISH
  },
  kospiChange: {
    up: 0.2,      // > +0.2%: UP
    down: -0.2,   // < -0.2%: DOWN
  },
  flowNetThreshold: 0, // > 0: BUY, < 0: SELL
};
