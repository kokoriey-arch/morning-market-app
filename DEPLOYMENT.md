# Deployment

## Architecture

The mobile app calls the backend at `EXPO_PUBLIC_MARKET_API_URL`. The backend calls Twelve Data and Kiwoom. Provider credentials must only exist in the backend environment.

## Local setup

1. Copy `.env.example` to `.env`.
2. Put newly issued credentials in `TWELVE_DATA_API_KEY`, `KIWOOM_APP_KEY`, and `KIWOOM_SECRET_KEY`.
3. Set `EXPO_PUBLIC_MARKET_API_URL` to the backend URL.
4. Run `npm run proxy` and `npm start`.

For an Android emulator, use `http://10.0.2.2:8787` locally. A physical device needs the computer's LAN address. Production must use an HTTPS URL.

## Cloud deployment

The proxy is a single zero-dependency Node 18+ script (`server/kiwoomProxy.js`), so it runs on any cloud host. It automatically supports:

- **`PORT` injection** — PaaS platforms (Render, Railway, Fly.io, Heroku) set `PORT`; the server then binds to `0.0.0.0` by default.
- **`GET /healthz`** — unauthenticated health probe returning status, uptime, and the remaining daily credit budget. Use it for load-balancer health checks and uptime monitors.
- **Graceful shutdown** — `SIGTERM`/`SIGINT` drain connections before exiting (required for zero-downtime container restarts).
- **`MARKET_TRUST_PROXY=1`** — enables per-client rate limiting based on `X-Forwarded-For` when running behind Nginx/Caddy.

### Option A — Docker on a VPS (recommended)

1. Copy the repository to the server (e.g. `/opt/morning-market-app`).
2. Create `.env` with the provider credentials, a long random `MARKET_PROXY_TOKEN`, and optional cache tuning.
3. `docker compose up -d --build` — the container publishes `127.0.0.1:8787` on the host only.
4. Terminate TLS with Caddy in front:

   ```
   # /etc/caddy/Caddyfile
   market.example.com {
       reverse_proxy 127.0.0.1:8787
   }
   ```
5. Set `MARKET_TRUST_PROXY=1` in `.env` so rate limiting sees real client IPs.

### Option B — systemd on a VPS (no Docker)

```ini
# /etc/systemd/system/market-proxy.service
[Unit]
Description=Market data proxy
After=network-online.target

[Service]
ExecStart=/usr/bin/node /opt/morning-market-app/server/kiwoomProxy.js
Environment=MARKET_PROXY_HOST=127.0.0.1
Environment=MARKET_TRUST_PROXY=1
EnvironmentFile=/opt/morning-market-app/.env
Restart=always
User=market
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Enable with `sudo systemctl enable --now market-proxy`, then put Caddy/Nginx in front for TLS as above.

### Option C — PaaS (Render / Railway / Fly.io)

1. Deploy the repository; set the start command to `node server/kiwoomProxy.js` (or rely on `server/package.json`).
2. Configure the environment variables in the dashboard: credentials, `MARKET_PROXY_TOKEN`, optional `MARKET_TRUST_PROXY=1` behind their proxy. `PORT` and `HOST` are handled automatically.
3. Point the platform health check at `/healthz`.

### Required environment variables in production

- `MARKET_PROXY_TOKEN` — mandatory: the server refuses to start on a non-local host without it. Use `openssl rand -hex 32`.
- `MARKET_ALLOWED_ORIGINS` — exact web origins that need access (leave empty if no browser client).
- `MARKET_PROXY_HOST=127.0.0.1` when TLS terminates on a same-host reverse proxy; otherwise a non-local host plus the token.

### Pointing the app at the cloud backend

1. Set `EXPO_PUBLIC_MARKET_API_URL=https://market.example.com` and `EXPO_PUBLIC_MARKET_API_TOKEN` to the same value as `MARKET_PROXY_TOKEN` — the app attaches it as `Authorization: Bearer <token>` on every proxy request (`kisClient.ts`, `twelveDataProvider.ts`).
2. **`EXPO_PUBLIC_*` values are inlined at build time**, so run a new `eas build` after changing them. Because the token ships inside the app bundle, replace it with real per-user authentication before a public launch.

## Production requirements

- Deploy `server/kiwoomProxy.js` behind HTTPS and a reverse proxy.
- Set `MARKET_PROXY_HOST=127.0.0.1` when TLS is terminated by the reverse proxy, or set a non-local host together with a long random `MARKET_PROXY_TOKEN`.
- Do not put `MARKET_PROXY_TOKEN` or any provider credential in an `EXPO_PUBLIC_*` variable. Production clients need real user authentication and a server-issued bearer token before accessing the backend.
- Set `MARKET_ALLOWED_ORIGINS` to the exact web origins that need access. Leave it empty only when browser access is not part of the deployment.
- Add real user authentication, provider quota monitoring, and centralized rate limiting before making the app public.
- Rotate any credential that has appeared in source, logs, screenshots, or chat history.

Never commit `.env` or put provider credentials in variables prefixed with `EXPO_PUBLIC_`.

