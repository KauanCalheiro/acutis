---
name: structure-frontend
description: Estrutura de pastas do frontend Nuxt — app/pages/components, server (Nitro); comandos pnpm
metadata:
  type: project
---

Nuxt 4, TypeScript, pnpm. Nuxt UI v4. `/record` conecta direto no gateway WS do webdriver (`ws://localhost:4000/ws`).

```
frontend/
├── nuxt.config.ts
├── app/
│   ├── assets/
│   ├── layouts/
│   ├── pages/              # record.vue: eventos ao vivo + player do vídeo
│   └── components/
└── server/                 # Nitro (proxy / SSE)
```

**Comandos:** `pnpm dev` (porta 3000) · `pnpm typecheck` · `pnpm lint`
