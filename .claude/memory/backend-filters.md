---
name: backend-filters
description: Endpoint de listagem (index) — filter[campo], search, sort e paginação page[size]/page[number] no formato que o frontend já lê
metadata:
  type: feedback
---

Padrão do `index` de qualquer controller. Contexto do controller em [backend-module](backend-module.md).

## Parâmetros

Chegam no formato JSON:API, que é o que o frontend manda:

| Query | Efeito |
|-------|--------|
| `filter[campo]=x` | match parcial, case-insensitive, no campo |
| `search=x` | busca unificada nos campos que identificam o recurso |
| `sort=campo` / `sort=-campo` | ordena; `-` inverte |
| `page[size]` + `page[number]` | fatia a lista; sem `page[size]`, devolve tudo |

O controller só converte o que vem como texto (`Number(params.page?.size)`) e repassa uma `ListQuery` ao service.

## Service

Não há ORM: a listagem carrega os itens (diretórios de projeto, arquivos de cenário), filtra, ordena e fatia em memória, nessa ordem.

```ts
const total = projects.length
const size = query.page?.size ?? total
const number = query.page?.number ?? 1
const data = query.page?.size ? projects.slice((number - 1) * size, number * size) : projects

return { data, meta: { current_page: number, per_page: size, total } }
```

- Campo de ordenação fora da lista permitida (`SORTABLE`) cai no default, nunca estoura.
- Busca sempre case-insensitive (`toLowerCase().includes(...)`).
- A resposta é `{ data, meta }` com `current_page`, `per_page` e `total` — é o que a tabela do frontend lê.
