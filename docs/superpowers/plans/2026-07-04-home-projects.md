# Home de Projetos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a home starter do Nuxt pela listagem de projetos com busca server-side, grid de cards e paginação, consumindo `GET /api/v1/projects` via proxy Nitro.

**Architecture:** Página `index.vue` chama `/api/projects` (rota Nitro) com `useFetch`; a rota repassa `search`/`page[number]`/`page[size]` ao backend Laravel (`runtimeConfig.apiUrl`). Card é componente `project/card`. Testes de componente com @nuxt/test-utils + Vitest; E2E full-stack com Playwright apontando o backend pra um diretório de fixtures.

**Tech Stack:** Nuxt 4 + Nuxt UI v4, @nuxt/test-utils + Vitest + happy-dom, Playwright (pasta `e2e/`), Laravel 12 (backend já pronto — não mexer).

## Global Constraints

- Branch `feat/home-projects` já existe — NUNCA commitar na `main`.
- Commits: semânticos, uma linha ≤72 chars, inglês, SEM `Co-Authored-By`.
- Comandos do frontend rodam via Docker: `docker compose -f docker-compose.dev.yml exec frontend <cmd>` (exceção: `e2e/` roda no host).
- Frontend: indent 2 espaços, ESLint `commaDangle: 'never'`; pasta `e2e/`: indent 4 espaços.
- Todo elemento interativo tem `data-testid` padrão `<recurso>-<acao>` (ex.: `projeto-busca`).
- Ícones da app: `i-ic-round-*` (Google Material round). Badge de provider git: `i-simple-icons-*`.
- Labels de botão: verbo no infinitivo ("Adicionar").
- Props Vue: destructure + default, interface nomeada pelo caminho do componente, NUNCA `withDefaults`.
- Objetos/arrays multi-linha, um item por linha.
- TDD: teste antes do código. NUNCA apagar/desabilitar teste.
- NÃO commitar `frontend/app/app.config.ts` (mudança pré-existente do usuário) — sempre `git add` com paths explícitos.

---

### Task 1: Infra de testes Nuxt + componente `project/card` (TDD)

**Files:**
- Modify: `frontend/package.json` (devDeps + script `test`)
- Create: `frontend/vitest.config.ts`
- Create: `frontend/app/types/project.ts`
- Create: `frontend/tests/components/project/card.spec.ts`
- Create: `frontend/app/components/project/card.vue`

**Interfaces:**
- Produces: tipo `Project` (`~/types/project`): `{ name: string; slug: string; path: string; repository: string | null; provider: 'github' | 'gitlab' | null; created_at: string | null }`
- Produces: componente auto-importado `ProjectCard` com prop `project: Project`; root do card tem `data-testid="projeto-card"`.

- [ ] **Step 1: Instalar dependências de teste**

```bash
docker compose -f docker-compose.dev.yml exec frontend pnpm add -D @nuxt/test-utils vitest @vue/test-utils happy-dom
```

- [ ] **Step 2: Criar `frontend/vitest.config.ts` e script `test`**

```ts
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt'
  }
})
```

Em `frontend/package.json`, adicionar em `scripts`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Criar o tipo `frontend/app/types/project.ts`**

```ts
export interface Project {
  name: string
  slug: string
  path: string
  repository: string | null
  provider: 'github' | 'gitlab' | null
  created_at: string | null
}
```

- [ ] **Step 4: Escrever o teste que falha — `frontend/tests/components/project/card.spec.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ProjectCard from '~/components/project/card.vue'
import type { Project } from '~/types/project'

const project: Project = {
  name: 'Alpha Store',
  slug: 'alpha-store',
  path: '/home/user/.acutis/alpha-store',
  repository: 'git@github.com:acme/alpha-store.git',
  provider: 'github',
  created_at: '2026-01-01T00:00:00+00:00'
}

describe('ProjectCard', () => {
  it('renders name, repository and provider badge', async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: {
        project
      }
    })

    expect(wrapper.text()).toContain('Alpha Store')
    expect(wrapper.text()).toContain('git@github.com:acme/alpha-store.git')
    expect(wrapper.text()).toContain('GitHub')
  })

  it('falls back to path when repository is null', async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: {
        project: {
          ...project,
          repository: null,
          provider: null
        }
      }
    })

    expect(wrapper.text()).toContain('/home/user/.acutis/alpha-store')
  })

  it('omits provider badge when provider is null', async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: {
        project: {
          ...project,
          provider: null
        }
      }
    })

    expect(wrapper.text()).not.toContain('GitHub')
  })
})
```

