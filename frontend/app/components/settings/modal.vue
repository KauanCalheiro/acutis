<script setup lang="ts">
interface AiCredential {
  key: string | null
  url: string | null
  model: string | null
}

/** Um modelo que o provedor disse ter. O `id` é o que vai no cadastro; o `label`, o que a tela mostra. */
interface AvailableModel {
  id: string
  label: string
}

interface AiSettings {
  provider: string
  credentials: Record<string, AiCredential>
  providers: string[]
  provider_urls: Record<string, string>
  keyless_providers: string[]
}

/** "Sem IA" viaja com este nome na tela e volta a ser vazio ao salvar. */
const NO_AI = 'no-ai'

/** Como cada provedor se chama e se desenha; quem não estiver aqui aparece pelo id, sem logo. */
const PROVIDERS: Record<string, { label: string, icon: string }> = {
  'anthropic': { label: 'Anthropic', icon: 'i-simple-icons-anthropic' },
  // Nome e ícone travados pelas diretrizes de marca da Anthropic: "Claude Code" e o logo dele não
  // são permitidos em produto de terceiro. Não renomear — ver a memória ai-claude-agent.
  'claude-code': { label: 'Claude Agent', icon: 'i-simple-icons-claude' },
  'gemini': { label: 'Google Gemini', icon: 'i-simple-icons-googlegemini' },
  'ollama': { label: 'Ollama', icon: 'i-simple-icons-ollama' },
  'openai': { label: 'OpenAI', icon: 'i-simple-icons-openai' },
  'openrouter': { label: 'OpenRouter', icon: 'i-simple-icons-openrouter' }
}

const open = defineModel<boolean>('open', {
  default: false
})

const notify = useNotify()

const settings = ref<AiSettings | null>(null)
const provider = ref('')
const key = ref('')
const url = ref('')
const model = ref('')
const models = ref<AvailableModel[]>([])
const modelsError = ref('')
const loadingModels = ref(false)
const loading = ref(false)
const saving = ref(false)
const revealed = ref(false)

const providerItems = computed(() => [
  {
    label: 'Sem IA',
    value: NO_AI,
    icon: 'i-ic-round-block'
  },
  ...(settings.value?.providers ?? []).map(name => ({
    label: PROVIDERS[name]?.label ?? name,
    value: name,
    icon: PROVIDERS[name]?.icon
  }))
])

const providerIcon = computed(() => providerItems.value.find(item => item.value === provider.value)?.icon)

const noAi = computed(() => provider.value === NO_AI)

/** O Claude Agent roda o binário local: sem chave, sem endereço, só o modelo. */
const claudeAgent = computed(() => provider.value === 'claude-code')

/** Provedor que roda na máquina do usuário não cobra chave; nos outros o campo é obrigatório. */
const keyRequired = computed(() => !noAi.value && !(settings.value?.keyless_providers ?? []).includes(provider.value))

/** Onde a Anthropic documenta a instalação e o login do Claude Code. */
const DOC_CLAUDE_CODE = 'https://docs.claude.com/en/docs/claude-code/setup'

/** O endereço que vale com o campo vazio, para o placeholder dizer o que vai acontecer. */
const defaultUrl = computed(() => settings.value?.provider_urls[provider.value] ?? 'o endereço do provedor')

/** A lista de modelos, perguntada ao provedor com o que está digitado agora. */
async function loadModels() {
  if (noAi.value) return

  loadingModels.value = true
  modelsError.value = ''

  try {
    models.value = await $fetch<AvailableModel[]>('/api/settings/ai/models', {
      method: 'POST',
      body: {
        provider: provider.value,
        key: key.value || null,
        url: url.value || null
      }
    })
  } catch (err) {
    models.value = []
    modelsError.value = extractServerError(err, 'Não foi possível listar os modelos do provedor.')
  } finally {
    loadingModels.value = false
  }
}

/**
 * Sem nada preenchido, perguntar ao provedor só rende erro na cara do usuário: espera ele terminar
 * de digitar a chave (ou o endereço). O agente local não pede credencial nenhuma, então já pergunta.
 */
function loadModelsIfReady() {
  if (claudeAgent.value || key.value || url.value) loadModels()
}

// Cada provedor guarda o seu cadastro: trocar no select mostra o dele, não o do anterior.
watch(provider, (chosen) => {
  const saved = settings.value?.credentials[chosen]

  key.value = saved?.key ?? ''
  url.value = saved?.url ?? ''
  model.value = saved?.model ?? ''
  revealed.value = false

  models.value = model.value ? [{ id: model.value, label: model.value }] : []
  modelsError.value = ''

  loadModelsIfReady()
})

async function load() {
  loading.value = true

  try {
    settings.value = await $fetch<AiSettings>('/api/settings/ai')

    const active = settings.value.credentials[settings.value.provider]

    const sameProvider = provider.value === (settings.value.provider || NO_AI)

    provider.value = settings.value.provider || NO_AI
    key.value = active?.key ?? ''
    url.value = active?.url ?? ''
    model.value = active?.model ?? ''
    models.value = model.value ? [{ id: model.value, label: model.value }] : []
    modelsError.value = ''
    revealed.value = false

    if (sameProvider) loadModelsIfReady()
  } catch (err) {
    notify.failure(err, 'Não foi possível carregar a configuração.')
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) load()
})

