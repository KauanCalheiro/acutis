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
| webdriver (NestJS) | `24000` | 4000 | precisa de WebSocket upgrade em `/ws`; ao trocar o domínio, ajustar `NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL` (frontend) e `CORS_ORIGIN` (webdriver) no compose |
| backend (Laravel) | `28000` | 8000 | API REST |

## Gravação no Chrome do host

Com a stack no Docker, o recorder se conecta a um Chrome rodando **na sua máquina** via CDP (`RECORDER_CDP_URL`, default `http://host.docker.internal:9222`) — a gravação acontece numa janela nativa. Antes de gravar, abra o Chrome com a porta de debug e um perfil dedicado:

```sh
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.acutis/chrome"
```

Sem `RECORDER_CDP_URL` (ex.: rodando o webdriver direto no host), o recorder abre o próprio Chromium headed.