- [ ] **Step 5: Rodar e ver falhar**

```bash
docker compose -f docker-compose.dev.yml exec frontend pnpm test
```

Expected: FAIL (não resolve `~/components/project/card.vue`).

- [ ] **Step 6: Implementar `frontend/app/components/project/card.vue`**

```vue
<script setup lang="ts">
import type { Project } from '~/types/project'

interface ProjectCard {
  project: Project
}

const { project } = defineProps<ProjectCard>()

const providers = {
  github: {
    label: 'GitHub',
    icon: 'i-simple-icons-github'
  },
  gitlab: {
    label: 'GitLab',
    icon: 'i-simple-icons-gitlab'
  }
} as const

const provider = computed(() => (project.provider ? providers[project.provider] : null))
</script>

<template>
  <UCard data-testid="projeto-card">
    <div class="flex flex-col gap-2">
      <p class="font-semibold truncate">{{ project.name }}</p>
      <p class="text-sm text-muted truncate">{{ project.repository ?? project.path }}</p>
      <UBadge
        v-if="provider"
        color="neutral"
        variant="outline"
        :icon="provider.icon"
        :label="provider.label"
        class="self-start"
      />
    </div>
  </UCard>
</template>
```

- [ ] **Step 7: Rodar e ver passar**

```bash
docker compose -f docker-compose.dev.yml exec frontend pnpm test
```

Expected: 3 passed.

- [ ] **Step 8: Lint e commits**

```bash
docker compose -f docker-compose.dev.yml exec frontend pnpm lint --fix
git add frontend/package.json frontend/pnpm-lock.yaml frontend/vitest.config.ts
git commit -m "chore: add vitest with nuxt test utils"
git add frontend/app/types/project.ts frontend/app/components/project/card.vue frontend/tests/components/project/card.spec.ts
git commit -m "feat: add project card component"
```

---

### Task 2: Proxy Nitro `/api/projects` + `runtimeConfig.apiUrl`

**Files:**
- Create: `frontend/server/api/projects.get.ts`
- Modify: `frontend/nuxt.config.ts` (runtimeConfig `apiUrl`)
- Modify: `docker-compose.dev.yml` (env `NUXT_API_URL` no serviço frontend)

**Interfaces:**
- Consumes: backend `GET /api/v1/projects?search=&page[number]=&page[size]=` (já existe).
- Produces: rota `GET /api/projects` que devolve o JSON paginado do Laravel como veio: `{ data: Project[], links: {...}, meta: { current_page, per_page, total, ... } }`.

Sem teste unitário próprio — coberto pelo E2E da Task 4 (rota é repasse puro).

- [ ] **Step 1: Criar `frontend/server/api/projects.get.ts`**

```ts
export default defineEventHandler((event) => {
  const { apiUrl } = useRuntimeConfig(event)

  return $fetch('/api/v1/projects', {
    baseURL: apiUrl,
    query: getQuery(event)
  })
})
```

(`getQuery` preserva as chaves bracket `page[number]`/`page[size]` literais, como o backend espera.)

- [ ] **Step 2: Adicionar `apiUrl` no `frontend/nuxt.config.ts`**

Dentro de `runtimeConfig`, no nível server-side (fora de `public`):

```ts
runtimeConfig: {
  apiUrl: 'http://localhost:8000',
  public: {
    webdriverUrl: 'http://localhost:4000'
  }
},
```

- [ ] **Step 3: Apontar o container pro backend — `docker-compose.dev.yml`**

No serviço `frontend`, em `environment`, adicionar:

```yaml
      NUXT_API_URL: http://backend:8000
```

- [ ] **Step 4: Verificar o proxy na stack de dev**

```bash
docker compose -f docker-compose.dev.yml up -d frontend
curl -s 'http://localhost:23000/api/projects?page[size]=2' | head -c 300
```

Expected: JSON com `"data":[...]` e `"meta"` (lista vazia `data: []` também é sucesso se não houver projetos em `~/.acutis`).

- [ ] **Step 5: Commit**

```bash
git add frontend/server/api/projects.get.ts frontend/nuxt.config.ts docker-compose.dev.yml
git commit -m "feat: proxy projects listing through nitro"
```

---

### Task 3: Página home com busca, grid e paginação (TDD)

