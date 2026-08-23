# Acutis

Aplicação Nuxt e Nitro na raiz, um processo só servindo interface, API, WebSocket, gravador e runner. O `e2e/` é o único pacote separado do workspace. O produto entregue é o CLI npm `@acutis/cli`.

## Como as instruções carregam

As regras do projeto vivem em `.claude/rules/`. Elas carregam sozinhas: as sem `paths` no frontmatter entram em toda sessão, as com `paths` entram quando eu leio um arquivo que casa com o glob. Não existe catálogo para consultar antes de agir.

Procedimento é skill (`run-local`, `run-e2e`, `publish`), fluxo de git é o subagente `commit`, e o que precisa ser garantido em vez de lembrado é hook (`.claude/hooks/`).
