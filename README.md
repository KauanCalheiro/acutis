# Acutis — TCC (Versão Final)

Esta é a versão final do TCC. A versão inicial (com erros e código legado) está preservada em `../legacy-tcc/`.

## Desenvolvimento (Docker)

```sh
docker compose -f docker-compose.dev.yml up
```

Portas publicadas no host (altas de propósito, pra não colidir com nada — expor bonito depois via Nginx Proxy Manager):

| Serviço | Host | Interna | Nota pro proxy |
|---------|------|---------|----------------|
| frontend (Nuxt) | `23000` | 3000 | app principal; WebSocket habilitado (HMR do Vite) |
| webdriver (NestJS) | `24000` | 4000 | precisa de WebSocket upgrade em `/ws`; ao trocar o domínio, ajustar `NUXT_PUBLIC_WEBDRIVER_URL` (frontend) e `CORS_ORIGIN` (webdriver) no compose |
| backend (Laravel) | `28000` | 8000 | API REST |
