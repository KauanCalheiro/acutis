<script setup lang="ts">
// ponytail: rota de preview (ver .claude/memory/feedback_dev-preview-routes.md):
// a modal é puramente apresentacional (running/steps via prop), cada botão só
// define a prop direto, sem chamada de API nem stream de verdade.
const startingOpen = ref(false)
const runningOpen = ref(false)
const passedOpen = ref(false)
const failedOpen = ref(false)
const noTestsOpen = ref(false)
const syntaxOpen = ref(false)
const authenticatingOpen = ref(false)
const authFailedOpen = ref(false)
const authAloneOpen = ref(false)

const runningSteps = [
  { title: 'Abrir página de login', status: 'success' as const },
  { title: 'Entrar com usuário/código', status: 'running' as const },
  { title: 'Usuário ou código', status: 'waiting' as const },
  { title: 'Ver o painel', status: 'waiting' as const }
]

const failedSteps = [
  { title: 'Abrir página de login', status: 'success' as const },
  { title: 'Entrar com usuário/código', status: 'success' as const },
  { title: 'Usuário ou código', status: 'failed' as const, error: 'Timed out 5000ms waiting for locator(\'#user-input\')' },
  { title: 'Ver o painel', status: 'waiting' as const }
]

const passedSteps = failedSteps.map(step => ({ ...step, status: 'success' as const, error: null }))

// Cenário que depende de login: a autenticação entra como UM passo, no topo, e os passos internos
// dela ficam escondidos, senão eles apareceriam intercalados com os do cenário.
const authenticatingSteps = [
  { title: 'Autenticação', status: 'running' as const },
  { title: 'Dado que eu navego para a página da Plataforma Univates', status: 'waiting' as const },
  { title: 'Quando eu clico no atalho "Disciplinas"', status: 'waiting' as const },
  { title: 'E eu clico na disciplina "Cidades Inteligentes"', status: 'waiting' as const }
]

const authFailedSteps = [
  { title: 'Autenticação', status: 'failed' as const, error: 'Timed out 30000ms waiting for navigation to leave /login' },
  { title: 'Dado que eu navego para a página da Plataforma Univates', status: 'waiting' as const },
  { title: 'Quando eu clico no atalho "Disciplinas"', status: 'waiting' as const },
  { title: 'E eu clico na disciplina "Cidades Inteligentes"', status: 'waiting' as const }
]

const SAMPLE_VIDEO_URL = '/dev/sample-run.webm'

// A execução morre antes do reporter emitir qualquer coisa: sem passo, sem vídeo, e o motivo
// só existe na saída do processo. Era esse o estado que aparecia como modal vazio.
const NO_TESTS_OUTPUT = `Error: No tests found.
Make sure that arguments are regular expressions matching test files.
You may need to escape symbols like "$" or "*" and quote the arguments.`

const SYNTAX_ERROR_OUTPUT = `Error: tests/auth.setup.ts: Unexpected token (12:4)

  10 |   await setup.step('Preencher credenciais', async () => {
  11 |     await page.locator('#v-0').fill(process.env.AUTH_USER ?? '')
> 12 |     await page.locator('#v-1'.fill(process.env.AUTH_PASSWORD ?? '')
     |     ^`
</script>

<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-bold mb-1">
      Preview: Executando teste
    </h1>
    <p class="text-sm text-muted mb-8">
      Mesmo componente da tela de detalhe do cenário, com dado mocado. Um botão por estado.
    </p>

    <div class="flex flex-wrap gap-3">
      <UButton
        label="Iniciando"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-execucao-iniciando"
        @click="startingOpen = true"
      />
      <UButton
        label="Rodando"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-execucao-rodando"
        @click="runningOpen = true"
      />
      <UButton
        label="Passou"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-execucao-passou"
        @click="passedOpen = true"
      />
      <UButton
        label="Falhou"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-execucao-falhou"
        @click="failedOpen = true"
      />
      <UButton
        label="Autenticando"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-execucao-autenticando"
        @click="authenticatingOpen = true"
      />
      <UButton
        label="Testando a autenticação (sozinha)"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-execucao-auth-sozinha"
        @click="authAloneOpen = true"
      />
      <UButton
        label="Autenticação falhou"
        trailing-icon="i-ic-round-play-arrow"
        color="error"
        variant="soft"
        data-testid="preview-execucao-auth-falhou"
        @click="authFailedOpen = true"
      />
      <UButton
        label="Morreu antes de começar (config)"
        trailing-icon="i-ic-round-play-arrow"
        color="error"
        variant="soft"
        data-testid="preview-execucao-sem-teste"
        @click="noTestsOpen = true"
      />
      <UButton
        label="Morreu antes de começar (sintaxe)"
        trailing-icon="i-ic-round-play-arrow"
        color="error"
        variant="soft"
        data-testid="preview-execucao-sintaxe"
        @click="syntaxOpen = true"
      />
    </div>

    <ScenarioTestRunModal
      v-model:open="startingOpen"
      running
      project-name="Nome bem legal do projeto"
      scenario-name="Nome bem legal do cenário"
    />
    <ScenarioTestRunModal
      v-model:open="runningOpen"
      running
      :steps="runningSteps"
      project-name="Nome bem legal do projeto"
      scenario-name="Nome bem legal do cenário"
    />
    <ScenarioTestRunModal
      v-model:open="passedOpen"
      :steps="passedSteps"
      :video-url="SAMPLE_VIDEO_URL"
      project-name="Nome bem legal do projeto"
      scenario-name="Nome bem legal do cenário"
      branch="main"
      tested-at="16/04/2026 14:32"
    />
    <ScenarioTestRunModal
      v-model:open="failedOpen"
      :steps="failedSteps"
      :video-url="SAMPLE_VIDEO_URL"
      project-name="Nome bem legal do projeto"
      scenario-name="Nome bem legal do cenário"
      branch="main"
      tested-at="16/04/2026 14:32"
    />
    <ScenarioTestRunModal
      v-model:open="authenticatingOpen"
      running
      :steps="authenticatingSteps"
      project-name="Nome bem legal do projeto"
      scenario-name="Acessar detalhes da disciplina"
    />
    <ScenarioTestRunModal
      v-model:open="authAloneOpen"
      kind="autenticacao"
      :steps="passedSteps"
      :video-url="SAMPLE_VIDEO_URL"
      project-name="Nome bem legal do projeto"
      scenario-name="tests/auth.setup.ts"
      branch="main"
      tested-at="16/04/2026 14:32"
    />
    <ScenarioTestRunModal
      v-model:open="authFailedOpen"
      :steps="authFailedSteps"
      project-name="Nome bem legal do projeto"
      scenario-name="Acessar detalhes da disciplina"
      branch="main"
      tested-at="16/04/2026 14:32"
    />
    <ScenarioTestRunModal
      v-model:open="noTestsOpen"
      :output="NO_TESTS_OUTPUT"
      project-name="Nome bem legal do projeto"
      scenario-name="Autenticação"
      branch="main"
      tested-at="16/04/2026 14:32"
    />
    <ScenarioTestRunModal
      v-model:open="syntaxOpen"
      :output="SYNTAX_ERROR_OUTPUT"
      project-name="Nome bem legal do projeto"
      scenario-name="Autenticação"
      branch="main"
      tested-at="16/04/2026 14:32"
    />
  </UContainer>
</template>
