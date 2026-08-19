---
name: structure
description: Onde fica cada coisa no projeto — índice da aplicação e do E2E
metadata:
  type: project
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

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [structure-webdriver](structure-webdriver.md) | Gravador e runner em `core/webdriver`; comandos pnpm |
| [structure-frontend](structure-frontend.md) | Pastas de `app/`, `server/`; comandos pnpm |
| [structure-e2e](structure-e2e.md) | Playwright cross-tool, comando pnpm |
