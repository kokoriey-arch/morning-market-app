const fs = require('fs');
const http = require('http');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

loadEnv();

// Cloud platforms (Render/Railway/Fly/Heroku) inject PORT and require binding
// to all interfaces. Without PORT, local development keeps the safe default of
// binding to the loopback interface only.
const PORT = Number(process.env.PORT || process.env.MARKET_PROXY_PORT || 8787);
const HOST = process.env.MARKET_PROXY_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const CLIENT_TOKEN = process.env.MARKET_PROXY_TOKEN || '';
// Set MARKET_TRUST_PROXY=1 when TLS terminates on a reverse proxy (Nginx/Caddy)
// that forwards X-Forwarded-For, so per-client rate limiting stays accurate.
const TRUST_PROXY = process.env.MARKET_TRUST_PROXY === '1';
const ALLOWED_ORIGINS = new Set((process.env.MARKET_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.MARKET_RATE_LIMIT || 60);
const requestCounts = new Map();
const KIWOOM_BASE_URL = process.env.KIWOOM_MODE === 'demo'
  ? 'https://mockapi.kiwoom.com'
  : 'https://api.kiwoom.com';
const ALLOWED_APIS = new Map([
  ['ka10001', '/api/dostk/stkinfo'],
  ['ka10007', '/api/dostk/mrkcond'],
  ['ka10045', '/api/dostk/mrkcond'],
  ['ka90004', '/api/dostk/stkinfo'],
  ['ka20001', '/api/dostk/sect'],
]);
const TWELVE_DATA_SYMBOLS = new Map([
  ['nasdaq_comp', 'IXIC'], ['sp500', 'SPX'], ['dow_jones', 'DJI'],
  ['phil_semiconductor', 'SOX'], ['tech_nvda', 'NVDA'], ['tech_tsla', 'TSLA'],
  ['tech_aapl', 'AAPL'], ['tech_tsm', 'TSM'], ['tech_msft', 'MSFT'],
  ['tech_skhy', 'SKHY'], ['tech_mu', 'MU'], ['tech_sndk', 'SNDK'],
  ['fx_usdkrw', 'USD/KRW'], ['macro_vix', 'VIX'], ['macro_wti', 'WTI/USD'],
  ['crypto_bitcoin', 'BTC/USD'], ['crypto_ethereum', 'ETH/USD'], ['crypto_solana', 'SOL/USD'],
  ['crypto_xrp', 'XRP/USD'],
]);
const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';
// Yahoo Finance fallback (free, no API key, server-side only so CORS is not an
// issue). Uses v8 chart API which is the current working endpoint.
// v7 quote API returns 401 Unauthorized, but v8 chart works without authentication. Used when Twelve Data is throttled (429) or cannot serve a symbol -
// otherwise the app silently keeps showing stale hardcoded fallback prices.
const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_TTL_MS = Number(process.env.MARKET_YAHOO_TTL_MS || 60_000);
const YAHOO_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'accept': 'application/json',
};
const YAHOO_SYMBOLS = new Map([
  ['kospi_composite', '^KS11'],
  ['nasdaq_comp', '^IXIC'], ['sp500', '^GSPC'], ['dow_jones', '^DJI'],
  ['phil_semiconductor', '^SOX'], ['tech_nvda', 'NVDA'], ['tech_tsla', 'TSLA'],
  ['tech_aapl', 'AAPL'], ['tech_tsm', 'TSM'], ['tech_msft', 'MSFT'],
  ['tech_skhy', 'SKHY'], ['tech_mu', 'MU'], ['tech_sndk', 'SNDK'],
  ['fx_usdkrw', 'USDKRW=X'], ['macro_vix', '^VIX'], ['macro_wti', 'CL=F'],
  ['crypto_bitcoin', 'BTC-USD'], ['crypto_ethereum', 'ETH-USD'],
  ['crypto_solana', 'SOL-USD'], ['crypto_xrp', 'XRP-USD'],
]);

