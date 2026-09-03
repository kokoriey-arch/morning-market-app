# Deployment

## Architecture

The mobile app calls the backend at `EXPO_PUBLIC_MARKET_API_URL`. The backend calls Twelve Data and Kiwoom. Provider credentials must only exist in the backend environment.

## Local setup

1. Copy `.env.example` to `.env`.
2. Put newly issued credentials in `TWELVE_DATA_API_KEY`, `KIWOOM_APP_KEY`, and `KIWOOM_SECRET_KEY`.
3. Set `EXPO_PUBLIC_MARKET_API_URL` to the backend URL.
4. Run `npm run proxy` and `npm start`.

For an Android emulator, use `http://10.0.2.2:8787` locally. A physical device needs the computer's LAN address. Production must use an HTTPS URL.

## Production requirements

- Deploy `server/kiwoomProxy.js` behind HTTPS and a reverse proxy.
- Set `MARKET_PROXY_HOST=127.0.0.1` when TLS is terminated by the reverse proxy, or set a non-local host together with a long random `MARKET_PROXY_TOKEN`.
- Do not put `MARKET_PROXY_TOKEN` or any provider credential in an `EXPO_PUBLIC_*` variable. Production clients need real user authentication and a server-issued bearer token before accessing the backend.
- Set `MARKET_ALLOWED_ORIGINS` to the exact web origins that need access. Leave it empty only when browser access is not part of the deployment.
- Add real user authentication, provider quota monitoring, and centralized rate limiting before making the app public.
- Rotate any credential that has appeared in source, logs, screenshots, or chat history.

Never commit `.env` or put provider credentials in variables prefixed with `EXPO_PUBLIC_`.
