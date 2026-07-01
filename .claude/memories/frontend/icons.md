---
name: frontend-icons
description: Escolher/usar ícone na app (icon=, UIcon, name=) — SEMPRE i-ic-round-* (Google Material round); Nuxt UI mantém os dele
metadata:
  type: feedback
---

Sub-memória de [[frontend]].

Ícones **da aplicação** usam **Google Material Icons** (`@iconify-json/ic`, prefixo `i-ic-*`). **SEMPRE a variante `round`** (filled + arredondado): `i-ic-round-<nome>` (ex.: `i-ic-round-swap-vert`). Nunca `baseline`/`sharp`. Variantes existentes: `baseline`, `round`, `outline`, `sharp`, `twotone`.

- Os **defaults internos do Nuxt UI ficam como vêm** (não sobrescrever `app.config` `ui.icons`).
- Coleção registrada em `nuxt.config` → `icon.serverBundle.collections` (inclui `ic`).
- Achar nome exato: `node -e "Object.keys(require('@iconify-json/ic/icons.json').icons).filter(k=>k.includes('round')&&k.includes('TERMO'))"`.

Em uso hoje: `i-ic-round-search` (busca), `i-ic-round-filter-alt` (filtros), `i-ic-round-swap-vert` (ordenar), `i-ic-round-library-add-check` (item de sort selecionado).