**Files:**
- Create: `frontend/tests/pages/index.spec.ts`
- Modify: `frontend/app/pages/index.vue` (substituir todo o conteúdo starter)
- Modify: `frontend/nuxt.config.ts` (remover `routeRules` de prerender da `/`)
- Modify: `frontend/package.json` (dependency `@iconify-json/ic`)

**Interfaces:**
- Consumes: `ProjectCard` (Task 1), rota `/api/projects` (Task 2).
- Produces: home com `data-testid`: `projeto-busca`, `projeto-adicionar`, `projeto-card` (nos cards), `projeto-vazio`, `projeto-paginacao`; marcador `data-hydrated="true"` no root após mount.

- [ ] **Step 1: Instalar coleção de ícones Material**

```bash
docker compose -f docker-compose.dev.yml exec frontend pnpm add @iconify-json/ic
```

- [ ] **Step 2: Escrever o teste que falha — `frontend/tests/pages/index.spec.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import IndexPage from '~/pages/index.vue'
import type { Project } from '~/types/project'

const projects: Project[] = [
  {
    name: 'Alpha Store',
    slug: 'alpha-store',
    path: '/home/user/.acutis/alpha-store',
    repository: 'git@github.com:acme/alpha-store.git',
    provider: 'github',
    created_at: '2026-01-01T00:00:00+00:00'
  },
  {
    name: 'Beta Blog',
    slug: 'beta-blog',
    path: '/home/user/.acutis/beta-blog',
    repository: null,
    provider: null,
    created_at: '2026-01-02T00:00:00+00:00'
  }
]

let response: { data: Project[], meta: { current_page: number, per_page: number, total: number } } = {
  data: projects,
  meta: {
    current_page: 1,
    per_page: 6,
    total: 2
  }
}

registerEndpoint('/api/projects', () => response)

describe('IndexPage', () => {
  it('renders a card per project from the API', async () => {
    response = {
      data: projects,
      meta: {
        current_page: 1,
        per_page: 6,
        total: 2
      }
    }

    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.findAll('[data-testid="projeto-card"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Alpha Store')
    expect(wrapper.text()).toContain('Beta Blog')
    expect(wrapper.text()).toContain('Acesse seus projetos')
  })

  it('shows the empty state when the API returns no projects', async () => {
    response = {
      data: [],
      meta: {
        current_page: 1,
        per_page: 6,
        total: 0
      }
    }

    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.find('[data-testid="projeto-vazio"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="projeto-card"]')).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
docker compose -f docker-compose.dev.yml exec frontend pnpm test
```

Expected: FAIL nos 2 testes de `IndexPage` (a página starter não tem `projeto-card` nem `projeto-vazio`). Os 3 de `ProjectCard` seguem passando.

- [ ] **Step 4: Reescrever `frontend/app/pages/index.vue`**

Substituir TODO o conteúdo por:

```vue
<script setup lang="ts">
import type { Project } from '~/types/project'

interface ProjectsResponse {
  data: Project[]
  meta: {
    current_page: number
    per_page: number
    total: number
  }
}

const PAGE_SIZE = 6

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})

const search = ref('')
const debouncedSearch = ref('')
const page = ref(1)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = value
    page.value = 1
  }, 300)
})

const query = computed(() => ({
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  'page[number]': page.value,
  'page[size]': PAGE_SIZE
}))

const { data, status } = await useFetch<ProjectsResponse>('/api/projects', {
  query
})

const projects = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.total ?? 0)
</script>

<template>
  <UContainer
    :data-hydrated="hydrated"
    class="py-6 lg:py-10"
  >
    <div class="flex flex-wrap items-center gap-4">
      <UInput
        v-model="search"
        data-testid="projeto-busca"
        icon="i-ic-round-search"
        placeholder="Buscar projeto..."
        size="lg"
        class="flex-1 min-w-48"
      />
      <UButton
        data-testid="projeto-adicionar"
        label="Adicionar"
        trailing-icon="i-ic-round-add"
        size="lg"
        disabled
      />
    </div>

    <h1 class="text-2xl font-bold mt-8 mb-4">
      Acesse seus projetos
    </h1>

    <div
      v-if="status === 'pending'"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <USkeleton
        v-for="i in PAGE_SIZE"
        :key="i"
        class="h-32"
      />
    </div>

    <p
      v-else-if="projects.length === 0"
      data-testid="projeto-vazio"
      class="text-muted py-10 text-center"
    >
      Nenhum projeto encontrado
    </p>

    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <ProjectCard
        v-for="project in projects"
        :key="project.slug"
        :project="project"
      />
    </div>

    <div class="flex justify-center mt-8">
      <UPagination
        v-model:page="page"
        data-testid="projeto-paginacao"
        :total="total"
        :items-per-page="PAGE_SIZE"
      />
    </div>
  </UContainer>
</template>
```

