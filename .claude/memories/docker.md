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

**Why:** ambiente único e reproduzível pros três serviços (backend :8000, frontend :3000, webdriver :4000), com hot reload verificado em todos os fluxos — rota nova no Laravel, página nova no Nuxt, restart do Nest via `node --watch` e rebuild da pill via `vite build --watch`.

**How to apply:**
- Subir/derrubar: `docker compose -f docker-compose.dev.yml up -d` / `down`. Logs: `docker compose -f docker-compose.dev.yml logs -f <serviço>`.
- Comando pontual (artisan, composer, pnpm, testes de um serviço): `docker compose -f docker-compose.dev.yml exec <serviço> <comando>` — não rodar no host.
- Assets Docker de cada projeto ficam em `<projeto>/docker/development/` (Dockerfile, entrypoint).
- Env vars: Laravel e Nuxt carregam seus `.env` pelo bind mount; o webdriver usa `webdriver/.env` opcional (`env_file` no compose) pra sobrescrever `PORT`/`CORS_ORIGIN`.
- `node_modules` de frontend/webdriver vivem em volumes nomeados (host macOS ≠ Linux) — depois de mudar dependência, o `pnpm install` roda sozinho no boot do container; se precisar forçar, recriar o serviço.
- O Chromium do webdriver roda em xvfb dentro do container: a janela não aparece no host, mas screencast/vídeo funcionam normalmente.
- Exceção: `e2e/` ainda roda no host (`pnpm test` sobe seus próprios processos filhos); não está no compose.
