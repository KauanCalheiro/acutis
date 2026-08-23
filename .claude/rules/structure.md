---
paths:
  - "app/**"
  - "server/**"
  - "core/**"
  - "shared/**"
  - "e2e/**"
---

A aplicação Nuxt e Nitro vive na raiz. O E2E é o único pacote separado do workspace.

```
acutis/
├── CLAUDE.md
├── README.md
├── app/                    # interface Nuxt
├── server/                 # handlers Nitro
├── core/                   # casos de uso, serviços, recorder e runner
├── shared/contracts/       # contratos Zod internos
└── e2e/                    # Playwright contra a aplicação real
```

