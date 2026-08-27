---
paths:
  - "app/**"
---

Ícones **da aplicação** usam **Google Material Icons** (`@iconify-json/ic`, prefixo `i-ic-*`). **SEMPRE a variante `round`** (filled + arredondado): `i-ic-round-<nome>` (ex.: `i-ic-round-swap-vert`). Nunca `baseline`/`sharp`. Variantes existentes: `baseline`, `round`, `outline`, `sharp`, `twotone`.

- Os **defaults internos do Nuxt UI ficam como vêm** (não sobrescrever `app.config` `ui.icons`), **com uma exceção: `loading`**, ver abaixo.
- `nuxt.config` → `icon.clientBundle.scan` embarca no bundle os ícones que o código usa. Sem isso o SSR do build publicado tenta buscar cada `ic:*` na rede e cospe `[Icon] failed to load icon` no terminal do CLI. Nome de ícone montado em runtime (template string, concatenação) escapa da varredura, então sempre literal. Literal que mora em `.ts` (`app/utils/origin.ts`, `app/composables/notify.ts`) também escapa: entra à mão em `icon.clientBundle.icons`, no formato `coleção:nome`.
- Achar nome exato: `node -e "Object.keys(require('@iconify-json/ic/icons.json').icons).filter(k=>k.includes('round')&&k.includes('TERMO'))"`.

Em uso hoje: `i-ic-round-search` (busca), `i-ic-round-filter-alt` (filtros), `i-ic-round-swap-vert` (ordenar), `i-ic-round-library-add-check` (item de sort selecionado).

## O carregando é um só na aplicação inteira

`line-md:loading-twotone-loop`, definido em `app/app.config.ts` → `ui.icons.loading`. Vale para todo componente do Nuxt UI com estado de carregando — botão, select, o que vier — e é o mesmo ícone que a timeline de execução usa no passo em andamento (`scenario/test-run/steps.vue`, `project/run-filtered/modal.vue`).

**Why:** o spinner que vinha por padrão no Nuxt UI era um terceiro desenho de "esperando", ao lado do que a timeline já usava. Uma espera, um ícone.

**How to apply:** não passar `loading-icon` por componente nem trocar o spinner numa tela só; se o carregando precisa mudar, muda no `app.config`. O E2E `spins the same loading icon the rest of the app uses` (`e2e/tests/settings.spec.ts`) trava isso — ele falha se a chave sair do `app.config`.