// CoinGecko API for crypto prices (free, no API key required)
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_TTL_MS = Number(process.env.MARKET_COINGECKO_TTL_MS || 60_000);
const COINGECKO_SYMBOLS = new Map([
  ['crypto_bitcoin', 'bitcoin'],
  ['crypto_ethereum', 'ethereum'],
  ['crypto_solana', 'solana'],
  ['crypto_xrp', 'ripple'],
]);

// Korea Exchange (KRX) API for KOSPI data (free, public data)
const KRX_BASE_URL = 'https://data.krx.co.kr/comm/bldAttend.cmd';
const KRX_TTL_MS = Number(process.env.MARKET_KRX_TTL_MS || 300_000);

// Exchange rate API (free, no API key)
const EXCHANGE_RATE_BASE_URL = 'https://open.er-api.com/v6/latest/USD';
const EXCHANGE_RATE_TTL_MS = Number(process.env.MARKET_EXCHANGE_RATE_TTL_MS || 300_000);

// Naver Finance API for KOSPI (free, reliable for Korean market)
const NAVER_KOSPI_URL = 'https://api.finance.naver.com/siseJson.naver?symbol=KOSPI&requestType=1&startTime=20240101&endTime=20241231&timeframe=day';
const NAVER_KOSPI_TTL_MS = Number(process.env.MARKET_NAVER_TTL_MS || 300_000);

// Alternative: Korea Investment & Securities API for KOSPI
const KOSPI_FALLBACK_URL = 'https://quotation-api-cdn.dunamu.com/v1/quote-domains/KR?codes=KR7000000001';
// Twelve Data free plan allows 8 credits per minute; a batch larger than that
// can never succeed and just burns the request, so route it straight to Yahoo.
// Also, many indices (IXIC, SPX, DJI, SOX) are NOT supported on the free plan,
// so we limit Twelve Data to individual stocks only.
const TWELVE_DATA_MAX_BATCH = 8;
const TWELVE_DATA_SUPPORTED_TYPES = new Set(['stock']); // Only stocks work on free plan

// Symbol type mapping for routing to correct API
function getSymbolType(itemId) {
  const typeMap = {
    nasdaq_comp: 'index', sp500: 'index', dow_jones: 'index',
    phil_semiconductor: 'index', macro_vix: 'index',
    tech_nvda: 'stock', tech_tsla: 'stock', tech_aapl: 'stock',
    tech_tsm: 'stock', tech_msft: 'stock', tech_skhy: 'stock',
    tech_mu: 'stock', tech_sndk: 'stock',
    fx_usdkrw: 'forex', macro_wti: 'commodity',
    crypto_bitcoin: 'crypto', crypto_ethereum: 'crypto',
    crypto_solana: 'crypto', crypto_xrp: 'crypto',
    kospi_composite: 'index',
  };
  return typeMap[itemId] || 'unknown';
}
// CNN Fear & Greed index (published, free). Server-side fetch avoids CORS and
// keeps the app's sentiment gauge aligned with the widely-cited source instead
// of a VIX-only approximation.
const CNN_FNG_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
const SENTIMENT_TTL_MS = Number(process.env.MARKET_SENTIMENT_TTL_MS || 600_000);
const CNN_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
};
const FNG_RATING_LABELS = {
  'extreme fear': 'Extreme Fear (극단적 공포)',
  'fear': 'Fear (공포 - 매도 우세)',
  'neutral': 'Neutral (중립)',
  'greed': 'Greed (탐욕 - 매수 우세)',
  'extreme greed': 'Extreme Greed (극단적 탐욕)',
};

// Alternative Fear & Greed API (Alternative.me) - more reliable
const ALTERNATIVE_FNG_URL = 'https://api.alternative.me/fng/?limit=2';
const ALTERNATIVE_FNG_TTL_MS = Number(process.env.MARKET_SENTIMENT_TTL_MS || 600_000);
let tokenCache;

