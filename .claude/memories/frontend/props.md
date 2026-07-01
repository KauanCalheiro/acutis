---
name: frontend-props
description: Declarar props de componente Vue/Nuxt (defineProps) — destructure com default + interface nomeada pelo caminho, NUNCA withDefaults
metadata:
  type: feedback
---

Componentes Vue (Nuxt) declaram props com **destructure + default** (Vue 3.5 reactive props destructure), NÃO `withDefaults`.

A interface tem nome = caminho do componente em PascalCase (`PastaSubpastaComponente`).
Ex.: `components/base/Title.vue` → `BaseTitle`; `components/categoria/filtro/modal.vue` → `CategoriaFiltroModal`.

```ts
interface BaseTitle {
    level?: Level
}

const {
    level = 1,
} = defineProps<BaseTitle>()
```

**Why:** legível, default colado na prop, sem boilerplate do `withDefaults`.
**How to apply:** nunca usar `withDefaults`; sempre interface nomeada pelo caminho + destructure com defaults inline.
