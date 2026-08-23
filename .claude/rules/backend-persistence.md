---
paths:
  - "server/**"
  - "core/modules/**"
  - "core/use-cases/**"
  - "core/common/**"
  - "core/config/**"
  - "shared/**"
---

Ver [backend](backend.md). **O repositório é o sistema de arquivos**: projeto, cenário, ambiente e histórico são arquivos. O banco existe só para as configurações do próprio acutis.

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

`<raiz>/runtime/database.sqlite`, TypeORM sobre `better-sqlite3`, com **duas tabelas de configuração**: `settings` (uma linha por chave global) e `ai_settings` (uma linha por provedor de IA).

- Entidades em `settings/entities/` (`Setting`, `AiCredential`); o `SettingsService` fala com elas por repositório, o que torna assíncrono todo método que lê ou grava.
- As opções da conexão saem de `config/database.ts`, montadas por função — o caminho é lido na hora, não no import, porque a raiz muda por execução.
- A chave de API do provedor vai cifrada em AES-256-GCM (`settings/providers/crypto.ts`); a chave de cifra fica em `<raiz>/runtime/app-key`, gerada na primeira execução e **fora** do banco.
- Isolar a raiz de projetos isola o banco junto — é o que o teste e o E2E fazem, sem variável separada.

## Migrations

Uma migration por tabela, em `src/migrations/`, escritas com a API do TypeORM (`runner.createTable(new Table(...))`) e listadas à mão em `config/database.ts` — não por glob, que não sobrevive ao empacotamento do `dist/`.

- `migrationsRun: true`: o boot aplica o que faltar. O acutis roda na máquina de quem usa, que nunca vai rodar um comando de migration.
- Mudança de esquema é **migration nova**, nunca edição de uma já aplicada nem `synchronize`.
- Em desenvolvimento não há base para migrar: `pnpm db:fresh` apaga o banco e o refaz pelas migrations (respeita `ACUTIS_PROJECTS_PATH`, não toca no `app-key`).
- Nada de código de compatibilidade com esquema antigo enquanto o produto não tiver instalação de verdade.

## Consequências

- Não existe transação no que é arquivo: escrita que envolve dois deles precisa ser idempotente e tolerar meio caminho.
- Nada de estado em memória entre requisições — a verdade está em disco, e é relida.
- Projeto apagado é diretório removido; cenário apagado leva junto spec, feature e a gravação.
