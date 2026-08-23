---
paths:
  - "app/**"
---

Regra de comentários em [comments](comments.md).

**Sempre quebrar linha**: objetos e arrays ficam multi-linha, **uma propriedade/item por linha**, mesmo curtos. Nada de objeto inline `{ a: 1, b: 2 }`.

```ts
const item = {
    label: "Código (1-9)",
    onSelect: () => (sort.value = "id"),
};
```

**Why:** diffs limpos, fácil adicionar/remover linha, leitura vertical.
**How to apply:** nunca colapsar objeto/array em uma linha; cada prop/elemento na sua linha, com trailing comma.

## Tamanho de componente — sempre o default global

**NUNCA passar `size` em componente Nuxt UI** (UButton, UInput, UBadge, USelect etc.) a menos que o usuário peça explicitamente o contrário. Os tamanhos padrão vivem em `app/app.config.ts` (`defaultVariants`) e valem pro app inteiro.

**Why:** consistência visual sem override espalhado; mudar o padrão num lugar só. Já aconteceu de `size="lg"`/`size="sm"` hardcoded divergirem do padrão e precisarem ser removidos depois.

**How to apply:** ao criar/editar componente, não declarar `size`; se um tamanho diferente parecer necessário, perguntar ou deixar o default. Ajuste de padrão = mudar o `app.config.ts`, não o componente.
