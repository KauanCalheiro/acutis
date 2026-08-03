# Rodar com Docker

Backend, frontend e webdriver num ambiente isolado e reproduzível, sem precisar de PHP, Composer, Node ou pnpm no host. Hot reload funciona nos três. A alternativa direta no host está em [LOCAL.md](LOCAL.md).

> **Não misture os dois modos para o mesmo serviço.** Container e processo local disputam porta e estado.

## Sumário

- [Subir e derrubar](#subir-e-derrubar)
- [Portas](#portas)
- [Rodar comando pontual](#rodar-comando-pontual)
- [Gravação: Chrome do host via CDP](#gravação-chrome-do-host-via-cdp)
- [Peculiaridades](#peculiaridades)

## Subir e derrubar

```sh
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml logs -f <serviço>   # backend | frontend | webdriver
```

**Linux nativo (Docker Engine, sem Docker Desktop):** suba com o override, senão o webdriver não alcança o Chrome do host e a gravação não funciona (ver [Gravação](#gravação-chrome-do-host-via-cdp)):

```sh
docker compose -f docker-compose.dev.yml -f docker-compose.linux.yml up -d
```

## Portas

Publicadas altas de propósito, para não colidir com nada no host — a ideia é expô-las depois por um proxy (Nginx Proxy Manager).

| Serviço | Host | Container | URL | Nota para o proxy |
|---------|------|-----------|-----|-------------------|
| frontend (Nuxt) | 23000 | 3000 | http://localhost:23000 | app principal; precisa de WebSocket (HMR do Vite) |
| webdriver (NestJS) | 24000 | 4000 | http://localhost:24000 | precisa de WebSocket upgrade em `/ws` |
| backend (Laravel) | 28000 | 8000 | http://localhost:28000 | API REST |

`NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL` (frontend) e `CORS_ORIGIN` (webdriver) já vêm no compose apontando para as portas publicadas. Trocou porta ou domínio, ajuste as duas — o compose lê essas variáveis de um `.env` na raiz, se existir, e `environment` ganha de `env_file`.

## Rodar comando pontual

Artisan, Composer, pnpm, testes: sempre via `exec`, **nunca no host** (o host pode nem ter o runtime, e o estado é o do container).

```sh
docker compose -f docker-compose.dev.yml exec backend php artisan migrate
docker compose -f docker-compose.dev.yml exec frontend pnpm test
```

## Gravação: Chrome do host via CDP

Com a stack no Docker, o recorder não abre um navegador dentro do container: ele conecta num **Chrome que roda na sua máquina** via CDP (`RECORDER_CDP_URL`, default `http://host.docker.internal:9222`). Antes de gravar, abra o Chrome com a porta de debug e um perfil dedicado:

```sh
# macOS
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.acutis/chrome"

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.acutis/chrome" &
```

```powershell
# Windows (PowerShell)
Start-Process "chrome" -ArgumentList "--remote-debugging-port=9222","--user-data-dir=$env:USERPROFILE\.acutis\chrome"
```

Sem um Chrome do host acessível, a gravação falha com erro claro na interface.

> Abrir o Chrome na mão é atrito de DX conhecido ([#56](https://github.com/KauanCalheiro/acutis/issues/56)). O plano é empacotar o recorder para rodar no host e eliminar este passo.

## Peculiaridades

- **Instalou dependência? Recrie o serviço.** Os `node_modules` de frontend e webdriver vivem em volumes nomeados: rodar `pnpm add` no host **não** instala no container, e o serviço quebra com `Cannot find package`. Depois de qualquer mudança de dependência:

  ```sh
  docker compose -f docker-compose.dev.yml up -d --force-recreate <serviço>
  ```

  O `pnpm install` roda no boot do container.

- **Mudou o `Dockerfile`? Rebuild** (`docker compose -f docker-compose.dev.yml build <serviço>`). Editar só o `entrypoint.sh` não precisa — ele entra por bind mount.
- **Linux nativo precisa do override por causa do Chrome.** Desde a ~v136 o Chrome ignora `--remote-debugging-address` e só aceita CDP em `127.0.0.1`; no Docker Engine nativo, `host.docker.internal` aponta para o IP da bridge, não para o loopback. O `docker-compose.linux.yml` resolve colocando o webdriver em `network_mode: host`, igualando o `127.0.0.1` dele ao da máquina. No macOS e no Windows (Docker Desktop) isso não é necessário: a VM já expõe o loopback do host.
- **Permissões nos bind mounts.** Cada `entrypoint.sh` detecta o UID/GID dono de `/app` e se reexecuta via `gosu` como usuário `dev`, para que `vendor/`, `.nuxt/` e `dist-ui/` saiam com o dono do host em vez de root. Depende da imagem ter `gosu` — se editar o Dockerfile, rebuild.
- **`WEBDRIVER_TEST_MODE=1` já vem setado** no compose; sem ela os endpoints `/runner/*` respondem 403 e o botão "Testar" não funciona. Só o [modo local](LOCAL.md) precisa passar isso na mão.
- Os assets Docker de cada projeto ficam em `<projeto>/docker/development/` (Dockerfile + entrypoint).
