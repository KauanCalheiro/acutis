---
name: e2e-backend
description: E2E que depende do backend — projetos de fixture copiados para um diretório temporário, um processo só na porta 4400, sem banco a semear
metadata:
  type: feedback
---

## Estado determinístico sem banco

O backend guarda tudo em disco (ver [backend-persistence](backend-persistence.md)), então o estado de um teste é **uma cópia dos projetos de fixture**, não um seed:

- `projectsCopy(url)` (`e2e/support/projects.ts`) copia `e2e/fixtures/projects/` para um diretório temporário e escreve o `.env` com a URL base de cada projeto.
- `isolatedProjects()` devolve uma raiz vazia só daquela execução — isolar a raiz isola junto o SQLite das configurações, que nasce em `<raiz>/runtime/database.sqlite`.
- Teste que mexe ou apaga cenário reseta a pasta do projeto no `beforeEach` (`projectReset`), para nenhum depender da ordem.

Nunca escrever direto em `e2e/fixtures/` durante a suíte: é pasta versionada.

## Um processo só, na porta do E2E

A API, o gravador e o runner vivem no mesmo processo, na porta 4400 (`e2e/support/ports.ts` é a fonte única). `startBackend(env)` e `startWebdriver(env)` sobem o mesmo binário e devolvem o `stop`, que espera o processo morrer e a porta liberar — sem isso a suíte seguinte conversa com o backend errado. Mesmo motivo do `workers: 1`: dois workers disputariam a porta; se doer no tempo, a saída é porta por spec, não voltar a vários workers.

As portas do E2E não colidem com as de desenvolvimento (3000/4000), então a suíte roda com a stack local de pé.

Testes rodam **headless** por default — não passar `headless: false` sem necessidade real.
