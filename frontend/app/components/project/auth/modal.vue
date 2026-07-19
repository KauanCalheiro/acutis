<script setup lang="ts">
import type { RecorderEvent } from '~/composables/webdriver'

interface ProjectAuthModal {
  slug: string
  status: 'unset' | 'skipped' | 'configured'
}

const { slug, status } = defineProps<ProjectAuthModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  configured: []
  record: []
}>()

const LOADING_PHRASES = [
  'Analisando os eventos gravados',
  'Identificando os campos de usuário e senha',
  'Escrevendo o fluxo de autenticação'
]

const step = ref<'loading-existing' | 'intro' | 'loading' | 'result' | 'view' | 'edit'>('intro')
const error = ref<string | null>(null)
const generatedScript = ref('')
const existingScript = ref('')
const editedScript = ref('')
const saving = ref(false)

const submittingRecording = ref(false)

const running = ref(false)
const runResult = ref<{ passed: boolean, output: string } | null>(null)

async function runTest() {
  running.value = true
  runResult.value = null

  try {
    runResult.value = await $fetch<{ passed: boolean, output: string }>(`/api/projects/${slug}/run`, {
      method: 'POST',
      body: { spec: 'tests/auth.setup.ts' }
    })
  } catch {
    runResult.value = { passed: false, output: 'Não foi possível executar o teste.' }
  } finally {
    running.value = false
  }
}

watch(open, async (isOpen) => {
  if (!isOpen || submittingRecording.value) return

  error.value = null

  if (status !== 'configured') {
    step.value = 'intro'
    return
  }

  step.value = 'loading-existing'

  try {
    const response = await $fetch<{ authSetup: string }>(`/api/projects/${slug}/auth`)
    existingScript.value = response.authSetup
    step.value = 'view'
  } catch {
    error.value = 'Não foi possível carregar a autenticação existente.'
    step.value = 'intro'
  }
})

const modalTitle = 'Autenticação'

function edit() {
  editedScript.value = existingScript.value
  step.value = 'edit'
}

async function save() {
  saving.value = true
  error.value = null

  try {
    const response = await $fetch<{ authSetup: string }>(`/api/projects/${slug}/auth`, {
      method: 'PUT',
      body: { authSetup: editedScript.value }
    })
    existingScript.value = response.authSetup
    step.value = 'view'
  } catch {
    error.value = 'Não foi possível salvar as alterações. Tente novamente.'
  } finally {
    saving.value = false
  }
}

function recordAgain() {
  step.value = 'intro'
  runResult.value = null
}

function startRecording() {
  open.value = false
  emit('record')
}

async function submitRecording(baseUrl: string, events: RecorderEvent[]) {
  submittingRecording.value = true
  error.value = null
  runResult.value = null
  step.value = 'loading'
  open.value = true

  try {
    const response = await $fetch<{ authSetup: string }>(`/api/projects/${slug}/auth/record`, {
      method: 'POST',
      body: {
        baseUrl,
        events: events.map(event => ({
          type: event.type,
          timestamp: event.timestamp,
          url: event.url ?? null,
          selectors: event.selectors ?? null,
          label: event.label ?? null,
          value: event.value ?? null
        }))
      }
    })
    generatedScript.value = response.authSetup
    step.value = 'result'
    emit('configured')
  } catch {
    error.value = 'Não foi possível gerar a autenticação a partir da gravação. Tente novamente.'
    step.value = 'intro'
  } finally {
    submittingRecording.value = false
  }
}

defineExpose({
  submitRecording
})
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="modalTitle"
    :dismissable="false"
    :loading="step === 'loading' || step === 'loading-existing'"
    wide
  >
    <template #body>
      <BaseLoadingPhrases
        v-if="step === 'loading'"
        :phrases="LOADING_PHRASES"
        data-testid="auth-carregando"
      />

      <BaseLoadingPhrases
        v-else-if="step === 'loading-existing'"
        :phrases="['Carregando a autenticação do projeto']"
        data-testid="auth-carregando-existente"
      />

      <div
        v-else-if="step === 'result'"
        class="flex flex-col gap-4"
      >
        <UAlert
          color="success"
          variant="soft"
          title="Autenticação gravada"
          description="O login gravado foi convertido em teste. Preencha AUTH_USER e AUTH_PASSWORD no .env do projeto com as credenciais reais para rodar esse login automaticamente depois."
          data-testid="auth-resultado"
        />
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs text-dimmed">
            Prévia do teste gerado
          </p>
          <UButton
            label="Executar"
            size="xs"
            color="neutral"
            variant="soft"
            :loading="running"
            data-testid="auth-executar"
            @click="runTest"
          />
        </div>
        <pre class="rounded-md bg-elevated p-3 font-mono text-xs overflow-x-auto" data-testid="auth-script">{{ generatedScript }}</pre>
        <UAlert
          v-if="runResult"
          :color="runResult.passed ? 'success' : 'error'"
          variant="soft"
          :title="runResult.passed ? 'Teste passou' : 'Teste falhou'"
          data-testid="auth-execucao-resultado"
        >
          <template #description>
            <code class="block whitespace-pre-wrap text-xs">{{ runResult.output }}</code>
          </template>
        </UAlert>
      </div>

      <pre
        v-else-if="step === 'view'"
        class="rounded-md bg-elevated p-3 font-mono text-xs overflow-x-auto"
        data-testid="auth-script"
      >{{ existingScript }}</pre>

      <BaseCodefield
        v-else-if="step === 'edit'"
        v-model="editedScript"
        language="typescript"
        testid="auth-script-editor"
      />

      <div
        v-else-if="step === 'intro'"
        class="flex flex-col gap-3"
      >
        <p class="text-sm">
          Vamos gravar o login de verdade: clique em "Gravar" e faça o login normalmente na aba que abrir. A IA transforma essa gravação num teste de autenticação — sem adivinhar seletor, sem digitar sua senha em formulário nenhum.
        </p>
        <p class="text-xs text-dimmed">
          Campos de senha nunca são capturados em texto — a extensão já mascara esse valor antes de qualquer coisa sair do seu navegador.
        </p>
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :description="error"
        class="mt-4"
        data-testid="auth-erro"
      />
    </template>

    <template #footer>
      <template v-if="step === 'result'">
        <UButton
          label="Gravar novamente"
          color="neutral"
          variant="soft"
          data-testid="auth-reconfigurar"
          @click="recordAgain"
        />
        <UButton
          label="Salvar"
          data-testid="auth-salvar"
          @click="open = false"
        />
      </template>

      <template v-else-if="step === 'view'">
        <UButton
          label="Gravar novamente"
          color="neutral"
          variant="soft"
          data-testid="auth-gravar-novamente"
          @click="recordAgain"
        />
        <UButton
          label="Editar"
          data-testid="auth-editar"
          @click="edit"
        />
        <UButton
          label="Fechar"
          color="neutral"
          variant="ghost"
          data-testid="auth-fechar"
          @click="open = false"
        />
      </template>

      <template v-else-if="step === 'edit'">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          data-testid="auth-editar-cancelar"
          @click="step = 'view'"
        />
        <UButton
          label="Salvar"
          :loading="saving"
          data-testid="auth-salvar"
          @click="save"
        />
      </template>

      <template v-else>
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          data-testid="auth-cancelar"
          @click="open = false"
        />
        <UButton
          label="Gravar"
          data-testid="auth-gerar"
          @click="startRecording"
        />
      </template>
    </template>
  </BaseModal>
</template>