// ---------------------------------------------------------------------------
// Response cache & daily credit budget
// ---------------------------------------------------------------------------
// Twelve Data free plan allows 800 credits/day and a batched /price call
// costs 1 credit per symbol (19 symbols = 19 credits per refresh), so the
// app's 60s auto-refresh burns through the whole day in ~40 minutes.
// Short-lived caches plus a hard daily budget keep usage inside the plan.
const PRICE_TTL_MS = Number(process.env.MARKET_PRICE_TTL_MS || 180_000);     // 3 min
const HISTORY_TTL_MS = Number(process.env.MARKET_HISTORY_TTL_MS || 600_000); // 10 min
const KIWOOM_TTL_MS = Number(process.env.MARKET_KIWOOM_TTL_MS || 60_000);    // 1 min
const ERROR_TTL_MS = 120_000; // throttle/error responses cached briefly to absorb retry storms
const DAILY_CREDIT_LIMIT = Number(process.env.MARKET_DAILY_CREDIT_LIMIT || 700); // buffer under the 800/day plan
const responseCache = new Map();    // cache key -> { status, body, expiresAt }
const inflightRequests = new Map(); // cache key -> Promise<{ status, body }>
let creditUsage = { date: '', used: 0 };

function resetCreditUsageIfNewDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (creditUsage.date !== today) creditUsage = { date: today, used: 0 };
}

function creditsRemaining() {
  resetCreditUsageIfNewDay();
  return DAILY_CREDIT_LIMIT - creditUsage.used;
}

function chargeCredits(cost) {
  resetCreditUsageIfNewDay();
  creditUsage.used += cost;
}

function creditUsageSnapshot() {
  resetCreditUsageIfNewDay();
  return {
    used: creditUsage.used,
    remaining: Math.max(0, DAILY_CREDIT_LIMIT - creditUsage.used),
    limit: DAILY_CREDIT_LIMIT,
  };
}

async function fetchCached(key, ttlMs, creditCost, fetcher) {
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { status: cached.status, body: cached.body, cache: 'HIT' };

  const inflight = inflightRequests.get(key);
  if (inflight) {
    const result = await inflight;
    return { ...result, cache: 'DEDUP' };
  }

  const promise = (async () => {
    if (creditCost > creditsRemaining()) {
      // Daily budget exhausted: serve last known good data so the app keeps
      // working, otherwise report the throttled state so the client falls
      // back instead of burning the remaining credits with retries.
      const stale = responseCache.get(key);
      if (stale) {
        stale.expiresAt = Date.now() + ttlMs;
        return { status: stale.status, body: stale.body, stale: true };
      }
      return {
        status: 429,
        body: { code: 429, message: `Daily market data credit budget (${DAILY_CREDIT_LIMIT}) exhausted`, status: 'error' },
      };
    }
    const result = await fetcher();
    if (result.status === 429 || result.status >= 500) {
      // Upstream throttled or down: keep serving last known good data and
      // never overwrite a good entry with the error payload.
      const stale = responseCache.get(key);
      if (stale) {
        stale.expiresAt = Date.now() + ttlMs;
        return { status: stale.status, body: stale.body, stale: true };
      }
      responseCache.set(key, { status: result.status, body: result.body, expiresAt: Date.now() + ERROR_TTL_MS });
      return result;
    }
    chargeCredits(creditCost);
    responseCache.set(key, { status: result.status, body: result.body, expiresAt: Date.now() + ttlMs });
    return result;
  })();

  inflightRequests.set(key, promise);
  try {
    const result = await promise;
    return { ...result, cache: result.stale ? 'STALE' : 'MISS' };
  } finally {
    inflightRequests.delete(key);
  }
}

// Periodically drop cache entries older than 12h to bound memory usage.
setInterval(() => {
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt < cutoff) responseCache.delete(key);
  }
}, 10 * 60 * 1000).unref();

