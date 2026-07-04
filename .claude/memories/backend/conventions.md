---
name: backend-conventions
description: Escrever/formatar PHP no backend Laravel — Pint, wrapping, estrutura de pastas, restrições
metadata:
  type: feedback
---

Convenções que se aplicam a qualquer mudança no `backend/`. Ver [[backend]] para o fluxo de criação.

## Formatação

Rodar após qualquer mudança em arquivo PHP:
```
vendor/bin/pint --dirty --format agent
```

## Responses

- **Toda resposta de controller retorna um Resource** (`app/Http/Resources/V1/{X}Resource`) — nunca `response()->json($data)` cru, nem devolver um objeto Spatie Data direto. Vale também pros endpoints de IA (geração de teste, auth setup): o retorno da Action é embrulhado num Resource. Resources aninham (`ProjectResource::make(...)` dentro de outro) e reusam parciais (`TestRunResource`). Campo opcional: `$this->x ? XResource::make($this->x) : null`.
- `JsonResource::withoutWrapping()` ativo globalmente — respostas sem `data` wrapper, exceto paginação (que usa `data` + `links` + `meta`)
- `store` retorna status 201; `destroy` retorna 204 (`response()->noContent()`)

## Config

- Config aninhada em `config/acutis.php` (ex.: `acutis.projects.path`)
- Acesso **sempre** via resolver tipado `acutis()` (helper global → `App\Support\AcutisConfig`), nunca `config('acutis...')` cru: `acutis()->projectsPath`
- `AcutisConfig::resolve()` lê a config a cada chamada (respeita override em testes)

## Enums

- Valores de domínio com conjunto fechado = enum PHP em `app/Enums/` (ex.: `GitProvider: github|gitlab`)
- Spatie Data suporta enums nativamente (`EnumCast` na entrada, `EnumTransformer` → `->value` na saída)
- Em Resource, expor `$this->campo?->value`

## Estrutura de pastas

```
app/Http/Controllers/V1/   ← controllers da v1
app/Http/Resources/V1/     ← resources da v1
app/Data/V1/{Resource}/    ← Spatie Data (DTOs) por recurso
app/Action/                ← lógica de negócio (AsAction) → [[backend-patterns]]
app/Enums/                 ← enums de domínio
app/Support/               ← helpers/resolvers (AcutisConfig, Git)
tests/Feature/V1/          ← testes de feature da v1
routes/api/v1.php          ← rotas da v1
```

Não criar pastas base novas sem aprovação.

## Referências

- `backend/CLAUDE.md` — Boost guidelines completas
- [[backend-patterns]] — detalhe de cada camada
- [[backend-filters]] — QueryBuilder e paginação
- [[tdd-backend]] — ciclo TDD
- [[commit]] — convenção de commits
