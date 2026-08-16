<script setup lang="ts">
import type { RunTest } from '~/composables/run-stream'

// ponytail: rota de preview: a modal é puramente apresentacional (running/tests via prop),
// cada botão só define a prop direto, sem chamada de API nem stream de verdade.
const startingOpen = ref(false)
const runningOpen = ref(false)
const passedOpen = ref(false)
const failedOpen = ref(false)
const noStepOpen = ref(false)
const skippedOpen = ref(false)
const manyOpen = ref(false)
const noTestsOpen = ref(false)

function test(id: string, title: string, status: RunTest['status'], steps: RunTest['steps'] = [], error: string | null = null): RunTest {
  return {
    id,
    title,
    status,
    error,
    steps
  }
}

const loginSteps = [
  { title: 'Abrir página de login', status: 'success' as const },
  { title: 'Entrar com usuário/código', status: 'success' as const },
  { title: 'Ver o painel', status: 'success' as const }
]

const cadastroFailedSteps = [
  { title: 'Abrir o formulário de produto', status: 'success' as const },
  { title: 'Preencher nome e preço', status: 'success' as const },
  { title: 'Clicar em Salvar', status: 'failed' as const, error: 'Timed out 5000ms waiting for locator(\'#salvar\')' },
  { title: 'Ver o produto na listagem', status: 'waiting' as const }
]

const runningTests = [
  test('t1', 'Login do cliente entra com credenciais válidas', 'success', loginSteps),
  test('t2', 'Cadastro de produto cria um produto', 'running', [
    { title: 'Abrir o formulário de produto', status: 'success' },
    { title: 'Preencher nome e preço', status: 'running' }
  ]),
  test('t3', 'Cadastro de produto remove um produto', 'waiting')
]

const passedTests = [
  test('t1', 'Login do cliente entra com credenciais válidas', 'success', loginSteps),
  test('t2', 'Cadastro de produto cria um produto', 'success', loginSteps),
  test('t3', 'Cadastro de produto remove um produto', 'success', loginSteps)
]

const failedTests = [
  test('t1', 'Login do cliente entra com credenciais válidas', 'success', loginSteps),
  test('t2', 'Cadastro de produto cria um produto', 'failed', cadastroFailedSteps, 'Timed out 5000ms waiting for locator(\'#salvar\')'),
  test('t3', 'Cadastro de produto remove um produto', 'success', loginSteps)
]

// O teste morre antes do primeiro passo: o erro só existe no teste, não em passo nenhum.
const noStepTests = [
  test('t1', 'Login do cliente entra com credenciais válidas', 'failed', [], 'Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8000/'),
  test('t2', 'Cadastro de produto cria um produto', 'failed', [], 'Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8000/')
]

// A autenticação quebrou, então o Playwright pula os cenários que dependem dela.
const skippedTests = [
  test('t1', 'Autenticação', 'failed', [
    { title: 'Autenticação', status: 'failed', error: 'Timed out 30000ms waiting for navigation to leave /login' }
  ]),
  test('t2', 'Login do cliente entra com credenciais válidas', 'waiting'),
  test('t3', 'Cadastro de produto cria um produto', 'waiting')
]

const manyTests = Array.from({ length: 12 }, (_, i) => test(
  `m${i}`,
  `Cadastro de produto valida o campo obrigatório número ${i + 1}`,
  i % 4 === 3 ? 'failed' : 'success',
  i % 4 === 3 ? cadastroFailedSteps : loginSteps,
  i % 4 === 3 ? 'Timed out 5000ms waiting for locator(\'#salvar\')' : null
))

const NO_TESTS_OUTPUT = `Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.`

const PROJECT = 'Nome bem legal do projeto'
const SLUG = 'nome-bem-legal-do-projeto'
</script>

<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-bold mb-1">
      Preview: Rodando os cenários filtrados
    </h1>
    <p class="text-sm text-muted mb-8">
      Mesmo componente do botão "Rodar filtrados" da página do projeto, com dado mocado. Um botão por estado.
    </p>

    <div class="flex flex-wrap gap-3">
      <UButton
        label="Iniciando"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-filtrados-iniciando"
        @click="startingOpen = true"
      />
      <UButton
        label="Rodando"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-filtrados-rodando"
        @click="runningOpen = true"
      />
      <UButton
        label="Todos passaram"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-filtrados-passou"
        @click="passedOpen = true"
      />
      <UButton
        label="Um falhou"
        trailing-icon="i-ic-round-play-arrow"
        color="error"
        variant="soft"
        data-testid="preview-filtrados-falhou"
        @click="failedOpen = true"
      />
      <UButton
        label="Falhou sem passo nenhum"
        trailing-icon="i-ic-round-play-arrow"
        color="error"
        variant="soft"
        data-testid="preview-filtrados-sem-passo"
        @click="noStepOpen = true"
      />
      <UButton
        label="Autenticação quebrou, resto pulado"
        trailing-icon="i-ic-round-play-arrow"
        color="error"
        variant="soft"
        data-testid="preview-filtrados-pulados"
        @click="skippedOpen = true"
      />
      <UButton
        label="Lista longa (12 cenários)"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-filtrados-muitos"
        @click="manyOpen = true"
      />
      <UButton
        label="Morreu antes de começar"
        trailing-icon="i-ic-round-play-arrow"
        color="error"
        variant="soft"
        data-testid="preview-filtrados-sem-teste"
        @click="noTestsOpen = true"
      />
    </div>

    <ProjectRunFilteredModal
      v-model:open="startingOpen"
      running
      :project-name="PROJECT"
      :slug="SLUG"
      filter="@write"
    />
    <ProjectRunFilteredModal
      v-model:open="runningOpen"
      running
      :tests="runningTests"
      :project-name="PROJECT"
      :slug="SLUG"
      filter="@write"
    />
    <ProjectRunFilteredModal
      v-model:open="passedOpen"
      passed
      :tests="passedTests"
      :project-name="PROJECT"
      :slug="SLUG"
      filter="@write"
      tested-at="16/04/2026 14:32"
    />
    <ProjectRunFilteredModal
      v-model:open="failedOpen"
      :tests="failedTests"
      :project-name="PROJECT"
      :slug="SLUG"
      filter="@write"
      tested-at="16/04/2026 14:32"
    />
    <ProjectRunFilteredModal
      v-model:open="noStepOpen"
      :tests="noStepTests"
      :project-name="PROJECT"
      :slug="SLUG"
      filter="produto"
      tested-at="16/04/2026 14:32"
    />
    <ProjectRunFilteredModal
      v-model:open="skippedOpen"
      :tests="skippedTests"
      :project-name="PROJECT"
      :slug="SLUG"
      filter="@read"
      tested-at="16/04/2026 14:32"
    />
    <ProjectRunFilteredModal
      v-model:open="manyOpen"
      :tests="manyTests"
      :project-name="PROJECT"
      :slug="SLUG"
      filter="produto"
      tested-at="16/04/2026 14:32"
    />
    <ProjectRunFilteredModal
      v-model:open="noTestsOpen"
      :project-name="PROJECT"
      :slug="SLUG"
      filter="@nao-existe"
      :output="NO_TESTS_OUTPUT"
      tested-at="16/04/2026 14:32"
    />
  </UContainer>
</template>
