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

Com a stack no Docker, o recorder se conecta a um Chrome rodando **na sua máquina** via CDP (`RECORDER_CDP_URL`, default `http://host.docker.internal:9222`) — a gravação acontece numa janela nativa. Antes de gravar, abra o Chrome com a porta de debug e um perfil dedicado (as flags são do próprio Chrome e funcionam igual em qualquer OS; só o jeito de invocar muda):

**macOS**

```sh
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.acutis/chrome"
```

**Linux**

```sh
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.acutis/chrome" &
```

**Windows (PowerShell)**

```powershell
Start-Process "chrome" -ArgumentList "--remote-debugging-port=9222","--user-data-dir=$env:USERPROFILE\.acutis\chrome"
```

Sem `RECORDER_CDP_URL` (ex.: rodando o webdriver direto no host), o recorder abre o próprio Chromium headed.

> **TODO ([#56](https://github.com/KauanCalheiro/acutis/issues/56)):** abrir o Chrome na mão é atrito de DX. O plano de longo prazo é empacotar o recorder para rodar no host (companion `acutis-recorder` ou app desktop Electron/Tauri embutindo frontend + webdriver), eliminando este passo. Pensar melhor na estratégia de empacotamento antes da release.
