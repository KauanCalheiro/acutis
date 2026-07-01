---
name: frontend-style
description: Formatar/escrever código frontend (TS/Vue) — objetos e arrays SEMPRE multi-linha, uma prop/item por linha
metadata:
  type: feedback
---

Sub-memória de [[frontend]].

**Sempre quebrar linha**: objetos e arrays ficam multi-linha, **uma propriedade/item por linha**, mesmo curtos. Nada de objeto inline `{ a: 1, b: 2 }`.

```ts
const item = {
    label: "Código (1-9)",
    onSelect: () => (sort.value = "id"),
};
```

**Why:** diffs limpos, fácil adicionar/remover linha, leitura vertical.
**How to apply:** nunca colapsar objeto/array em uma linha; cada prop/elemento na sua linha, com trailing comma.
