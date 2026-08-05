---
name: frontend
description: Frontend Nuxt — LER 1º ao criar/editar componente, página, tela, formulário; índice → props, style, table, icons, tdd (E2E em e2e.md)
metadata:
  type: feedback
---

Índice do frontend (Nuxt 3/4, TypeScript, pnpm). Ler a sub-memória do assunto antes de mexer. Convenções universais de TDD em [tdd](tdd.md); estrutura de pastas em [structure-frontend](structure-frontend.md).

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [frontend-naming](frontend-naming.md) | Nome de componente — variante em subpasta, nunca sufixo no arquivo (`tabela/mobile.vue`, não `tabelaMobile.vue`) |
| [frontend-props](frontend-props.md) | `defineProps` — destructure + default, interface nomeada por caminho (sem `withDefaults`) |
| [frontend-style](frontend-style.md) | Estilo — objetos/arrays sempre multi-linha (uma prop/item por linha) |
| [frontend-feedback](frontend-feedback.md) | Retorno de interação — sucesso e erro vão para toast, nunca alert inline |
| [frontend-labels](frontend-labels.md) | Texto de botão/ação — verbo no infinitivo, mesmo tom (Filtrar, Ordenar, Limpar) |
| [frontend-responsive](frontend-responsive.md) | Responsividade — paddings mobile-first, table overflow-x, ClientOnly em useDevice |
| [frontend-table](frontend-table.md) | UTable — columns só accessorKey, header/cell via slot, loading via pending |
| [frontend-crud](frontend-crud.md) | CRUD — form modal criar/editar, BaseConfirm remoção, coluna de ações, rotas proxy |
| [frontend-api](frontend-api.md) | Chamar API — useFetch direto, handler 401/498 global, proxy Nitro, query bracket |
| [frontend-icons](frontend-icons.md) | Ícones da app = Google Material Icons (`i-ic-round-*`); Nuxt UI mantém os dele |