function json(response, status, body, extraHeaders) {
  const origin = response._requestOrigin;
  response.writeHead(status, {
    'content-type': 'application/json',
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    'access-control-allow-headers': 'content-type, x-client-token',
    'access-control-allow-methods': 'POST, OPTIONS',
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.size === 0 || ALLOWED_ORIGINS.has(origin);
}

function isAuthorized(request) {
  if (!CLIENT_TOKEN) return HOST === '127.0.0.1' || HOST === 'localhost';
  const authorization = request.headers.authorization || '';
  return authorization === `Bearer ${CLIENT_TOKEN}`;
}

function clientAddress(request) {
  if (TRUST_PROXY) {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim() || 'unknown';
    }
  }
  return request.socket.remoteAddress || 'unknown';
}

function isRateLimited(request) {
  const address = clientAddress(request);
  const now = Date.now();
  const current = requestCounts.get(address);
  if (!current || current.expiresAt <= now) {
    requestCounts.set(address, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) request.destroy(new Error('Request body too large'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); }
    });
    request.on('error', reject);
  });
}

async function fetchTwelveDataPricesUpstream(symbols) {
  const url = `${TWELVE_DATA_BASE_URL}/price?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${encodeURIComponent(process.env.TWELVE_DATA_API_KEY)}`;
  const upstream = await fetch(url);
  return { status: upstream.status, body: await upstream.json() };
}

async function fetchTwelveDataHistoryUpstream(symbol) {
  const url = `${TWELVE_DATA_BASE_URL}/time_series?symbol=${encodeURIComponent(symbol)}&interval=30min&outputsize=14&apikey=${encodeURIComponent(process.env.TWELVE_DATA_API_KEY)}`;
  const upstream = await fetch(url);
  return { status: upstream.status, body: await upstream.json() };
}

// Stock Market Fear & Greed (CNN) - for stock market sentiment
async function fetchStockFearGreedUpstream() {
  try {
    const upstream = await fetch(CNN_FNG_URL, { headers: CNN_HEADERS });
    if (!upstream.ok) return { status: upstream.status, body: { error: 'Stock sentiment source unavailable' } };
    const data = await upstream.json();
    const fng = data && data.fear_and_greed;
    const score = fng ? Math.round(Number(fng.score)) : NaN;
    if (!isFinite(score)) return { status: 502, body: { error: 'Stock sentiment payload malformed' } };
    const ratingKey = String(fng.rating || '').trim().toLowerCase();
    const previousClose = Number(fng.previous_close);
    return {
      status: 200,
      body: {
        score,
        rating: FNG_RATING_LABELS[ratingKey] || fng.rating || 'Neutral (중립)',
        ...(isFinite(previousClose) && previousClose > 0 ? { previousClose: Math.round(previousClose) } : {}),
      },
    };
  } catch (e) {
    console.log('[Stock FearGreed] CNN failed:', e.message);
    return { status: 502, body: { error: 'Stock sentiment source unavailable' } };
  }
}

// Crypto Market Fear & Greed (Alternative.me) - for crypto market sentiment
async function fetchCryptoFearGreedUpstream() {
  try {
    const upstream = await fetch(ALTERNATIVE_FNG_URL, { headers: { 'accept': 'application/json' } });
    if (upstream.ok) {
      const data = await upstream.json();
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        const current = data.data[0];
        const score = Math.round(Number(current.value));
        if (isFinite(score)) {
          const ratingKey = String(current.value_classification || '').trim().toLowerCase();
          const previousClose = data.data.length > 1 ? Math.round(Number(data.data[1].value)) : undefined;
          return {
            status: 200,
            body: {
              score,
              rating: FNG_RATING_LABELS[ratingKey] || current.value_classification || 'Neutral (중립)',
              ...(isFinite(previousClose) && previousClose > 0 ? { previousClose } : {}),
            },
          };
        }
      }
    }
  } catch (e) {
    console.log('[Crypto FearGreed] Alternative.me failed:', e.message);
  }
  return { status: 502, body: { error: 'Crypto sentiment source unavailable' } };
}

