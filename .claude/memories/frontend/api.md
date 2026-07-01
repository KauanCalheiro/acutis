---
name: frontend-api
description: Chamar a API no frontend Nuxt — useFetch direto, handler 401/498 global no plugin, proxy Nitro server/api → backend /api/v1
metadata:
  type: feedback
---

Sub-memória de [[frontend]].

- **`useFetch` direto**, sem `$fetch` custom por chamada. O handler de **401/498 é global** (plugin `app/plugins/api.ts` faz `globalThis.$fetch = $fetch.create({ onResponseError })`, client-only → limpa sessão + vai pra `/login`).
- Fluxo: componente chama `/api/<recurso>` (rota Nitro em `server/api/`) → o proxy usa `useApiClient(event).protocolo()` → backend `/api/v1/<recurso>`.
- Query com **chaves bracket** (ofetch não faz nesting): `filter[search]`, `filter[id]`, `sort`, `page[number]`, `page[size]` — incluir só se preenchido.