async function save() {
  saving.value = true

  try {
    await $fetch('/api/settings/ai', {
      method: 'PUT',
      body: {
        provider: noAi.value ? null : provider.value,
        key: key.value || null,
        url: url.value || null,
        model: model.value || null
      }
    })

    await refreshNuxtData(AI_SETTINGS_KEY)

    open.value = false

    notify.success('Configuração salva')
  } catch (err) {
    notify.failure(err, 'Não foi possível salvar a configuração.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    wide
    title="Inteligência artificial"
    description="Quem escreve, revisa e corrige os testes. Vale para o acutis inteiro, não para um projeto."
    :loading="loading"
  >
    <template #body>
      <UFormField
        label="Provedor"
        required
        class="mb-4"
      >
        <USelect
          v-model="provider"
          :items="providerItems"
          :icon="providerIcon"
          class="w-full"
          data-testid="config-ia-provedor"
        />
      </UFormField>

      <p
        v-if="noAi"
        class="text-sm text-muted"
        data-testid="config-ia-desligada"
      >
        Sem provedor, o acutis grava e roda os testes normalmente. O que fica desabilitado é o que
        depende de modelo: a descrição em Gherkin, as sugestões de data-testid e a correção do teste
        que falhou.
      </p>

      <div
        v-if="claudeAgent"
        class="mb-4"
        data-testid="config-ia-claude-agent"
      >
        <p class="mb-3 text-sm text-muted">
          Este provedor não usa chave de API nem cobra por token: ele roda o
          <strong class="text-default">Claude Code</strong> instalado nesta máquina e fala pela
          assinatura já autenticada nele (Pro, Max, Team ou Enterprise), com o mesmo limite de uso
          que você tem no dia a dia.
        </p>

        <ol class="mb-3 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Instale o Claude Code na máquina que roda o acutis.</li>
          <li>Rode <code class="rounded bg-elevated px-1 py-0.5 text-default">claude login</code> no terminal e autorize no navegador.</li>
          <li>Escolha abaixo o modelo. Não há nada mais a preencher.</li>
        </ol>

        <p class="mb-3 text-sm text-muted">
          Por depender do binário local, este provedor não funciona com o backend em container nem
          em outra máquina.
        </p>

        <ULink
          :to="DOC_CLAUDE_CODE"
          target="_blank"
          class="inline-flex items-center gap-1 text-sm text-primary"
          data-testid="config-ia-claude-agent-documentacao"
        >
          Saiba mais na documentação do Claude Code
          <UIcon name="i-ic-round-open-in-new" />
        </ULink>
      </div>

      <UFormField
        v-if="!noAi && !claudeAgent"
        label="Chave de API"
        :required="keyRequired"
        :hint="keyRequired ? undefined : 'opcional'"
        description="Provedor que roda na sua máquina, como o Ollama, não pede chave."
        class="mb-4"
      >
        <UInput
          v-model="key"
          :type="revealed ? 'text' : 'password'"
          placeholder="Cole a chave do provedor escolhido"
          class="w-full"
          data-testid="config-ia-chave"
          @blur="loadModelsIfReady"
        >
          <template
            v-if="key"
            #trailing
          >
            <UButton
              :icon="revealed ? 'i-ic-round-visibility-off' : 'i-ic-round-visibility'"
              color="neutral"
              variant="link"
              :aria-label="revealed ? 'Esconder a chave' : 'Revelar a chave'"
              data-testid="config-ia-chave-revelar"
              @click="revealed = !revealed"
            />
          </template>
        </UInput>
        <template #help>
          Cada provedor guarda a sua. Apagar o campo apaga a chave guardada.
        </template>
      </UFormField>

      <UFormField
        v-if="!noAi && !claudeAgent"
        label="Endereço do provedor"
        hint="opcional"
        description="Onde o provedor responde. Preencha para apontar para uma máquina sua."
        class="mb-4"
      >
        <UInput
          v-model="url"
          :placeholder="defaultUrl"
          class="w-full"
          data-testid="config-ia-url"
          @blur="loadModelsIfReady"
        />
        <template #help>
          Em branco usa {{ defaultUrl }}.
        </template>
      </UFormField>

      <UFormField
        v-if="!noAi"
        label="Modelo"
        required
        description="Quem escreve o cenário, sugere os data-testid e conserta o teste que falhou."
        :error="modelsError || undefined"
      >
        <div class="flex gap-2">
          <USelectMenu
            v-model="model"
            :items="models.map(available => ({ label: available.label, value: available.id }))"
            value-key="value"
            :loading="loadingModels"
            create-item
            placeholder="Escolha o modelo do provedor"
            class="flex-1"
            data-testid="config-ia-modelo"
            @create="(name: string) => {
              models.push({ id: name, label: name })
              model = name
            }"
          />
          <UButton
            icon="i-ic-round-refresh"
            color="neutral"
            variant="soft"
            :loading="loadingModels"
            aria-label="Buscar os modelos do provedor"
            data-testid="config-ia-modelo-buscar"
            @click="loadModels"
          />
        </div>
        <template #help>
          A lista vem do próprio provedor. Buscar de novo depois de trocar a chave ou o endereço.
        </template>
      </UFormField>
    </template>

    <template #footer>
      <UButton
        label="Fechar"
        color="neutral"
        variant="ghost"
        data-testid="config-ia-fechar"
        @click="open = false"
      />
      <UButton
        label="Salvar"
        :loading="saving"
        data-testid="config-ia-salvar"
        @click="save"
      />
    </template>
  </BaseModal>
</template>