// Legacy combined endpoint (kept for backward compatibility)
async function fetchFearGreedUpstream() {
  // Default to crypto (Alternative.me) for backward compatibility
  return fetchCryptoFearGreedUpstream();
}

// Fetch KOSPI index from Kiwoom API (FHPUP02100000 - ka20001)
async function fetchKospiFromKiwoom() {
  try {
    const token = await getToken();
    const upstream = await fetch(`${KIWOOM_BASE_URL}/api/dostk/sect`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        'authorization': `Bearer ${token}`,
        'appkey': process.env.KIWOOM_APP_KEY,
        'api-id': 'ka20001',
      },
      body: JSON.stringify({ mrkt_tp: '0', inds_cd: '001' }),
    });
    if (!upstream.ok) return null;
    const data = await upstream.json();
    if (!data || data.return_code !== 0) return null;
    const price = Math.abs(Number(data.cur_prc)) || 0;
    if (price <= 0) return null;
    return {
      price,
      previousClose: Math.abs(Number(data.pred_pre)) || undefined,
      open: Math.abs(Number(data.open_pric)) || undefined,
      high: Math.abs(Number(data.high_pric)) || undefined,
      low: Math.abs(Number(data.low_pric)) || undefined,
    };
  } catch (e) {
    console.log('[KOSPI Kiwoom] Error:', e.message);
    return null;
  }
}

async function fetchYahooQuoteUpstream(yahooSymbol) {
  // Yahoo Finance v8 chart API endpoint (v7 quote returns 401 Unauthorized)
  const url = `${YAHOO_BASE_URL}/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1d`;
  const upstream = await fetch(url, { headers: YAHOO_HEADERS });
  if (!upstream.ok) return { status: upstream.status, body: null };
  const data = await upstream.json();
  const result = data && data.chart && Array.isArray(data.chart.result) ? data.chart.result[0] : null;
  const meta = result ? result.meta : null;
  if (!meta) return { status: 404, body: null };
  const price = Number(meta.regularMarketPrice);
  if (!isFinite(price) || price <= 0) return { status: 404, body: null };
  const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose);
  const open = Number(meta.regularMarketDayHigh ?? meta.regularMarketOpen);
  const high = Number(meta.regularMarketDayHigh);
  const low = Number(meta.regularMarketDayLow);
  return {
    status: 200,
    body: {
      price: String(price),
      ...(isFinite(previousClose) && previousClose > 0 ? { previousClose: String(previousClose) } : {}),
      ...(isFinite(open) && open > 0 ? { open: String(open) } : {}),
      ...(isFinite(high) && high > 0 ? { high: String(high) } : {}),
      ...(isFinite(low) && low > 0 ? { low: String(low) } : {}),
    },
  };
}

