---
name: structure-frontend
description: Estrutura da aplicação Nuxt na raiz — app/pages/components e server Nitro
metadata:
  type: project
---

Nuxt 4, TypeScript, pnpm e Nuxt UI v4. A interface, API, WebSocket, recorder e runner usam a mesma origem.

```
acutis/
├── nuxt.config.ts
├── app/
│   ├── assets/
│   ├── layouts/
│   ├── pages/
│   └── components/
├── server/                 # handlers Nitro
├── core/                   # núcleo, recorder e runner
└── shared/contracts/       # schemas Zod
```

**Comandos:** `pnpm dev` (porta 3000) · `pnpm typecheck` · `pnpm lint`
