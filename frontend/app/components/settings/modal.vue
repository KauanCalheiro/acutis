<script setup lang="ts">
interface AiCredential {
  key: string | null
  url: string | null
  model_cheapest: string | null
  model_smartest: string | null
}

interface AiSettings {
  provider: string
  credentials: Record<string, AiCredential>
  providers: string[]
  provider_urls: Record<string, string>
}

const open = defineModel<boolean>('open', {
  default: false
})

const toast = useToast()

const settings = ref<AiSettings | null>(null)
const provider = ref('')
const key = ref('')
const url = ref('')
const modelCheapest = ref('')
const modelSmartest = ref('')
const loading = ref(false)
const saving = ref(false)
const revealed = ref(false)

const providerItems = computed(() => (settings.value?.providers ?? []).map(name => ({
  label: name,
  value: name
})))

/** O endereço que vale com o campo vazio, para o placeholder dizer o que vai acontecer. */
const defaultUrl = computed(() => settings.value?.provider_urls[provider.value] ?? 'o endereço do provedor')

// Cada provedor guarda o seu cadastro: trocar no select mostra o dele, não o do anterior. Levar um
// para o outro apontaria a Anthropic para o endereço do Ollama.
watch(provider, (chosen) => {
  const saved = settings.value?.credentials[chosen]

  key.value = saved?.key ?? ''
  url.value = saved?.url ?? ''
  modelCheapest.value = saved?.model_cheapest ?? ''
  modelSmartest.value = saved?.model_smartest ?? ''
  revealed.value = false
})

async function load() {
  loading.value = true

  try {
    settings.value = await $fetch<AiSettings>('/api/settings/ai')

    const active = settings.value.credentials[settings.value.provider]

    provider.value = settings.value.provider
    key.value = active?.key ?? ''
    url.value = active?.url ?? ''
    modelCheapest.value = active?.model_cheapest ?? ''
    modelSmartest.value = active?.model_smartest ?? ''
    revealed.value = false
  } catch (err) {
    toast.add({
      title: extractServerError(err, 'Não foi possível carregar a configuração.'),
      color: 'error',
      icon: 'i-ic-round-error'
    })
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
        provider: provider.value,
        key: key.value || null,
        url: url.value || null,
        modelCheapest: modelCheapest.value || null,
        modelSmartest: modelSmartest.value || null
      }
    })

    // Fecha na hora: quem confirma o salvamento é o toast, e reabrir recarrega o que foi gravado.
    open.value = false

    toast.add({
      title: 'Configuração salva',
      color: 'success',
      icon: 'i-ic-round-check-circle'
    })
  } catch (err) {
    toast.add({
      title: extractServerError(err, 'Não foi possível salvar a configuração.'),
      color: 'error',
      icon: 'i-ic-round-error'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Inteligência artificial"
    description="Quem escreve, revisa e corrige os testes. Vale para o acutis inteiro, não para um projeto."
    :loading="loading"
  >
    <template #body>
      <UFormField
        label="Provedor"
        class="mb-4"
      >
        <USelect
          v-model="provider"
          :items="providerItems"
          class="w-full"
          data-testid="config-ia-provedor"
        />
      </UFormField>

      <UFormField
        label="Chave de API"
        hint="opcional"
        description="Provedor que roda na sua máquina, como o Ollama, não pede chave."
        class="mb-4"
      >
        <UInput
          v-model="key"
          :type="revealed ? 'text' : 'password'"
          placeholder="Cole a chave do provedor escolhido"
          class="w-full"
          data-testid="config-ia-chave"
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
        />
        <template #help>
          Em branco usa {{ defaultUrl }}.
        </template>
      </UFormField>

      <UFormField
        label="Modelo de alto custo"
        hint="opcional"
        description="Usado onde a resposta precisa ser a melhor: correção do teste que falhou."
        class="mb-4"
      >
        <UInput
          v-model="modelSmartest"
          placeholder="Nome do modelo no provedor"
          class="w-full"
          data-testid="config-ia-modelo-alto"
        />
        <template #help>
          Em branco usa o modelo padrão do provedor.
        </template>
      </UFormField>

      <UFormField
        label="Modelo de baixo custo"
        hint="opcional"
        description="Usado no resto: escrita do cenário, validação e sugestão de data-testid."
      >
        <UInput
          v-model="modelCheapest"
          placeholder="Nome do modelo no provedor"
          class="w-full"
          data-testid="config-ia-modelo-baixo"
        />
        <template #help>
          Em branco usa o modelo padrão do provedor.
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
