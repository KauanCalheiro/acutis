<script setup lang="ts">
interface ProjectSettingsModal {
  slug: string
  baseUrl: string | null
}

const {
  slug,
  baseUrl
} = defineProps<ProjectSettingsModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  saved: []
}>()

const url = ref('')
const saving = ref(false)
const skipping = ref(false)
const notify = useNotify()

watch(open, (isOpen) => {
  if (!isOpen) return

  url.value = baseUrl ?? ''
})

async function skip() {
  skipping.value = true

  try {
    await $fetch(`/api/projects/${slug}/settings/skip`, { method: 'POST' })
    open.value = false
    emit('saved')
  } catch (err) {
    notify.failure(err, 'Não foi possível deixar a URL em branco.')
  } finally {
    skipping.value = false
  }
}

async function save() {
  saving.value = true

  try {
    await $fetch(`/api/projects/${slug}/settings`, {
      method: 'PUT',
      body: { baseUrl: url.value.trim() }
    })
    open.value = false
    emit('saved')

    notify.success('Configurações salvas')
  } catch (err) {
    notify.failure(err, 'Não foi possível salvar as configurações.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :dismissable="false"
    title="Configurações do projeto"
  >
    <template #body>
      <UAlert
        color="neutral"
        variant="soft"
        icon="i-ic-round-info"
        description="A URL é um facilitador: com ela o navegador já abre no sistema ao gravar. Sem ela, a gravação sempre começa numa página em branco e você digita o endereço na mão."
        class="mb-4"
        data-testid="projeto-configuracoes-obrigatorio"
      />

      <UFormField
        label="URL base"
        description="Endereço do sistema que este projeto testa. É onde o navegador abre ao gravar, e a base que os testes usam ao rodar."
      >
        <UInput
          v-model="url"
          class="w-full"
          placeholder="https://sistema.exemplo.com/app"
          data-testid="projeto-configuracoes-base-url"
          @keyup.enter="save"
        />
      </UFormField>
    </template>

    <template #footer>
      <UButton
        label="Deixar em branco"
        color="neutral"
        variant="ghost"
        :loading="skipping"
        data-testid="projeto-configuracoes-pular"
        @click="skip"
      />
      <UButton
        label="Salvar"
        :loading="saving"
        :disabled="!url.trim()"
        data-testid="projeto-configuracoes-salvar"
        @click="save"
      />
    </template>
  </BaseModal>
</template>
