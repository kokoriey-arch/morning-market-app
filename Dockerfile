# Zero-dependency Node proxy for morning-market-app.
# Build: docker build -t market-proxy .
# Run:   docker run -d --env-file .env -p 127.0.0.1:8787:8787 market-proxy
# (.env must contain the provider credentials and MARKET_PROXY_TOKEN)
FROM node:20-alpine

ENV NODE_ENV=production
# Containers must accept connections from outside their network namespace.
# MARKET_PROXY_TOKEN is required because the proxy is no longer local.
ENV MARKET_PROXY_HOST=0.0.0.0

WORKDIR /app
COPY server/package.json server/kiwoomProxy.js ./server/

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8787}/healthz" >/dev/null 2>&1 || exit 1

CMD ["node", "server/kiwoomProxy.js"]
