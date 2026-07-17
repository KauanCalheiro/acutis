---
name: docker
description: Desenvolvimento sempre via Docker — subir serviços e rodar comandos pelo docker compose, nunca direto no host
metadata:
  type: feedback
---

**Tudo roda via Docker.** Nunca subir serviço direto no host (`php artisan serve`, `pnpm dev` etc.) — a stack de dev sobe com:

```sh
docker compose -f docker-compose.dev.yml up
```

**Why:** ambiente único e reproduzível pros três serviços (frontend :23000, webdriver :24000, backend :28000 no host — portas altas de propósito, tabela no README pra configurar o Nginx Proxy Manager depois). Hot reload funciona nos três (Laravel, Nuxt, `node --watch`/`vite build --watch` do webdriver).

**How to apply:**
- Subir/derrubar: `docker compose -f docker-compose.dev.yml up -d` / `down`. Logs: `docker compose -f docker-compose.dev.yml logs -f <serviço>`.
- Comando pontual (artisan, composer, pnpm, testes de um serviço): `docker compose -f docker-compose.dev.yml exec <serviço> <comando>` — não rodar no host.
- Assets Docker de cada projeto ficam em `<projeto>/docker/development/` (Dockerfile, entrypoint).
- Env vars: Laravel e Nuxt carregam seus `.env` pelo bind mount; o webdriver usa `webdriver/.env` opcional (`env_file` no compose). `CORS_ORIGIN` (webdriver) e `NUXT_PUBLIC_WEBDRIVER_URL` (frontend) já vêm setados no compose apontando pras portas publicadas — `environment` ganha de `env_file`, mudou porta/domínio, ajustar lá.
- `node_modules` de frontend/webdriver vivem em volumes nomeados (host macOS ≠ Linux) — instalar pacote no host NÃO instala no container e o serviço quebra com `Cannot find package` até ser recriado. Depois de qualquer `pnpm add`/mudança de dependência, **sempre** recriar o serviço na hora: `docker compose -f docker-compose.dev.yml up -d --force-recreate <serviço>` (o `pnpm install` roda no boot).
- Gravação com a stack no Docker: o recorder conecta num **Chrome do host** via CDP (`RECORDER_CDP_URL`, default `http://host.docker.internal:9222` no compose) — janela nativa na máquina do usuário; abrir o Chrome com `--remote-debugging-port=9222 --user-data-dir` dedicado (comando no README). Sem a env (webdriver no host/E2E), o recorder abre o próprio Chromium headed; no container sem Chrome do host acessível, a gravação falha com erro claro na UI.
  - **Linux nativo (Docker Engine, sem Docker Desktop):** Chrome recente (~v136+) ignora `--remote-debugging-address` e só aceita CDP em `127.0.0.1`; como `host.docker.internal` no Linux aponta pro IP da bridge (não pro loopback), o `webdriver` não alcança o Chrome do host só com o compose padrão. Fix: subir com o override `docker-compose.linux.yml` (`network_mode: host` no `webdriver`, que aí compartilha o `127.0.0.1` da máquina) — comando completo no README. macOS/Windows (Docker Desktop) não precisam disso, a VM já expõe o loopback do host.
- Exceção: [e2e](e2e.md) ainda roda no host (`pnpm test` sobe seus próprios processos filhos); não está no compose.
