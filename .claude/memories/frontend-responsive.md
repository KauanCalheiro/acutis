---
name: frontend-responsive
description: Responsividade no frontend — paddings mobile-first, table com scroll horizontal, ClientOnly em componentes que usam useDevice
metadata:
  type: feedback
---

- **Mobile-first**: paddings/offsets crescem por breakpoint. Layout: sidebar só em `lg` (`lg:pl-35`, nada no mobile). Page: `px-4 sm:px-8 lg:px-16`, `py-6 lg:py-10`.
- **Tabela**: o root precisa de `overflow-x-auto` pra rolar na horizontal no mobile (o `app.config.ui.table.slots.root` sobrescreve o default — não esquecer o overflow).
- **Toolbar**: `flex flex-wrap` pros controles quebrarem em telas estreitas.
- **`useDevice` + SSR**: componentes que escolhem variante por `useDevice` (ex.: `components/modal/{desktop,mobile}.vue`, ver [frontend-naming](frontend-naming.md)) DEVEM ficar dentro de `<ClientOnly>` — senão o SSR escolhe uma variante e o client outra → **hydration mismatch**.
