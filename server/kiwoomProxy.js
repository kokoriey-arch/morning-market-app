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

const PORT = Number(process.env.MARKET_PROXY_PORT || 8787);
const HOST = process.env.MARKET_PROXY_HOST || '127.0.0.1';
const CLIENT_TOKEN = process.env.MARKET_PROXY_TOKEN || '';
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
let tokenCache;

function json(response, status, body) {
  const origin = response._requestOrigin;
  response.writeHead(status, {
    'content-type': 'application/json',
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    'access-control-allow-headers': 'content-type, x-client-token',
    'access-control-allow-methods': 'POST, OPTIONS',
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

function isRateLimited(request) {
  const address = request.socket.remoteAddress || 'unknown';
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

async function twelveDataRequest(operation, input) {
  if (!process.env.TWELVE_DATA_API_KEY) throw new Error('Twelve Data credentials are not configured');
  let url;
  if (operation === 'prices') {
    const symbols = (Array.isArray(input.itemIds) ? input.itemIds : [])
      .map((itemId) => TWELVE_DATA_SYMBOLS.get(itemId)).filter(Boolean);
    if (symbols.length === 0 || symbols.length > 25) throw new Error('Invalid symbols');
    url = `${TWELVE_DATA_BASE_URL}/price?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${encodeURIComponent(process.env.TWELVE_DATA_API_KEY)}`;
  } else if (operation === 'history') {
    const symbol = TWELVE_DATA_SYMBOLS.get(input.itemId);
    if (!symbol) throw new Error('Invalid symbol');
    url = `${TWELVE_DATA_BASE_URL}/time_series?symbol=${encodeURIComponent(symbol)}&interval=30min&outputsize=14&apikey=${encodeURIComponent(process.env.TWELVE_DATA_API_KEY)}`;
  } else {
    throw new Error('Unsupported operation');
  }
  const upstream = await fetch(url);
  return { status: upstream.status, data: await upstream.json() };
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

http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  response._requestOrigin = isAllowedOrigin(origin) ? origin : undefined;
  if (origin && !isAllowedOrigin(origin)) return json(response, 403, { error: 'Origin not allowed' });
  if (request.method === 'OPTIONS') return json(response, 204, {});
  if (request.method !== 'POST' || !['/api/kiwoom', '/api/twelve-data'].includes(request.url)) return json(response, 404, { error: 'Not found' });
  if (!isAuthorized(request)) return json(response, 401, { error: 'Unauthorized' });
  if (isRateLimited(request)) return json(response, 429, { error: 'Rate limit exceeded' });
  try {
    const input = await readBody(request);
    if (request.url === '/api/twelve-data') {
      const result = await twelveDataRequest(input.operation, input);
      return json(response, result.status, result.data);
    }
    const endpoint = ALLOWED_APIS.get(input.apiId);
    if (!endpoint || endpoint !== input.endpoint) return json(response, 400, { error: 'Unsupported API' });
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
    json(response, upstream.status, await upstream.json());
  } catch {
    json(response, 502, { error: 'Market service unavailable' });
  }
}).listen(PORT, HOST, () => {
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !CLIENT_TOKEN) {
    console.error('MARKET_PROXY_TOKEN is required when the proxy is not local');
    process.exit(1);
  }
  console.log(`Market proxy listening on http://${HOST}:${PORT}`);
});