- [ ] **Step 5: Remover o prerender da home no `frontend/nuxt.config.ts`**

Deletar o bloco (a home agora é dinâmica):

```ts
routeRules: {
  '/': { prerender: true }
},
```

- [ ] **Step 6: Rodar e ver passar**

```bash
docker compose -f docker-compose.dev.yml exec frontend pnpm test
```

Expected: 5 passed (3 de card + 2 de página).

- [ ] **Step 7: Verificar no browser**

```bash
curl -s http://localhost:23000/ | grep -o 'Acesse seus projetos'
```

Expected: `Acesse seus projetos`.

- [ ] **Step 8: Lint, typecheck e commit**

```bash
docker compose -f docker-compose.dev.yml exec frontend pnpm lint --fix
docker compose -f docker-compose.dev.yml exec frontend pnpm typecheck
git add frontend/app/pages/index.vue frontend/tests/pages/index.spec.ts frontend/nuxt.config.ts frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat: add projects home with search and pagination"
```

---

### Task 4: E2E full-stack `home.spec.ts`

**Files:**
- Create: `e2e/fixtures/projects/<slug>/acutis.json` (8 projetos)
- Modify: `e2e/playwright.config.ts` (env `NUXT_API_URL` no webServer)
- Create: `e2e/tests/home.spec.ts`

**Interfaces:**
- Consumes: testids da Task 3, backend Laravel no host (`php artisan serve`, vendor/ e `.env` já existem via bind mount do compose).

**Pré-requisito:** derrubar qualquer `pnpm dev` do host na porta 3000 antes de rodar (o webServer precisa subir com `NUXT_API_URL` novo; o container docker na 23000 não interfere).

- [ ] **Step 1: Criar as fixtures — 8 dirs em `e2e/fixtures/projects/`**

Cada dir contém só `acutis.json`. Slugs/nomes (ordenação default é por nome — página 1 = 6 primeiros, página 2 = 2 últimos):

| dir | acutis.json |
|-----|-------------|
| `alpha-store` | `{"slug": "alpha-store", "name": "Alpha Store", "created_at": "2026-01-01T00:00:00+00:00"}` |
| `beta-blog` | `{"slug": "beta-blog", "name": "Beta Blog", "created_at": "2026-01-02T00:00:00+00:00"}` |
| `casa-verde` | `{"slug": "casa-verde", "name": "Casa Verde", "created_at": "2026-01-03T00:00:00+00:00"}` |
| `delta-crm` | `{"slug": "delta-crm", "name": "Delta CRM", "created_at": "2026-01-04T00:00:00+00:00"}` |
| `echo-docs` | `{"slug": "echo-docs", "name": "Echo Docs", "created_at": "2026-01-05T00:00:00+00:00"}` |
| `foxtrot-api` | `{"slug": "foxtrot-api", "name": "Foxtrot API", "created_at": "2026-01-06T00:00:00+00:00"}` |
| `golf-panel` | `{"slug": "golf-panel", "name": "Golf Panel", "created_at": "2026-01-07T00:00:00+00:00"}` |
| `zumbi-tracker` | `{"slug": "zumbi-tracker", "name": "Zumbi Tracker", "created_at": "2026-01-08T00:00:00+00:00"}` |

Exemplo de conteúdo (um por arquivo, formatado):

```json
{
    "slug": "alpha-store",
    "name": "Alpha Store",
    "created_at": "2026-01-01T00:00:00+00:00"
}
```

- [ ] **Step 2: Env do webServer — `e2e/playwright.config.ts`**

No bloco `webServer`, adicionar `env`:

```ts
    webServer: {
        command: 'pnpm dev',
        cwd: '../frontend',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
            ...process.env,
            NUXT_API_URL: 'http://localhost:4200',
        },
    },
```

