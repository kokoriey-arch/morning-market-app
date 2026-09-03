import { Theme } from '../theme/theme';

export const formatNumber = (val: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
};

export const formatPercent = (val: number, includeSign: boolean = true): string => {
  const sign = val > 0 && includeSign ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
};

export const formatChange = (val: number, includeSign: boolean = true): string => {
  const sign = val > 0 && includeSign ? '+' : '';
  return `${sign}${formatNumber(val)}`;
};

export const getPriceColor = (change: number) => {
  if (change > 0) return Theme.colors.bullish;
  if (change < 0) return Theme.colors.bearish;
  return Theme.colors.neutral;
};

export const getPriceGlowColor = (change: number) => {
  if (change > 0) return Theme.colors.bullishGlow;
  if (change < 0) return Theme.colors.bearishGlow;
  return Theme.colors.neutralGlow;
};

export const getRemainingTimeUntilOpen = (): {
  hours: number;
  minutes: number;
  seconds: number;
  isRegularOpen: boolean;
  statusText: string;
} => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();

  // Regular market hours: 09:00 ~ 15:30 KST (Weekdays)
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  // Target: 09:00:00 today or next weekday
  const target = new Date(now);
  target.setHours(9, 0, 0, 0);

  if (now.getTime() > target.getTime() && currentHour < 15 || (currentHour === 15 && currentMinute <= 30)) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      isRegularOpen: !isWeekend,
      statusText: isWeekend ? '주말 휴장 (익일 개장 준비)' : '국내 정규장 진행 중 (09:00 ~ 15:30)',
    };
  }

  let diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) {
    // If past 15:30, target 09:00 next day
    diffMs += 24 * 60 * 60 * 1000;
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return {
    hours,
    minutes,
    seconds,
    isRegularOpen: false,
    statusText: isWeekend
      ? '주말 휴장 · 월요일 09:00 개장'
      : `국내 정규장 개장(09:00)까지 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  };
};

export const getCurrentMorningDateString = (): { dateString: string; dayString: string; timeString: string } => {
  const now = new Date();
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const day = days[now.getDay()];

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return {
    dateString: `${month}월 ${date}일`,
    dayString: day,
    timeString: `${hours}:${minutes}`,
  };
};

export const getUsMarketTag = (): string => {
  const now = new Date();
  const day = now.getDay();
  const kstHour = now.getHours();
  const kstMin = now.getMinutes();

  const isTrading =
    (day >= 1 && day <= 5 && (kstHour > 22 || (kstHour === 22 && kstMin >= 30))) ||
    (day >= 2 && day <= 6 && (kstHour < 5 || (kstHour === 5 && kstMin === 0)));

  if (isTrading) return '美 정규장 실시간 진행';

  const usDate = new Date(now);
  if (day === 0) usDate.setDate(now.getDate() - 2);
  else if (day === 6) usDate.setDate(now.getDate() - 1);
  else if (day === 1 && kstHour < 22) usDate.setDate(now.getDate() - 3);
  else usDate.setDate(now.getDate() - 1);

  return `美 증시 마감 (${usDate.getMonth() + 1}/${usDate.getDate()})`;
};
