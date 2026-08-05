<script setup lang="ts">
interface ProjectSettingsModal {
  slug: string
  baseUrl: string | null
  required?: boolean
}

const {
  slug,
  baseUrl,
  required = false
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
const toast = useToast()

function complain(message: string) {
  toast.add({
    title: message,
    color: 'error',
    icon: 'i-ic-round-error'
  })
}

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
    complain(extractServerError(err, 'Não foi possível deixar a URL em branco.'))
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

    toast.add({
      title: 'Configurações salvas',
      color: 'success',
      icon: 'i-ic-round-check-circle'
    })
  } catch (err) {
    complain(extractServerError(err, 'Não foi possível salvar as configurações.'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :dismissable="!required"
    title="Configurações do projeto"
  >
    <template #body>
      <UAlert
        v-if="required"
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
        v-if="required"
        label="Deixar em branco"
        color="neutral"
        variant="ghost"
        :loading="skipping"
        data-testid="projeto-configuracoes-pular"
        @click="skip"
      />
      <UButton
        v-else
        label="Cancelar"
        color="neutral"
        variant="ghost"
        data-testid="projeto-configuracoes-cancelar"
        @click="open = false"
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
