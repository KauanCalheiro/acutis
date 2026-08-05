<script setup lang="ts">
import type { RecorderEvent } from '~/composables/webdriver'

interface ProjectAuthModal {
  slug: string
  status: 'unset' | 'skipped' | 'configured' | 'failing'
}

const { slug, status } = defineProps<ProjectAuthModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  record: []
  written: []
  test: []
}>()

const LOADING_PHRASES = [
  'Analisando os eventos gravados',
  'Identificando os campos de usuário e senha',
  'Escrevendo o fluxo de autenticação'
]

const step = ref<'loading-existing' | 'intro' | 'loading' | 'credentials' | 'view' | 'edit'>('intro')
const error = ref<string | null>(null)
const existingScript = ref('')
const editedScript = ref('')
const saving = ref(false)
const submittingRecording = ref(false)

const username = ref('')
const password = ref('')
const savingCredentials = ref(false)

watch(open, async (isOpen) => {
  if (!isOpen || submittingRecording.value) return

  error.value = null

  if (status === 'unset' || status === 'skipped') {
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
}

/** O resultado aparece no modal de execução, o mesmo dos cenários, daí fechar este antes. */
function runAuth() {
  open.value = false
  emit('test')
}

function startRecording() {
  open.value = false
  emit('record')
}

async function saveCredentials() {
  savingCredentials.value = true
  error.value = null

  try {
    await $fetch(`/api/projects/${slug}/auth/credentials`, {
      method: 'POST',
      body: { username: username.value, password: password.value }
    })
    username.value = ''
    password.value = ''
    open.value = false
    emit('written')
  } catch {
    error.value = 'Não foi possível salvar as credenciais. Tente novamente.'
  } finally {
    savingCredentials.value = false
  }
}

async function submitRecording(baseUrl: string, events: RecorderEvent[]) {
  submittingRecording.value = true
  error.value = null
  step.value = 'loading'
  open.value = true

  try {
    const response = await $fetch<{ authSetup: string, credentialsNeeded: boolean }>(`/api/projects/${slug}/auth/record`, {
      method: 'POST',
      body: {
        baseUrl,
        events: events.map(event => ({
          type: event.type,
          timestamp: event.timestamp,
          url: event.url ?? null,
          selectors: event.selectors ?? null,
          label: event.label ?? null,
          value: event.value ?? null,
          inputType: event.inputType ?? null
        }))
      }
    })

    if (response.credentialsNeeded) {
      step.value = 'credentials'
      return
    }

    open.value = false
    emit('written')
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
    :dismissable="false"
    :loading="step === 'loading' || step === 'loading-existing'"
    wide
  >
    <template #header>
      <div class="flex w-full items-start justify-between gap-4">
        <p class="pt-6 p-2 text-xl font-bold">
          Autenticação
        </p>

        <div
          v-if="step === 'view'"
          class="mt-6 flex shrink-0 gap-2"
        >
          <UButton
            label="Gravar novamente"
            color="neutral"
            variant="soft"
            data-testid="auth-gravar-novamente"
            @click="recordAgain"
          />
          <UButton
            label="Testar"
            trailing-icon="i-ic-round-play-arrow"
            data-testid="auth-testar"
            @click="runAuth"
          />
        </div>
      </div>
    </template>

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
        v-else-if="step === 'credentials'"
        class="flex flex-col gap-4"
        data-testid="auth-credenciais"
      >
        <UAlert
          color="warning"
          variant="soft"
          icon="i-ic-round-key"
          title="Não identifiquei usuário e senha nesta gravação"
          description="O login é executado de novo a cada rodada de testes, então ele precisa das credenciais reais. Elas ficam só no .env local do projeto, que não é versionado."
        />
        <UFormField label="Usuário">
          <UInput
            v-model="username"
            class="w-full"
            autocomplete="off"
            data-testid="auth-credenciais-usuario"
          />
        </UFormField>
        <UFormField label="Senha">
          <UInput
            v-model="password"
            class="w-full"
            type="password"
            autocomplete="off"
            data-testid="auth-credenciais-senha"
          />
        </UFormField>
      </div>

      <BaseCodefield
        v-else-if="step === 'view'"
        :model-value="existingScript"
        language="typescript"
        readonly
        testid="auth-script"
      />

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
          Vamos gravar o login de verdade: clique em "Gravar" e faça o login normalmente na aba que abrir. A IA transforma essa gravação num teste de autenticação, sem adivinhar seletor e sem digitar sua senha em formulário nenhum.
        </p>
        <p class="text-xs text-dimmed">
          A senha digitada na gravação fica salva localmente no `.env` do projeto, nunca no script gerado nem versionada. Assim que o teste estiver escrito, ele é executado para confirmar que o login funciona.
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
      <template v-if="step === 'credentials'">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          data-testid="auth-credenciais-cancelar"
          @click="open = false"
        />
        <UButton
          label="Salvar e executar"
          :loading="savingCredentials"
          :disabled="!username || !password"
          data-testid="auth-credenciais-salvar"
          @click="saveCredentials"
        />
      </template>

      <template v-else-if="step === 'view'">
        <UButton
          label="Editar"
          color="neutral"
          variant="soft"
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