// Fetch crypto prices from CoinGecko (free, no API key)
async function fetchCryptoPricesFromCoinGecko() {
  const ids = Array.from(COINGECKO_SYMBOLS.values()).join(',');
  const url = `${COINGECKO_BASE_URL}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const upstream = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!upstream.ok) return null;
  const data = await upstream.json();
  if (!data || typeof data !== 'object') return null;

  const result = {};
  for (const [itemId, coinId] of COINGECKO_SYMBOLS.entries()) {
    const coinData = data[coinId];
    if (coinData && coinData.usd) {
      result[itemId] = {
        price: String(coinData.usd),
        ...(coinData.usd_24h_change !== undefined ? { changePercent: String(coinData.usd_24h_change) } : {}),
      };
    }
  }
  return result;
}

// Fetch USD/KRW from Yahoo Finance (via yahooIds)
async function fetchUsdKrwRate() {
  const url = EXCHANGE_RATE_BASE_URL;
  const upstream = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!upstream.ok) return null;
  const data = await upstream.json();
  if (data && data.result === 'success' && data.rates && data.rates.KRW) {
    return data.rates.KRW;
  }
  return null;
}

// Fetch KOSPI index from Naver Finance
async function fetchKospiFromNaver() {
  const url = 'https://api.finance.naver.com/siseJson.naver?symbol=KOSPI&requestType=1&startTime=20260101&endTime=20261231&timeframe=day';
  const upstream = await fetch(url, { headers: { 'user-agent': YAHOO_HEADERS['user-agent'] } });
  if (!upstream.ok) return null;
  const text = await upstream.text();
  // Naver returns JSON-like array format, need to parse carefully
  try {
    // Remove any BOM and parse
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    const data = JSON.parse(cleanText);
    if (Array.isArray(data) && data.length > 0) {
      // Last element is the most recent: [date, open, high, low, close, volume, foreign]
      const latest = data[data.length - 1];
      if (Array.isArray(latest) && latest.length >= 5) {
        const close = Number(latest[4]);
        const open = Number(latest[1]);
        if (isFinite(close) && close > 0) {
          return {
            price: close,
            open: isFinite(open) ? open : close,
            previousClose: data.length > 1 ? Number(data[data.length - 2][4]) : undefined,
          };
        }
      }
    }
  } catch (e) {
    console.log('[NaverKOSPI] Parse error:', e.message);
  }
  return null;
}

// Fetch KOSPI index from Dunamu API (alternative)
async function fetchKospiFromDunamu() {
  const url = 'https://quotation-api-cdn.dunamu.com/v1/quote-domains/KR?codes=KR7000000001';
  const upstream = await fetch(url, { headers: { 'accept': 'application/json', 'user-agent': YAHOO_HEADERS['user-agent'] } });
  if (!upstream.ok) return null;
  const data = await upstream.json();
  if (Array.isArray(data) && data.length > 0) {
    const quote = data[0];
    const price = Number(quote?.tradePrice ?? quote?.price ?? quote?.closePrice);
    if (isFinite(price) && price > 0) {
      const previousClose = Number(quote?.prevClosePrice ?? quote?.previousClose);
      return {
        price,
        previousClose: isFinite(previousClose) ? previousClose : undefined,
      };
    }
  }
  return null;
}

// Combined KOSPI fetcher with fallback
async function fetchKospiIndex() {
  // Try Naver first
  const naverResult = await fetchCached('kospi:naver', NAVER_KOSPI_TTL_MS, 0, fetchKospiFromNaver);
  if (naverResult.status === 200 && naverResult.body) {
    return naverResult.body;
  }
  // Fallback to Dunamu
  const dunamuResult = await fetchCached('kospi:dunamu', NAVER_KOSPI_TTL_MS, 0, fetchKospiFromDunamu);
  if (dunamuResult.status === 200 && dunamuResult.body) {
    return dunamuResult.body;
  }
  return null;
}

// Fetch Yahoo quotes for a list of { key, yahooSymbol } pairs and merge them
// into a Twelve Data-shaped map keyed by the Twelve Data symbol name.
async function fetchYahooQuotes(pairs) {
  const entries = await Promise.all(pairs.map(async ({ key, yahooSymbol }) => {
    if (!yahooSymbol) return { key, body: null };
    try {
      const result = await fetchCached(`yahoo:${yahooSymbol}`, YAHOO_TTL_MS, 0, () => fetchYahooQuoteUpstream(yahooSymbol));
      if (result.status === 200 && result.body && result.body.price) return { key, body: result.body };
    } catch { /* ignore individual symbol failures */ }
    return { key, body: null };
  }));
  const merged = {};
  for (const { key, body } of entries) {
    if (body) merged[key] = body;
  }
  return merged;
}

async function getToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 600000) return tokenCache.value;
  if (!process.env.KIWOOM_APP_KEY || !process.env.KIWOOM_SECRET_KEY) {
    throw new Error('Kiwoom credentials are not configured');
  }
  const response = await fetch(`${KIWOOM_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: process.env.KIWOOM_APP_KEY,
      secretkey: process.env.KIWOOM_SECRET_KEY,
    }),
  });
  const data = await response.json();
  if (!response.ok || data.return_code !== 0 || !data.token) throw new Error('Kiwoom authentication failed');
  tokenCache = { value: data.token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
  return tokenCache.value;
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  response._requestOrigin = isAllowedOrigin(origin) ? origin : undefined;
  // Unauthenticated health probe for load balancers, orchestrators and uptime
  // monitors. Exposes nothing sensitive.
  if (request.method === 'GET' && request.url === '/healthz') {
    return json(response, 200, { status: 'ok', uptimeSeconds: Math.round(process.uptime()), creditBudget: creditUsageSnapshot() });
  }
  if (origin && !isAllowedOrigin(origin)) return json(response, 403, { error: 'Origin not allowed' });
  if (request.method === 'OPTIONS') return json(response, 204, {});
  if (request.method !== 'POST' || !['/api/kiwoom', '/api/twelve-data', '/api/sentiment'].includes(request.url)) return json(response, 404, { error: 'Not found' });
  if (!isAuthorized(request)) return json(response, 401, { error: 'Unauthorized' });
  if (isRateLimited(request)) return json(response, 429, { error: 'Rate limit exceeded' });
  try {
    const input = await readBody(request);
    if (request.url === '/api/twelve-data') {
      if (input.operation === 'prices') {
        const requested = (Array.isArray(input.itemIds) ? input.itemIds : [])
          .map((itemId) => ({ itemId, symbol: TWELVE_DATA_SYMBOLS.get(itemId) }));
        if (requested.length === 0 || requested.length > 25) return json(response, 400, { error: 'Invalid symbols' });

        let status = 200;
        let body = {};
        let cacheLabel = 'MISS';

        // Separate items by preferred data source
        const cryptoIds = requested.filter(({ itemId }) => COINGECKO_SYMBOLS.has(itemId));
        const kospiIds = requested.filter(({ itemId }) => itemId === 'kospi_composite');
        const yahooIds = requested;
        // ↑ Yahoo Finance is the universal fallback. CoinGecko and Kiwoom are
        //   layered on top below, overwriting the Yahoo entry only when they
        //   actually return a value, and always keyed by the Twelve Data symbol
        //   (BTC/USD, ^KS11…) so the mobile client can read it.

        let yahooUsed = false;

        // Fetch all non-crypto/non-forex/non-kospi items from Yahoo Finance
        if (yahooIds.length > 0) {
          const yahooQuotes = await fetchYahooQuotes(yahooIds.map(({ itemId, symbol }) => {
            const yahooSymbol = YAHOO_SYMBOLS.get(itemId);
            return { key: symbol || yahooSymbol, yahooSymbol };
          }));
          if (Object.keys(yahooQuotes).length > 0) {
            yahooUsed = true;
            body = { ...body, ...yahooQuotes };
            if (status !== 200) status = 200;
          }
        }

        // Fetch crypto prices from CoinGecko (best source when reachable).
        // Keyed by the Twelve Data symbol (e.g. BTC/USD) so the client maps it.
        if (cryptoIds.length > 0) {
          try {
            const cryptoPrices = await fetchCached('coingecko:prices', COINGECKO_TTL_MS, 0, fetchCryptoPricesFromCoinGecko);
            if (cryptoPrices) {
              for (const { itemId } of cryptoIds) {
                const cryptoData = cryptoPrices[itemId];
                if (cryptoData) {
                  body[TWELVE_DATA_SYMBOLS.get(itemId) || itemId] = cryptoData;
                }
              }
              yahooUsed = true;
            }
          } catch (e) {
            console.log('[CoinGecko] Failed:', e.message);
          }
        }

        // Fetch KOSPI index from Kiwoom (best source when reachable).
        // Keyed by the Twelve Data symbol (^KS11) so the client maps it.
        if (kospiIds.length > 0) {
          try {
            const kospiData = await fetchCached('kospi:kiwoom', KIWOOM_TTL_MS, 0, fetchKospiFromKiwoom);
            if (kospiData && kospiData.price) {
              body[TWELVE_DATA_SYMBOLS.get('kospi_composite') || 'kospi_composite'] = {
                price: String(kospiData.price),
                ...(kospiData.previousClose ? { previousClose: String(kospiData.previousClose) } : {}),
                ...(kospiData.open ? { open: String(kospiData.open) } : {}),
                ...(kospiData.high ? { high: String(kospiData.high) } : {}),
                ...(kospiData.low ? { low: String(kospiData.low) } : {}),
              };
              yahooUsed = true;
            }
          } catch (e) {
            console.log('[KOSPI Kiwoom] Failed:', e.message);
          }
        }

        // Single-symbol requests keep the flat response shape the client expects.
        if (requested.length === 1) {
          const key = requested[0].symbol || YAHOO_SYMBOLS.get(requested[0].itemId);
          const entry = (key && body[key]) || Object.values(body)[0];
          if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            body = { ...entry };
          }
        }

        const finalCache = yahooUsed
          ? (cacheLabel === 'HIT' || cacheLabel === 'DEDUP' ? `${cacheLabel}+YAHOO` : 'YAHOO')
          : cacheLabel;
        return json(response, status, body, { 'x-cache': finalCache });
      }
      if (input.operation === 'history') {
        const symbol = TWELVE_DATA_SYMBOLS.get(input.itemId);
        if (!symbol) return json(response, 400, { error: 'Invalid symbol' });
        const result = await fetchCached(
          `td-history:${input.itemId}`,
          HISTORY_TTL_MS,
          1, // /time_series costs 1 credit per call
          () => fetchTwelveDataHistoryUpstream(symbol),
        );
        return json(response, result.status, result.body, { 'x-cache': result.cache });
      }
      return json(response, 400, { error: 'Unsupported operation' });
    }
    if (request.url === '/api/sentiment') {
      // Fetch both stock (CNN) and crypto (Alternative.me) Fear & Greed indices
      const [stockResult, cryptoResult] = await Promise.all([
        fetchCached('stock-fng', SENTIMENT_TTL_MS, 0, fetchStockFearGreedUpstream),
        fetchCached('crypto-fng', SENTIMENT_TTL_MS, 0, fetchCryptoFearGreedUpstream),
      ]);
      return json(response, 200, {
        stock: stockResult.body,
        crypto: cryptoResult.body,
      }, { 'x-cache': stockResult.cache });
    }
    const endpoint = ALLOWED_APIS.get(input.apiId);
    if (!endpoint || endpoint !== input.endpoint) return json(response, 400, { error: 'Unsupported API' });
    const result = await fetchCached(
      `kiwoom:${input.apiId}:${JSON.stringify(input.body || {})}`,
      KIWOOM_TTL_MS,
      0, // Kiwoom is not on the Twelve Data credit plan
      async () => {
        const upstream = await fetch(`${KIWOOM_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${await getToken()}`,
            appkey: process.env.KIWOOM_APP_KEY,
            'api-id': input.apiId,
            'content-type': 'application/json;charset=UTF-8',
          },
          body: JSON.stringify(input.body || {}),
        });
        return { status: upstream.status, body: await upstream.json() };
      },
    );
    return json(response, result.status, result.body, { 'x-cache': result.cache });
  } catch (error) {
    console.error('[kiwoomProxy] request failed:', error && (error.stack || error.message || error));
    json(response, 502, { error: 'Market service unavailable' });
  }
});

server.listen(PORT, HOST, () => {
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !CLIENT_TOKEN) {
    console.error('MARKET_PROXY_TOKEN is required when the proxy is not local');
    process.exit(1);
  }
  console.log(`Market proxy listening on http://${HOST}:${PORT}`);
});

function shutdown(signal) {
  console.log(`[kiwoomProxy] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
  // Force-exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
