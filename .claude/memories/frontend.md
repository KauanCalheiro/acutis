---
name: frontend
description: Frontend Nuxt — LER 1º ao criar/editar componente, página, tela, formulário; índice → props, style, table, icons, tdd (E2E em [[e2e]])
metadata:
  type: feedback
---

Índice do frontend (Nuxt 3/4, TypeScript, pnpm). Ler a sub-memória do assunto antes de mexer. Convenções universais de TDD em [[tdd]]; estrutura de pastas em [[structure]].

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [[frontend-naming]] | Nome de componente — variante em subpasta, nunca sufixo no arquivo (`tabela/mobile.vue`, não `tabelaMobile.vue`) |
| [[frontend-props]] | `defineProps` — destructure + default, interface nomeada por caminho (sem `withDefaults`) |
| [[frontend-style]] | Estilo — objetos/arrays sempre multi-linha (uma prop/item por linha) |
| [[frontend-labels]] | Texto de botão/ação — verbo no infinitivo, mesmo tom (Filtrar, Ordenar, Limpar) |
| [[frontend-responsive]] | Responsividade — paddings mobile-first, table overflow-x, ClientOnly em useDevice |
| [[frontend-table]] | UTable — columns só accessorKey, header/cell via slot, loading via pending |
| [[frontend-crud]] | CRUD — form modal criar/editar, BaseConfirm remoção, coluna de ações, rotas proxy |
| [[frontend-api]] | Chamar API — useFetch direto, handler 401/498 global, proxy Nitro, query bracket |
| [[frontend-icons]] | Ícones da app = Google Material Icons (`i-ic-round-*`); Nuxt UI mantém os dele |
