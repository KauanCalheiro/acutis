---
name: run-local
description: Use when the user wants to run, start, boot, or serve the acutis stack — frontend Nuxt :3000, backend NestJS :4000 (API + gravador + runner). Direct host processes; there is no container mode. Triggers on "rodar local", "subir local", "run local", "rodar o projeto", "start the app".
---

# Rodar a stack acutis

Sobe backend e frontend como processos diretos no host — é o único modo de execução do projeto, e o mesmo que o e2e usa por baixo. Esta skill é a fonte de verdade dos comandos.

## Pré-requisitos no host

Node 22+, pnpm. Checar antes de subir:

```sh
node -v && pnpm -v
```

Faltando algum → parar e avisar o usuário; não tentar instalar runtime.

## Portas (defaults do framework, sem remap)

| Serviço | Porta | URL |
|---------|-------|-----|
| frontend (Nuxt) | 3000 | http://localhost:3000 |
| backend (NestJS) | 4000 | http://localhost:4000 |

O backend serve a API, o gravador e o runner no mesmo processo. Os configs (`frontend/nuxt.config.ts`, `backend/src/config/env.ts`) já apontam pra esses defaults entre si.

## Setup de primeira vez

`pnpm install` **na raiz** — é um workspace pnpm, um comando instala os quatro pacotes (`backend`, `frontend`, `contracts`, `e2e`). Só na primeira vez ou após mudar dependência. O SQLite das configurações nasce sozinho na primeira execução.

## Subir os dois de uma vez (preferido)

```sh
./dev.sh              # sobe os dois, fica preso, logs prefixados; Ctrl+C derruba tudo
./dev.sh --build      # instala dependências antes de subir
./dev.sh --headless   # recorder sem janela — usar quando um agente dirige a ferramenta
```

**`--headless` quando você não é a pessoa no micro.** O recorder abre Chromium visível por padrão, porque gravar é alguém usando o sistema. Dirigindo por API (`/debug/goto`, `/debug/click`), a janela só rouba o foco de quem está trabalhando na máquina.

O script já checa os pré-requisitos, recusa subir se alguma porta estiver ocupada, passa o `WEBDRIVER_TEST_MODE=1` e imprime as URLs quando os dois respondem.

Rodando por um agente: lançar com `run_in_background` e derrubar depois com `kill -INT <pid>` — o `set -m` do script coloca cada serviço no próprio process group, então o SIGINT limpa a árvore inteira.

## Subir cada um separado (quando precisar isolar um serviço)

```sh
pnpm --filter @acutis/frontend dev                        # :3000
WEBDRIVER_TEST_MODE=1 pnpm --filter @acutis/backend dev   # :4000
```

Os filtros rodam de qualquer diretório do repositório.

**`WEBDRIVER_TEST_MODE=1` não é opcional pra rodar teste pela UI.** Os endpoints `/runner/*` (que o botão "Testar" usa, via backend) respondem **403** sem ela. O `dev.sh` já seta; subindo na mão, precisa passar na linha de comando.

Lançar cada um com `run_in_background`, depois confirmar que respondem (curl na URL) antes de reportar pronto.

## Reiniciar depois de editar

- **frontend**: hot reload, não precisa reiniciar.
- **backend**: `pnpm dev` **NÃO é watch mode** — é `node` de uma vez só. Editou `backend/src/**` → matar (`pkill -f main.ts`) e subir de novo, senão serve código antigo silenciosamente.

## Notas

- Sem `RECORDER_CDP_URL`, o recorder abre o próprio Chromium headed (não depende de Chrome externo). Com a variável, conecta num Chrome já aberto com porta de debug — é como se grava na sessão logada do usuário.
- E2E: não precisa subir nada à mão — `pnpm --filter @acutis/e2e test` sobe os dois como processos filhos (o `pretest` faz o build do frontend e do backend por `--filter`).
