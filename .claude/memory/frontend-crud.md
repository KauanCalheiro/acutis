---
name: frontend-crud
description: CRUD de recurso no frontend — form modal criar/editar, confirm modal de remoção, coluna de ações, rotas proxy
metadata:
  type: feedback
---

Padrão para criar/editar/remover um recurso na listagem:

- **Form modal (criar + editar no mesmo)**: `components/<recurso>/form/modal.vue` → `<RecursoFormModal>`. `v-model:open`, prop `<recurso>?` (preenche = editar, null = criar), emit `saved`. Decide POST (`/api/<recurso>`) vs PUT (`/api/<recurso>/:id`) por `isEdit`. Botões `Salvar`/`Cancelar`.
- **Confirm/remoção reutilizável**: `<BaseConfirm>` (`components/base/confirm.vue`) — `v-model:open`, props `title/description/confirmLabel/confirmColor/loading`, emit `confirm`. Para remover: `confirm-color="error"`, `confirm-label="Remover"`.
- **Coluna de ações**: primeira coluna, `{ id: "acoes" }` (sem `accessorKey` — display). Slot `#acoes-cell="{ row }"` com um `UDropdownMenu` (trigger `i-ic-round-more-vert`, `data-testid="<recurso>-acoes"`) cujos itens são Editar (`i-ic-round-edit`) e Remover (`i-ic-round-delete`, `color: "error"`). `data-testid` dos itens via slot `#item-label` (`<recurso>-editar`, `<recurso>-remover`). Nos testes: abrir o menu da linha (`row → <recurso>-acoes`) e então clicar o item (no portal, nível page).
- **Botão criar** na toolbar: `i-ic-round-add`, label `Criar <recurso>`, `data-testid="<recurso>-criar"`.
- **Após salvar/remover**: `refresh()` do `useFetch`.
- **Rotas proxy** (Nitro): `server/api/<recurso>/index.post.ts`, `[id].put.ts`, `[id].delete.ts` — cada uma `useApiClient(event).protocolo()` → backend `/api/v1/<recurso>`.

Mutações via UI → testes E2E com tag `@write` (ver [e2e-tags](e2e-tags.md)).
