---
name: execution
description: Modo de execução da stack — só local, LER antes de subir/rodar qualquer serviço (→ skill run-local)
metadata:
  type: feedback
---

Um jeito só de rodar a stack (backend e frontend): processos diretos no host, via skill `run-local`
(comandos em `.claude/skills/run-local/SKILL.md`). É o mesmo modo que o [e2e](e2e.md) usa.

**Why:** o Docker foi removido do projeto. O gravador precisa de um navegador com janela no host e o
produto entregue é um CLI npm que roda na máquina do usuário — o container não isolava nada, só
exigia furos (CDP para `host.docker.internal`, `network_mode: host` no Linux, tradução de path para
os links `vscode://`). As duas dependências de máquina são Node 22+ e pnpm.

**How to apply:** seguir a skill `run-local` por completo (setup, comandos, troubleshooting). Se
encontrar referência a `docker compose`, `docker-compose.dev.yml` ou `ACUTIS_PROJECTS_HOST_PATH` em
algum documento, é resquício — não existe mais.

**Reinício depois de editar código:** nem todo processo aplica mudança sozinho — antes de investigar
"por que o comportamento não mudou" depois de editar algo, suspeitar primeiro de processo
desatualizado precisando reiniciar. Motivo real já visto: `pnpm dev` do backend (ver skill
`run-local`) não é watch mode, processo local ficou horas servindo código antigo sem erro nenhum.
