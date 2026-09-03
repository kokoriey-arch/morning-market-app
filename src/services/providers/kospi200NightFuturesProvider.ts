import { KOSPI200NightFuturesData } from '../../types/market';

export interface KOSPI200NightFuturesResult {
  data: KOSPI200NightFuturesData | null;
  status: KOSPI200NightFuturesData['status'];
}

/** No approved official delayed provider is configured yet. */
export async function getKOSPI200NightFutures(): Promise<KOSPI200NightFuturesResult> {
  return { data: null, status: 'unavailable' };
}