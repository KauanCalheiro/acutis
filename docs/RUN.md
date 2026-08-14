# Rodar o Acutis

Índice dos documentos de execução. Escolha um modo, siga o documento dele por completo.

| Documento | Assunto |
|-----------|---------|
| [LOCAL.md](LOCAL.md) | Stack como processos diretos no host — precisa de PHP, Composer, Node e pnpm instalados |
| [DOCKER.md](DOCKER.md) | Stack em containers via `docker compose` — não precisa de runtime nenhum no host |
| [DESKTOP.md](DESKTOP.md) | Construir o acutis como aplicativo, com os runtimes dentro — pré-requisitos por sistema |
| [INSTALL.md](INSTALL.md) | Instalar o aplicativo pronto (macOS, Windows, Ubuntu) — para quem só vai usar |
| [RELEASE.md](RELEASE.md) | Publicar os instaladores no GitHub |
| [TESTS.md](TESTS.md) | As quatro suítes de teste (backend, frontend, webdriver, e2e): comandos e peculiaridades |

## Qual modo usar

| Quero… | Modo |
|--------|------|
| Ambiente reproduzível, sem instalar runtime na máquina | [Docker](DOCKER.md) |
| Iterar rápido em um serviço, com debugger e reinício na mão | [Local](LOCAL.md) |
| Rodar a suíte E2E | [Local](LOCAL.md) — o harness sobe os serviços sozinho, ver [TESTS.md](TESTS.md#e2e-playwright) |
| Só usar o acutis, sem instalar runtime nenhum | [Instalar o aplicativo](INSTALL.md) |
| Construir o instalador | [Desktop](DESKTOP.md) |
| Publicar uma versão nova | [Release](RELEASE.md) |

**Não misture os dois modos para o mesmo serviço.** Um container e um processo local do mesmo serviço disputam porta e estado. Trocando de modo, derrube o anterior primeiro (`docker compose -f docker-compose.dev.yml down`, ou `Ctrl+C` no `./dev.sh`).

## Portas por modo

Os três conjuntos são disjuntos de propósito: a suíte E2E roda com a stack de desenvolvimento de pé, sem derrubar nada.

| Serviço | Local | Docker (host) | E2E |
|---------|-------|---------------|-----|
| backend (Laravel) | 8000 | 28000 | 4200 |
| frontend (Nuxt) | 3000 | 23000 | 4300 |
| webdriver (NestJS) | 4000 | 24000 | 4400 |
