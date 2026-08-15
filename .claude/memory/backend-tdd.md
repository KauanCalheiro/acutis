---
name: backend-tdd
description: Testar backend Laravel — escrever feature test Pest ANTES do código em backend-laravel/app; SQLite in-memory, CRUD V1
metadata:
  type: feedback
---

Especificações de stack para TDD no backend. Convenções universais em [tdd](tdd.md).

## Setup

- Framework: Pest v4
- DB de teste: SQLite `:memory:` (configurado em `phpunit.xml`)
- Rodar: `php artisan test --compact --filter={Name}Test`
- Criar: `php artisan make:test --pest V1/{Name}Test` → `tests/Feature/V1/`

## Cobertura obrigatória por CRUD

| Cenário | O que verificar |
|---------|----------------|
| `index` paginado | `assertJsonStructure(['data','links','meta'])` + count |
| `index` paginação | `page[size]` e `page[number]`, `meta.current_page` |
| `index` filtro | filtro por campo retorna só o registro correto |
| `index` search | busca case-insensitive retorna o certo |
| `show` | campos corretos no body |
| `show` not found | 404 |
| `store` success | 201 + `assertDatabaseHas` |
| `store` defaults | flags boolean com valor default correto |
| `store` validação | 422 + `assertJsonValidationErrors` |
| `update` success | 200 + `assertDatabaseHas` |
| `update` validação | 422 |
| `update` not found | 404 |
| `destroy` | 204 + `assertSoftDeleted` |
| `destroy` not found | 404 |

## Helpers Pest/Laravel

```php
use function Pest\Laravel\{getJson, postJson, putJson, deleteJson};

it('description', function () {
    Model::factory()->create([...]);
    getJson('/api/v1/recurso')->assertOk()->assertJsonPath('field', value);
});
```

## Gotchas

- Route model binding com plurais PT-BR singulariza errado — se o teste retorna 404 inesperado, verificar se a rota tem `->parameters([...])` correto (ver [backend-action](backend-action.md))
- `assertSoftDeleted` verifica `deleted_at` não-nulo, não ausência da linha
