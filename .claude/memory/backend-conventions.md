---
name: backend-conventions
description: Escrever/formatar PHP no backend Laravel — Pint, helpers blank/filled, Support fluente, wrapping, estrutura de pastas, restrições
metadata:
  type: feedback
---

Convenções para qualquer mudança em `backend/`. Ver [backend](backend.md).

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

## Helpers do Laravel em vez de teste manual

Checagem de vazio/preenchido **sempre** pelos helpers globais do Laravel — `blank()`, `filled()` — nunca `empty()`, `is_null()`, `=== null`, `!== ''`.

```php
if (filled($spec)) { ... }
if (blank($this->remoteUrl())) { ... }
```

**Why:** um único critério de "vazio" pra string, array, Collection e null — `empty('0')` e `=== null` divergem justamente nos casos de borda. Vale pra qualquer helper do framework: se o Laravel já tem, usar o dele em vez de reimplementar (`Str::`, `Arr::`, `collect()`, `data_get()`).

## Classes de Support com API fluente

Classe de `app/Support/` que executa ações (não só consulta) é instanciada por um named constructor e **cada método de ação retorna `self`**, pra encadear:

```php
Git::in($path)->commit($message, $files)->push();
```

- Named constructor estático (`Git::in($path)`) guarda o contexto no construtor privado
- Métodos de ação (`commit`, `push`) → `return $this`
- Métodos de consulta (`branch`, `remoteUrl`, `author`) → retornam o valor
- Nunca método estático recebendo o mesmo contexto de novo em cada chamada (`Git::commit($path, ...)`)

**Why:** o contexto (path, conexão, etc.) é dito uma vez só, a leitura fica em ordem de execução e cada passo continua isolado e testável.

## Estrutura de pastas

```
app/Http/Controllers/V1/   ← controllers da v1
app/Http/Resources/V1/     ← resources da v1
app/Data/V1/{Resource}/    ← Spatie Data (DTOs) por recurso
app/Action/                ← lógica de negócio (AsAction) → [backend-action](backend-action.md)
app/Enums/                 ← enums de domínio
app/Support/               ← helpers/resolvers (AcutisConfig, Git)
tests/Feature/V1/          ← testes de feature da v1
routes/api/v1.php          ← rotas da v1
```

Não criar pastas base novas sem aprovação.

Guidelines completas do Boost em `backend/CLAUDE.md`. Nunca comentar código — ver [comments](comments.md).
