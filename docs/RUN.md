# Rodar o Acutis

Índice dos documentos de execução. Escolha um modo, siga o documento dele por completo.

| Documento | Assunto |
|-----------|---------|
| [LOCAL.md](LOCAL.md) | Stack como processos diretos no host — precisa de Node e pnpm instalados |
| [DOCKER.md](DOCKER.md) | Stack em containers via `docker compose` — não precisa de runtime nenhum no host |
| [TESTS.md](TESTS.md) | As três suítes de teste (backend, frontend, e2e): comandos e peculiaridades |
| [DEPLOY.md](DEPLOY.md) | Publicar o `acutis-cli` no npm — o que vai no pacote e como testar antes |

## Qual modo usar

| Quero… | Modo |
|--------|------|
| Ambiente reproduzível, sem instalar runtime na máquina | [Docker](DOCKER.md) |
| Iterar rápido em um serviço, com debugger e reinício na mão | [Local](LOCAL.md) |
| Rodar a suíte E2E | [Local](LOCAL.md) — o harness sobe os serviços sozinho, ver [TESTS.md](TESTS.md#e2e-playwright) |

**Não misture os dois modos para o mesmo serviço.** Um container e um processo local do mesmo serviço disputam porta e estado. Trocando de modo, derrube o anterior primeiro (`docker compose -f docker-compose.dev.yml down`, ou `Ctrl+C` no `./dev.sh`).

## Portas por modo

Os três conjuntos são disjuntos de propósito: a suíte E2E roda com a stack de desenvolvimento de pé, sem derrubar nada.

| Serviço | Local | Docker (host) | E2E |
|---------|-------|---------------|-----|
| frontend (Nuxt) | 3000 | 23000 | 4300 |
| backend (NestJS) | 4000 | 24000 | 4400 |

O backend serve a API `/api/v1`, o gravador e o runner no mesmo processo desde a migração para Node.
