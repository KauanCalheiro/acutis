# Rodar local (sem Docker)

Backend, frontend e webdriver como processos diretos no host. É o modo que o [E2E](TESTS.md#e2e-playwright) usa por baixo. A alternativa isolada está em [DOCKER.md](DOCKER.md).

> **Não misture os dois modos para o mesmo serviço.** Container e processo local disputam porta e estado. Se o compose estiver de pé, derrube antes: `docker compose -f docker-compose.dev.yml down`.

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Portas](#portas)
- [Setup de primeira vez](#setup-de-primeira-vez)
- [Subir os três de uma vez](#subir-os-três-de-uma-vez)
- [Subir cada serviço separado](#subir-cada-serviço-separado)
- [Peculiaridades](#peculiaridades)

## Pré-requisitos

PHP 8.5+, Composer, Node 24+ e pnpm no `PATH`:

```sh
php -v && composer --version && node -v && pnpm -v
```

O `./dev.sh` checa isso antes de subir e recusa continuar se faltar algum — não tenta instalar runtime.

## Portas

Defaults dos frameworks, sem remap. Os configs (`frontend/nuxt.config.ts`, `webdriver/src/config/env.ts`, `backend/config/acutis.php`) já apontam para esses valores entre si; é o Docker que sobrescreve para os nomes de serviço, não o contrário.

| Serviço | Porta | URL |
|---------|-------|-----|
| backend (Laravel) | 8000 | http://localhost:8000 |
| frontend (Nuxt) | 3000 | http://localhost:3000 |
| webdriver (NestJS) | 4000 | http://localhost:4000 |

## Setup de primeira vez

O jeito curto é deixar o script fazer (`./dev.sh --build`). Na mão, é idempotente:

```sh
cd backend
composer install
[ -f .env ] || cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
```

Frontend e webdriver precisam só de `pnpm install` — na primeira vez ou depois de mudar dependência.

## Subir os três de uma vez

```sh
./dev.sh              # sobe os três, fica preso, logs prefixados por serviço; Ctrl+C derruba tudo
./dev.sh --build      # instala dependências e prepara o banco antes de subir
./dev.sh --headless   # recorder sem janela
```

É o equivalente local do `docker compose up`: checa os pré-requisitos, recusa subir se alguma das portas já estiver escutando, passa o `WEBDRIVER_TEST_MODE=1` e imprime as URLs quando os três respondem (`/api/v1/projects`, `/`, `/health`). Se algum não responder em 2 minutos, avisa e deixa os logs na tela.

## Subir cada serviço separado

Quando precisar isolar um serviço (debug, reiniciar só um):

```sh
cd backend   && php artisan serve                                # :8000
cd frontend  && pnpm install && pnpm dev                         # :3000
cd webdriver && pnpm install && WEBDRIVER_TEST_MODE=1 pnpm dev   # :4000
```

## Peculiaridades

- **`WEBDRIVER_TEST_MODE=1` não é opcional.** Os endpoints `/runner/*` — que o botão "Testar" da interface usa, via backend — respondem **403** sem ela. O `dev.sh` e o compose já setam; subindo o webdriver na mão, você precisa passar.
- **`pnpm dev` do webdriver NÃO é watch mode.** É um `node` de uma vez só. Editou `webdriver/src/**` → matar (`pkill -f main.ts`) e subir de novo. Sem isso ele serve o código antigo silenciosamente, sem erro nenhum — é a causa clássica de "mudei e não mudou nada". Backend e frontend têm hot reload e não precisam de reinício.
- **O recorder abre uma janela.** Sem `RECORDER_CDP_URL`, ele sobe o próprio Chromium *headed* — não depende de Chrome externo, diferente do modo Docker. Gravar é alguém usando o sistema, então a janela vem visível de propósito; use `--headless` quando não for uma pessoa dirigindo a ferramenta.
- **Porta ocupada: cheque só quem escuta.** `lsof -ti tcp:3000` casa também as *conexões* do navegador e acusa porta ocupada sem haver servidor nenhum. O certo é `lsof -nP -iTCP:3000 -sTCP:LISTEN` (é o que o `dev.sh` faz).
- **O E2E não precisa desta stack de pé.** `pnpm test` dentro de `e2e/` sobe os três como processos filhos, em portas próprias (42xx), e semeia o próprio banco. Os dois convivem — ver [TESTS.md](TESTS.md#e2e-playwright).
