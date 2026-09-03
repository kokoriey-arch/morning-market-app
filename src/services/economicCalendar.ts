import AsyncStorage from '@react-native-async-storage/async-storage';
import { EconomicEvent } from '../types/market';

const ALERTS_STORAGE_KEY = '@morning_market_event_alerts_enabled_v1';

// ---------------------------------------------------------------------------
// Static event data – covers current week ± a few days around today
// ---------------------------------------------------------------------------

function buildEvents(): EconomicEvent[] {
  // Build dates relative to "today" so the calendar always shows relevant data
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const offsetDate = (days: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  return [
    // ── Yesterday ──────────────────────────────────────────────────────────
    {
      id: 'ev_001',
      date: offsetDate(-1),
      time: '21:30',
      title: 'Initial Jobless Claims',
      koreanTitle: '신규 실업수당 청구건수',
      category: '노동',
      importance: 'medium',
      description: '미국 주간 실업수당 신규 청구 건수로 노동시장 건전성을 파악하는 선행지표.',
      forecast: '215K',
      previous: '212K',
    },
    {
      id: 'ev_002',
      date: offsetDate(-1),
      time: '23:00',
      title: 'Existing Home Sales',
      koreanTitle: '기존 주택 판매',
      category: '부동산',
      importance: 'low',
      description: '기존 주택의 월간 판매량으로 소비심리 및 금리 민감도를 반영.',
      forecast: '3.96M',
      previous: '4.01M',
    },

    // ── Today ───────────────────────────────────────────────────────────────
    {
      id: 'ev_003',
      date: todayStr,
      time: '21:30',
      title: 'Core PCE Price Index (MoM)',
      koreanTitle: '근원 PCE 물가지수 (월)',
      category: '인플레이션',
      importance: 'high',
      description: '연준이 선호하는 물가 지표. 에너지·식품 제외 소비지출 물가 변동으로 금리 경로에 직접 영향.',
      forecast: '+0.2%',
      previous: '+0.3%',
    },
    {
      id: 'ev_004',
      date: todayStr,
      time: '21:30',
      title: 'Personal Income (MoM)',
      koreanTitle: '개인 소득 (월)',
      category: '소비',
      importance: 'medium',
      description: '미국 가계 소득 변화로 소비 여력과 경제 성장 모멘텀을 가늠.',
      forecast: '+0.4%',
      previous: '+0.5%',
    },
    {
      id: 'ev_005',
      date: todayStr,
      time: '23:00',
      title: 'University of Michigan Consumer Sentiment (Final)',
      koreanTitle: '미시간대 소비자심리지수 (확정)',
      category: '소비심리',
      importance: 'medium',
      description: '미국 소비자 신뢰도 최종 확정치. 예비치 대비 변화 여부 주목.',
      forecast: '68.5',
      previous: '66.4',
    },

    // ── Tomorrow ────────────────────────────────────────────────────────────
    {
      id: 'ev_006',
      date: offsetDate(1),
      time: '22:45',
      title: 'S&P Global Manufacturing PMI (Final)',
      koreanTitle: 'S&P 글로벌 제조업 PMI (확정)',
      category: '경기',
      importance: 'medium',
      description: '제조업 경기 확산지수 최종치. 50 이상이면 경기 확장, 이하이면 수축을 의미.',
      forecast: '49.5',
      previous: '48.5',
    },
    {
      id: 'ev_007',
      date: offsetDate(1),
      time: '23:00',
      title: 'ISM Manufacturing PMI',
      koreanTitle: 'ISM 제조업 PMI',
      category: '경기',
      importance: 'high',
      description: '미국 공급관리협회 발표 제조업 경기지수. 고용·신규주문·생산 하위지수 함께 주목.',
      forecast: '48.8',
      previous: '48.4',
    },
    {
      id: 'ev_008',
      date: offsetDate(1),
      time: '23:00',
      title: 'Construction Spending (MoM)',
      koreanTitle: '건설지출 (월)',
      category: '부동산',
      importance: 'low',
      description: '공공·민간 건설지출 합계로 경제활동과 고용 창출을 가늠하는 보조 지표.',
      forecast: '+0.2%',
      previous: '-0.1%',
    },

    // ── Day after tomorrow ──────────────────────────────────────────────────
    {
      id: 'ev_009',
      date: offsetDate(2),
      time: '21:30',
      title: 'Nonfarm Payrolls',
      koreanTitle: '비농업 고용 (NFP)',
      category: '노동',
      importance: 'high',
      description: '가장 중요한 월간 고용지표. 예상치 대비 큰 편차는 달러와 주식시장에 즉각 영향.',
      forecast: '175K',
      previous: '189K',
    },
    {
      id: 'ev_010',
      date: offsetDate(2),
      time: '21:30',
      title: 'Unemployment Rate',
      koreanTitle: '실업률',
      category: '노동',
      importance: 'high',
      description: '비농업 고용과 동시 발표. 연준 이중 책무(고용 최대화·물가 안정) 중 하나를 직접 반영.',
      forecast: '4.2%',
      previous: '4.1%',
    },
    {
      id: 'ev_011',
      date: offsetDate(2),
      time: '21:30',
      title: 'Average Hourly Earnings (MoM)',
      koreanTitle: '시간당 평균 임금 (월)',
      category: '노동',
      importance: 'high',
      description: '임금 인플레이션 선행지표로 연준의 추가 금리 결정에 핵심 변수.',
      forecast: '+0.3%',
      previous: '+0.4%',
    },

    // ── 3 days out ──────────────────────────────────────────────────────────
    {
      id: 'ev_012',
      date: offsetDate(3),
      time: '22:45',
      title: 'S&P Global Services PMI (Final)',
      koreanTitle: 'S&P 글로벌 서비스업 PMI (확정)',
      category: '경기',
      importance: 'medium',
      description: '서비스업 경기 확산지수 최종치. 미국 경제의 약 70%를 차지하는 서비스 부문.',
      forecast: '55.2',
      previous: '54.8',
    },
    {
      id: 'ev_013',
      date: offsetDate(3),
      time: '23:00',
      title: 'ISM Services PMI',
      koreanTitle: 'ISM 서비스업 PMI',
      category: '경기',
      importance: 'high',
      description: '서비스업 경기지수로 가격·고용 하위 지표가 인플레이션 전망에 영향.',
      forecast: '51.0',
      previous: '48.8',
    },
    {
      id: 'ev_014',
      date: offsetDate(4),
      time: '21:30',
      title: 'Trade Balance',
      koreanTitle: '무역수지',
      category: '무역',
      importance: 'medium',
      description: '미국 월간 무역수지. 관세 정책 효과 가시화 여부와 GDP 성장 기여도 파악에 활용.',
      forecast: '-$77.0B',
      previous: '-$96.6B',
    },
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a list of economic events for the calendar view.
 * Events are sorted by date ascending.
 */
export function getEconomicEvents(): EconomicEvent[] {
  return buildEvents().sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Returns the date range covered by the calendar (first and last event dates).
 */
export function getEconomicCalendarRange(): { start: Date; end: Date } {
  const events = getEconomicEvents();
  if (events.length === 0) {
    const now = new Date();
    return { start: now, end: now };
  }
  const start = new Date(events[0].date + 'T00:00:00');
  const end = new Date(events[events.length - 1].date + 'T00:00:00');
  return { start, end };
}

/**
 * Formats a YYYY-MM-DD date key into display strings.
 */
export function formatEventDateKey(dateKey: string): {
  monthDay: string;
  dayOfWeek: string;
  isToday: boolean;
} {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const d = new Date(dateKey + 'T00:00:00');
  const todayStr = new Date().toISOString().slice(0, 10);

  return {
    monthDay: `${d.getMonth() + 1}/${d.getDate()}`,
    dayOfWeek: `(${dayNames[d.getDay()]})`,
    isToday: dateKey === todayStr,
  };
}

/**
 * Reads the persisted event-alerts preference from AsyncStorage.
 */
export async function isEventAlertsEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ALERTS_STORAGE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists the event-alerts preference to AsyncStorage.
 */
export async function setEventAlertsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ALERTS_STORAGE_KEY, String(enabled));
  } catch {
    // Best-effort; ignore storage errors
  }
}
