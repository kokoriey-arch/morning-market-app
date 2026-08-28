export type MarketCategory = 'kospi' | 'us_index' | 'tech' | 'macro' | 'commodity' | 'crypto';

export interface SparklinePoint {
  time: string;
  value: number;
}

export interface MarketItem {
  id: string;
  symbol: string;
  name: string;
  koreanName: string;
  category: MarketCategory;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume?: string;
  unit: string;
  prefix?: string;
  isNightFutures?: boolean;
  history: SparklinePoint[];
  description?: string;
  tag?: string;
}

export interface MorningBriefing {
  dateString: string;
  dayOfWeek: string;
  updatedAt: string;
  marketTone: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  marketToneBadge: string;
  marketToneHeadline: string;
  expectedKospiOpen: string;
  expectedKospiOpenRange: string;
  expectedKospiChange: string;
  confidenceRate: number;
  summaryBullets: string[];
  keyDrivers: {
    title: string;
    impact: 'positive' | 'negative' | 'neutral';
    desc: string;
  }[];
  nightSessionStats: {
    nightClose: number;
    nightChange: number;
    nightChangePercent: number;
    volumeContracts: string;
    foreignBuyingNet: string;
    tradingHours: string;
  };
  fearAndGreedIndex: {
    score: number;
    rating: string;
    previousClose: number;
  };
}

export interface UserPreferences {
  morningAlertEnabled: boolean;
  morningAlertTime: string; // e.g. "07:30"
  enableHaptics: boolean;
  favorites: string[]; // List of market item IDs
  defaultTab: 'overview' | 'kospi' | 'us' | 'macro';
}
