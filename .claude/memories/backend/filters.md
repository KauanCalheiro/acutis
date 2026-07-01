---
name: backend-filters
description: Endpoint de listagem (index) no backend — spatie QueryBuilder: busca, filtros filter[], sort, paginação JSON API page[]
metadata:
  type: feedback
---

Padrão obrigatório para `index` de qualquer controller. Ver [[backend-patterns]] para contexto do Controller.

## QueryBuilder — padrão index

```php
QueryBuilder::for(Model::class)
    ->allowedSorts('id', 'descricao', 'created_at', 'updated_at')
    ->allowedIncludes('relacao1', 'relacao2')
    ->allowedFilters(
        AllowedFilter::exact('id'),
        AllowedFilter::partial('descricao'),
        AllowedFilter::callback('search', function ($query, string $value): void {
            $query->where(function ($q) use ($value): void {
                $q->whereRaw('LOWER(descricao) LIKE LOWER(?)', ["%{$value}%"])
                    ->orWhereRaw('CAST(id AS TEXT) LIKE ?', ["%{$value}%"]);
            });
        }),
    )
    ->jsonPaginate();
```

- `AllowedFilter::exact` — match exato (id, flags, FK)
- `AllowedFilter::partial` — LIKE (descricao, nome, email)
- `AllowedFilter::callback('search', ...)` — busca unificada em múltiplos campos; sempre incluir `id` como fallback numérico

## Paginação

Parâmetros: `page[number]` e `page[size]` (JSON API spec).
Resposta inclui `data`, `links` e `meta` com `current_page`, `last_page`, `total`.

## PostgreSQL

Em produção o banco é PostgreSQL — usar `LOWER()`/`ILIKE` nas queries de busca. SQLite (testes) aceita `LOWER()` mas não `ILIKE`.
