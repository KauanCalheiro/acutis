---
name: run-local
description: Use when the user wants to run, start, boot, or serve the Acutis app. One Nuxt and Nitro process on port 3000 serves UI, API, recorder and runner.
---

# Rodar a stack acutis

Sobe a aplicação Nuxt e Nitro como um processo direto no host. É o mesmo modo que o E2E usa.

## Pré-requisitos no host

Node 22+, pnpm. Checar antes de subir:

```sh
node -v && pnpm -v
```

Faltando algum → parar e avisar o usuário; não tentar instalar runtime.

## Portas (defaults do framework, sem remap)

| Serviço | Porta | URL |
|---------|-------|-----|
| Acutis (Nuxt + Nitro) | 3000 | http://localhost:3000 |

O mesmo processo serve interface, API, WebSocket, gravador e runner.

## Setup de primeira vez

`pnpm install` **na raiz** instala a aplicação e o pacote `e2e`. Só precisa rodar na primeira vez ou após mudar dependência. O SQLite das configurações nasce sozinho na primeira execução. O Chromium compatível com a versão do Playwright é conferido ao subir e baixado automaticamente quando ainda não existe no cache da máquina.

## Subir a aplicação

```sh
./dev.sh              # sobe a aplicação e fica preso; Ctrl+C derruba tudo
./dev.sh --build      # instala dependências antes de subir
./dev.sh --headless   # recorder sem janela, para quando um agente dirige a ferramenta
```

**`--headless` quando você não é a pessoa no micro.** O recorder abre Chromium visível por padrão, porque gravar é alguém usando o sistema. Dirigindo por API (`/debug/goto`, `/debug/click`), a janela só rouba o foco de quem está trabalhando na máquina.

O script já checa os pré-requisitos, recusa subir se a porta estiver ocupada, passa o `WEBDRIVER_TEST_MODE=1` e imprime a URL.

Rodando por um agente: lançar com `run_in_background` e derrubar depois com `kill -INT <pid>`. O `set -m` do script coloca cada serviço no próprio process group, então o SIGINT limpa a árvore inteira.

## Subir diretamente

```sh
WEBDRIVER_TEST_MODE=1 pnpm dev
```

**`WEBDRIVER_TEST_MODE=1` não é opcional pra rodar teste pela UI.** Os endpoints `/runner/*` respondem **403** sem ela. O `dev.sh` já seta; subindo na mão, precisa passar na linha de comando.

Lançar cada um com `run_in_background`, depois confirmar que respondem (curl na URL) antes de reportar pronto.

## Reiniciar depois de editar

- Nuxt aplica hot reload na interface e nos handlers. Se uma dependência carregada no bootstrap não atualizar, reinicie o processo.

## Notas

- Sem `RECORDER_CDP_URL`, o recorder abre o próprio Chromium headed (não depende de Chrome externo). Com a variável, conecta num Chrome já aberto com porta de debug: é como se grava na sessão logada do usuário.
- E2E: não precisa subir nada à mão. `pnpm test:e2e` compila e sobe a aplicação como processo filho.
