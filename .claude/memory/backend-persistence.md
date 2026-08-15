---
name: backend-persistence
description: Onde o backend guarda estado — o projeto é um diretório em disco (acutis.json, tests/, features/, environments/, runs/); o único banco é o SQLite das configurações
metadata:
  type: project
---

Ver [backend](backend.md). Não há ORM, migration nem model: **o repositório é o sistema de arquivos**.

## Um projeto é um diretório

A raiz sai de `ACUTIS_PROJECTS_PATH` (`common/utils/acutis.ts`). Um diretório vira projeto quando tem `acutis.json` — é isso que a listagem procura.

```
<raiz>/<slug>/
├── acutis.json          # o manifesto: name, slug, created_at, version
├── .env                 # valores locais + qual ambiente está ativo (não versionado)
├── .env.example         # só as chaves, versionado
├── environments/*.json  # um arquivo por ambiente, com os nomes e valores das variáveis
├── tests/<id>.spec.ts   # o cenário em Playwright (tests/auth.setup.ts é o login)
├── features/<id>.feature# o Gherkin do mesmo cenário
└── runs/                # o histórico de execução: passos, vídeo, commit
```

O id de um cenário é o caminho do spec sem `tests/` e sem extensão — pode ter uma barra (subpasta).

Quem lê e escreve cada peça é um provider (`Manifest`, `Dotenv`, `Environments`, `Scenario`, `TestArtifact`, `Runs`), nunca o service direto no `fs`.

## O único banco

`<raiz>/runtime/database.sqlite`, via `better-sqlite3`, com **duas tabelas de configuração**: `settings` e `ai_settings`. SQL direto no `settings/providers/database.ts` — sem ORM e sem framework de migration; mudança de esquema é uma função de migração ali mesmo (ver `migrateToSingleModel`).

- A chave de API do provedor vai cifrada em AES-256-GCM; a chave de cifra fica em `<raiz>/runtime/app-key`, gerada na primeira execução.
- Isolar a raiz de projetos isola o banco junto — é o que o teste e o E2E fazem, sem variável separada.

## Consequências

- Não existe transação: escrita que envolve dois arquivos precisa ser idempotente e tolerar meio caminho.
- Nada de estado em memória entre requisições — a verdade está em disco, e é relida.
- Projeto apagado é diretório removido; cenário apagado leva junto spec, feature e a gravação.
