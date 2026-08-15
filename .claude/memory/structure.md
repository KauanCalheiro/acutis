---
name: structure
description: Onde fica cada coisa no monorepo — índice por subprojeto; ler ao procurar arquivo/pasta (→ backend, frontend, e2e)
metadata:
  type: project
---

Monorepo com três subprojetos independentes. Comandos rodam num dos dois modos de execução — ver [execution](execution.md).

```
acutis/
├── CLAUDE.md
├── README.md
├── backend/                # NestJS + Playwright — a API em src/modules, o gravador em src/webdriver
├── frontend/               # Nuxt 4 + Nuxt UI 4 / TypeScript / pnpm
└── e2e/                    # Playwright cross-tool (frontend + backend reais)
```

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [structure-webdriver](structure-webdriver.md) | O backend inteiro: `src/common`, `src/modules`, `src/webdriver`; comandos pnpm |
| [structure-frontend](structure-frontend.md) | Pastas de `app/`, `server/`; comandos pnpm |
| [structure-e2e](structure-e2e.md) | Playwright cross-tool, comando pnpm |
