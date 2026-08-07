<script setup lang="ts">
interface AiSettings {
  provider: string
  key_set: boolean
  providers: string[]
}

const open = defineModel<boolean>('open', {
  default: false
})

const toast = useToast()

const settings = ref<AiSettings | null>(null)
const provider = ref('')
const key = ref('')
const loading = ref(false)
const saving = ref(false)

const providerItems = computed(() => (settings.value?.providers ?? []).map(name => ({
  label: name,
  value: name
})))

async function load() {
  loading.value = true

  try {
    settings.value = await $fetch<AiSettings>('/api/settings/ai')
    provider.value = settings.value.provider
    key.value = ''
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
        key: key.value || undefined
      }
    })

    await load()

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

      <UFormField label="Chave de API">
        <UInput
          v-model="key"
          type="password"
          placeholder="Cole a chave do provedor escolhido"
          class="w-full"
          data-testid="config-ia-chave"
        />
        <template #help>
          <span
            v-if="settings?.key_set"
            class="text-success"
            data-testid="config-ia-chave-definida"
          >
            Já existe uma chave guardada. Deixe em branco para mantê-la.
          </span>
          <span v-else>
            Nenhuma chave guardada ainda; sem ela, valem as variáveis de ambiente do backend.
          </span>
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
