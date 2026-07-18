---
name: execution
description: Índice de modos de execução — Docker ou local, LER antes de subir/rodar qualquer serviço (→ docker, local)
metadata:
  type: feedback
---

Dois jeitos de rodar a stack (backend, frontend, webdriver) — cada um com setup, portas e comandos próprios.

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [docker](docker.md) | Ambiente isolado via `docker compose`, não precisa de PHP/Node/Composer/pnpm no host |
| [local](local.md) | Serviços direto no host, precisa de PHP/Node/Composer/pnpm instalados — modo que o [e2e](e2e.md) sempre usa |

**Why:** os dois modos são válidos, mas não são intercambiáveis por serviço — misturar container Docker de um serviço com processo local do mesmo serviço no mesmo host causa conflito de porta/estado.

**How to apply:** escolher um modo e seguir a memória correspondente por completo (setup, comandos, troubleshooting) — não misturar instruções dos dois pro mesmo serviço numa mesma sessão de trabalho.
