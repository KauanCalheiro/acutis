---
name: frontend-table
description: Montar tabela/listagem/grid (UTable Nuxt UI) — columns só accessorKey, header/cell por slot, loading via pending, sort do backend
metadata:
  type: feedback
---

Padrão obrigatório para `UTable`:

- **`columns` só com `accessorKey`** — nada de `header`/`cell` no objeto da coluna. Exceção: coluna de display sem dado (ex.: ações) usa `{ id: "acoes" }` (ver [frontend-crud](frontend-crud.md)).
- **Header e cell via slot** da table: `#<accessorKey>-header` e `#<accessorKey>-cell`. Conteúdo do slot em **linha própria**. O slot de cell recebe `{ row }` → usar `row.original.<campo>`.
- **Loading** dentro da própria table: `:data="pending ? [] : data?.data"` + `:loading="pending"` + slot `#loading` com `<TableLoading />`. Zerar a data no `pending` é o que faz o `#loading` disparar (ele só aparece com a tabela vazia; o `useFetch` mantém os dados antigos no refetch). `TableLoading` (`components/table/loading.vue`) = spinner `line-md:loading-twotone-loop` centralizado.
- **Sort automático do TanStack desligado** — ordenação vem do backend (controle externo).
- **Empty state** no slot `#empty` com `<TableEmpty :title :description :icon />` (`components/table/empty.vue`), reutilizável; default genérico, sobrescreve o `title` por recurso.

Fetch/paginação/filtros da fonte de dados: ver [frontend-api](frontend-api.md).

```vue
<script setup lang="ts">
const columns: TableColumn<ICategoria>[] = [
    { accessorKey: "id" },
    { accessorKey: "descricao" },
];

const { data, pending } = await useFetch<IPaginated<ICategoria>>("/api/categorias", {
    query,
});
</script>

<template>
    <UTable
        :data="data?.data"
        :columns="columns"
        :loading="pending"
    >
        <template #id-header>
            Código
        </template>

        <template #descricao-cell="{ row }">
            {{ row.original.descricao }}
        </template>
    </UTable>
</template>
```
