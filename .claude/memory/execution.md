---
name: execution
description: Modo de execução da stack — só local, LER antes de subir/rodar qualquer serviço (→ skill run-local)
metadata:
  type: feedback
---

Um jeito só de rodar a aplicação: um processo Nuxt e Nitro direto no host, via skill `run-local`.
É o mesmo modo que o [e2e](e2e.md) usa.

**Why:** o Docker foi removido do projeto. O gravador precisa de um navegador com janela no host e o
produto entregue é um CLI npm que roda na máquina do usuário — o container não isolava nada, só
exigia furos (CDP para `host.docker.internal`, `network_mode: host` no Linux, tradução de path para
os links `vscode://`). As duas dependências de máquina são Node 22+ e pnpm.

**How to apply:** seguir a skill `run-local` por completo (setup, comandos, troubleshooting). Se
encontrar referência a `docker compose`, `docker-compose.dev.yml` ou `ACUTIS_PROJECTS_HOST_PATH` em
algum documento, é resquício — não existe mais.

**Reinício depois de editar código:** antes de investigar por que o comportamento não mudou,
confirmar que o processo Nuxt aplicou a alteração. Dependências carregadas no bootstrap podem exigir
reinício mesmo com hot reload ativo.
