---
name: frontend-naming
description: Nomear componente Vue — variante vira subpasta, nunca sufixo no nome do arquivo (tabela/mobile.vue, não tabelaMobile.vue)
metadata:
  type: feedback
---

Sub-memória de [[frontend]].

**Variante/contexto de um componente = subpasta, não sufixo no arquivo.**

- ❌ `categoria/tabelaMobile.vue`, `categoria/tabelaDesktop.vue`
- ✅ `categoria/tabela/mobile.vue`, `categoria/tabela/desktop.vue`

**Why:** agrupa as variantes do mesmo conceito numa pasta, evita poluir o diretório pai com nomes compostos. Nuxt gera o mesmo nome auto-import (`categoria/tabela/mobile.vue` → `CategoriaTabelaMobile`), então o uso no template não muda.

**How to apply:** ao criar 2ª variante (mobile/desktop, abrir/fechar, etc.) ou quando o nome do arquivo ganharia sufixo composto → criar pasta com o conceito e arquivos curtos dentro. Já seguido por `components/modal/{desktop,mobile}.vue` e `components/navbar/{desktop,mobile}.vue`.
