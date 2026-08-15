# Rodar local (sem Docker)

Backend (NestJS) e frontend como processos diretos no host. É o modo que o [E2E](TESTS.md#e2e-playwright) usa por baixo. A alternativa isolada está em [DOCKER.md](DOCKER.md).

> **Não misture os dois modos para o mesmo serviço.** Container e processo local disputam porta e estado. Se o compose estiver de pé, derrube antes: `docker compose -f docker-compose.dev.yml down`.

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Portas](#portas)
- [Setup de primeira vez](#setup-de-primeira-vez)
- [Subir os dois de uma vez](#subir-os-dois-de-uma-vez)
- [Subir cada serviço separado](#subir-cada-serviço-separado)
- [Peculiaridades](#peculiaridades)

## Pré-requisitos

Node 24+ e pnpm no `PATH`:

```sh
node -v && pnpm -v
```

O `./dev.sh` checa isso antes de subir e recusa continuar se faltar algum — não tenta instalar runtime.

## Portas

Defaults dos frameworks, sem remap. Os configs (`frontend/nuxt.config.ts`, `backend/src/config/env.ts`) já apontam para esses valores entre si; é o Docker que sobrescreve para os nomes de serviço, não o contrário.

| Serviço | Porta | URL |
|---------|-------|-----|
| frontend (Nuxt) | 3000 | http://localhost:3000 |
| backend (NestJS) | 4000 | http://localhost:4000 |

A API `/api/v1`, o gravador e o runner vivem no mesmo processo desde a migração para Node — por isso são dois serviços, e não três.

## Setup de primeira vez

`pnpm install` em `frontend/` e em `backend/` — na primeira vez ou depois de mudar dependência. O jeito curto é `./dev.sh --build`.

Não há banco a preparar: o SQLite das configurações de IA nasce sozinho em `~/.acutis/runtime/database.sqlite` na primeira requisição, e o resto do estado (projetos, cenários, execuções) vive no filesystem e no git.

## Subir os dois de uma vez

```sh
./dev.sh              # sobe os dois, fica preso, logs prefixados por serviço; Ctrl+C derruba tudo
./dev.sh --build      # instala as dependências antes de subir
./dev.sh --headless   # recorder sem janela
```

É o equivalente local do `docker compose up`: checa os pré-requisitos, recusa subir se alguma das portas já estiver escutando, passa o `WEBDRIVER_TEST_MODE=1` e imprime as URLs quando os dois respondem. Se algum não responder em 2 minutos, avisa e deixa os logs na tela.

## Subir cada serviço separado

Quando precisar isolar um serviço (debug, reiniciar só um):

```sh
cd frontend && pnpm install && pnpm dev                       # :3000
cd backend  && pnpm install && WEBDRIVER_TEST_MODE=1 pnpm dev # :4000
```

## Peculiaridades

- **`WEBDRIVER_TEST_MODE=1` não é opcional.** Os endpoints `/runner/*` — que o botão "Testar" da interface usa — respondem **403** sem ela. O `dev.sh` e o compose já setam; subindo o backend na mão, você precisa passar.
- **`pnpm dev` do backend NÃO é watch mode.** É um `node` de uma vez só. Editou `backend/src/**` → matar (`pkill -f main.ts`) e subir de novo. Sem isso ele serve o código antigo silenciosamente, sem erro nenhum — é a causa clássica de "mudei e não mudou nada". O frontend tem hot reload e não precisa de reinício.
- **O recorder abre uma janela.** Sem `RECORDER_CDP_URL`, ele sobe o próprio Chromium *headed* — não depende de Chrome externo, diferente do modo Docker. Gravar é alguém usando o sistema, então a janela vem visível de propósito; use `--headless` quando não for uma pessoa dirigindo a ferramenta.
- **Porta ocupada: cheque só quem escuta.** `lsof -ti tcp:3000` casa também as *conexões* do navegador e acusa porta ocupada sem haver servidor nenhum. O certo é `lsof -nP -iTCP:3000 -sTCP:LISTEN` (é o que o `dev.sh` faz).
- **O diário de requisições.** Cada requisição atendida vira uma linha JSON em `~/.acutis/runtime/logs/requests-<dia>.jsonl`, com payload de ida e volta, tempos e as chamadas HTTP que ela disparou para fora — as do provedor de IA inclusive. Credenciais são redigidas e o arquivo é apagado depois de sete dias.
- **O E2E não precisa desta stack de pé.** `pnpm test` dentro de `e2e/` sobe os serviços como processos filhos, em portas próprias (42xx), com diretório de projetos temporário. Os dois convivem — ver [TESTS.md](TESTS.md#e2e-playwright).