- [ ] **Step 3: Escrever `e2e/tests/home.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'

const BACKEND_DIR = resolve(import.meta.dirname, '../../backend')
const FIXTURES_DIR = resolve(import.meta.dirname, '../fixtures/projects')
const BACKEND_URL = 'http://localhost:4200'

let backend: ChildProcess

async function waitForBackend(): Promise<void> {
    for (let i = 0; i < 50; i++) {
        try {
            const res = await fetch(`${BACKEND_URL}/api/v1/projects`)
            if (res.ok) return
        } catch { /* ainda subindo */ }
        await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('backend did not become healthy in time')
}

test.describe('projects home', { tag: ['@read', '@project'] }, () => {
    test.beforeAll(async () => {
        backend = spawn('php', ['artisan', 'serve', '--port=4200'], {
            cwd: BACKEND_DIR,
            stdio: 'ignore',
            env: { ...process.env, ACUTIS_PROJECTS_PATH: FIXTURES_DIR },
        })
        await waitForBackend()
    })

    test.afterAll(() => {
        backend.kill()
    })

    test.beforeEach(async ({ page }) => {
        await test.step('open home and wait for hydration', async () => {
            await page.goto('/')
            await page.locator('[data-hydrated="true"]').waitFor()
        })
    })

    test('lists the first page of projects', async ({ page }) => {
        await expect(page.getByTestId('projeto-card')).toHaveCount(6)
        await expect(page.getByTestId('projeto-card').first()).toContainText('Alpha Store')
    })

    test('search filters projects server-side', async ({ page }) => {
        await test.step('type a unique term in the search input', async () => {
            await page.getByTestId('projeto-busca').fill('zumbi')
        })

        await expect(page.getByTestId('projeto-card')).toHaveCount(1)
        await expect(page.getByTestId('projeto-card')).toContainText('Zumbi Tracker')
    })

    test('pagination navigates to the second page', async ({ page }) => {
        await test.step('go to page 2', async () => {
            await page.getByTestId('projeto-paginacao').getByRole('button', { name: '2', exact: true }).click()
        })

        await expect(page.getByTestId('projeto-card')).toHaveCount(2)
        await expect(page.getByTestId('projeto-card').first()).toContainText('Golf Panel')
    })

    test('search without matches shows the empty state', async ({ page }) => {
        await test.step('type a term that matches nothing', async () => {
            await page.getByTestId('projeto-busca').fill('xyznope')
        })

        await expect(page.getByTestId('projeto-vazio')).toBeVisible()
    })
})
```

- [ ] **Step 4: Rodar o spec**

```bash
cd e2e && pnpm playwright test tests/home.spec.ts
```

Expected: 4 passed. (Se `php` não existir no host, reportar — não contornar apagando teste.)

- [ ] **Step 5: Rodar a suíte E2E inteira (regressão)**

```bash
cd e2e && pnpm playwright test
```

Expected: tudo verde (specs de recording/runner não usam o backend, o env novo não os afeta).

- [ ] **Step 6: Commit**

```bash
git add e2e/fixtures/projects e2e/playwright.config.ts e2e/tests/home.spec.ts
git commit -m "test: add e2e coverage for projects home"
```

---

### Task 5: PR e merge

- [ ] **Step 1: Conferir que `app.config.ts` ficou de fora**

```bash
git status --short
```

Expected: apenas `M frontend/app/app.config.ts` (pré-existente, do usuário) como pendência não commitada.

- [ ] **Step 2: Push e PR**

```bash
git push -u origin feat/home-projects
gh pr create --title "feat: projects home with search and pagination" --body "$(cat <<'EOF'
## O que
Home real no lugar do template starter: busca server-side, grid de cards de projetos e paginação, conforme mockup.

## Como
- Proxy Nitro `GET /api/projects` → backend `GET /api/v1/projects` (`runtimeConfig.apiUrl`, `NUXT_API_URL` no compose)
- `pages/index.vue`: busca com debounce 300ms (reset pra página 1), grid 1→3 colunas, `UPagination` (page size 6), skeleton no loading, estado vazio
- `components/project/card.vue`: nome, repo/path, badge do provider (GitHub/GitLab)
- Bootstrap de testes Nuxt: @nuxt/test-utils + Vitest (5 testes de componente/página)
- E2E `home.spec.ts`: 4 cenários full-stack com fixtures filesystem (`ACUTIS_PROJECTS_PATH`)

## Fora do escopo
Botão "Adicionar" é visual/disabled (criação de projeto é feature futura); card sem clique (detalhe futuro).
EOF
)"
gh pr merge --squash
```

- [ ] **Step 3: Limpar branch órfã (memória branches.md)**

```bash
git checkout main && git pull && git branch -d feat/home-projects && git push origin --delete feat/home-projects 2>/dev/null || true
```
