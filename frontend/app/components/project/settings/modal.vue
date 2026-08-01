<script setup lang="ts">
interface ProjectSettingsModal {
  slug: string
  baseUrl: string | null
}

const { slug, baseUrl } = defineProps<ProjectSettingsModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  saved: []
}>()

const url = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return

  url.value = baseUrl ?? ''
  error.value = null
})

async function save() {
  saving.value = true
  error.value = null

  try {
    await $fetch(`/api/projects/${slug}/settings`, {
      method: 'PUT',
      body: { baseUrl: url.value.trim() }
    })
    open.value = false
    emit('saved')
  } catch (err) {
    error.value = extractServerError(err, 'Não foi possível salvar as configurações.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Configurações do projeto"
  >
    <template #body>
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

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :description="error"
        class="mt-4"
        data-testid="projeto-configuracoes-erro"
      />
    </template>

    <template #footer>
      <UButton
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
