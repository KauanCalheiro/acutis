---
name: e2e-setup
description: Setup de teste E2E no frontend — esperar hidratação antes de interagir, selecionar sempre por data-testid
metadata:
  type: feedback
---

Sub-memória de [[e2e]].

## Hidratação

O HTML do SSR do Nuxt chega "parecendo" interativo antes do Vue hidratar no cliente — clicar cedo demais não faz nada (o listener ainda não existe), mas não dá erro. Toda página precisa expor um marcador de hidratação pronta, e o teste espera esse marcador antes do primeiro clique/preenchimento:

```vue
<script setup>
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
</script>

<template>
  <div :data-hydrated="hydrated"> ... </div>
</template>
```

```ts
await page.locator('[data-hydrated="true"]').waitFor()
```

## Seletores

Sempre `page.getByTestId(...)`, nunca CSS/texto solto — todo elemento interativo já tem `data-testid` no padrão `<recurso>-<acao>` (ver regra `data-testid.md`).
