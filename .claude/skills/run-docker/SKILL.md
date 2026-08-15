---
name: run-docker
description: Use when the user wants to run, start, boot, or serve the acutis stack via Docker (docker compose, ambiente isolado sem PHP/Node/Composer/pnpm no host) — frontend :23000, backend :24000, backend-laravel :28000. Triggers on "rodar no docker", "subir o compose", "run with docker", "docker compose up".
---

# Rodar a stack acutis com Docker

Sobe backend, frontend e webdriver num ambiente isolado e reproduzível via `docker compose`, sem precisar de PHP/Node/Composer/pnpm no host. Hot reload funciona nos três. Esta skill é a fonte de verdade dos comandos do modo Docker.

**Não misturar com o modo local no mesmo serviço/host** (conflito de porta/estado). O modo local vive na skill `run-local`.

## Subir / derrubar

```sh
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml logs -f <serviço>
```

**Linux nativo (Docker Engine, sem Docker Desktop):** subir com o override, senão o webdriver não alcança o Chrome do host (ver seção Gravação):

```sh
docker compose -f docker-compose.dev.yml -f docker-compose.linux.yml up -d
```

## Portas (publicadas altas de propósito)

| Serviço | Host | Container | URL |
|---------|------|-----------|-----|
| frontend (Nuxt) | 23000 | 3000 | http://localhost:23000 |
| backend (NestJS) | 24000 | 4000 | http://localhost:24000 |
| backend-laravel | 28000 | 8000 | http://localhost:28000 |

Tabela no README pra configurar o Nginx Proxy Manager. `NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL` (frontend) e `CORS_ORIGIN` (webdriver) já vêm no compose apontando pras portas publicadas — trocou porta/domínio, ajustar lá (`environment` ganha de `env_file`).

## Comando pontual (artisan, composer, pnpm, testes)

Sempre via `exec`, **nunca no host**:

```sh
docker compose -f docker-compose.dev.yml exec <serviço> <comando>
```

## Instalar/mudar dependência → recriar na hora

`node_modules` de frontend/webdriver vivem em volumes nomeados; instalar no host NÃO instala no container e o serviço quebra com `Cannot find package`. Depois de qualquer `pnpm add`/mudança de dependência:

```sh
docker compose -f docker-compose.dev.yml up -d --force-recreate <serviço>
```

(o `pnpm install` roda no boot). Mudou o `Dockerfile` → rebuild (`... build`); editar só o `entrypoint.sh` (bind mount) não precisa.

## Gravação: Chrome do host via CDP

Com a stack no Docker, o recorder conecta num **Chrome na máquina do usuário** via CDP (`RECORDER_CDP_URL`, default `http://host.docker.internal:9222`). Antes de gravar, abrir o Chrome com porta de debug e perfil dedicado:

```sh
# macOS
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.acutis/chrome"
# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.acutis/chrome" &
# Windows (PowerShell)
Start-Process "chrome" -ArgumentList "--remote-debugging-port=9222","--user-data-dir=$env:USERPROFILE\.acutis\chrome"
```

**Linux nativo:** Chrome ~v136+ só aceita CDP em `127.0.0.1` e `host.docker.internal` aponta pra bridge — por isso o override `docker-compose.linux.yml` (põe o webdriver em `network_mode: host`). macOS/Windows (Docker Desktop) não precisam. Sem Chrome do host acessível, a gravação falha com erro claro na UI.

## Notas

- Assets Docker de cada projeto: `<projeto>/docker/development/` (Dockerfile, entrypoint).
- Permissões nos bind mounts: os `entrypoint.sh` detectam o UID/GID dono de `/app` e reexecutam via `gosu` como usuário `dev`, pra `vendor/`/`.nuxt/`/`dist-ui/` saírem com o dono do host (não root). Precisa da imagem com `gosu` (rebuild se editar o Dockerfile).
