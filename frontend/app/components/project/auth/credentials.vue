<script setup lang="ts">
interface ProjectAuthCredentials {
  slug: string
}

const { slug } = defineProps<ProjectAuthCredentials>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  saved: []
}>()

const username = ref('')
const password = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return

  username.value = ''
  password.value = ''
  error.value = null
})

async function save() {
  saving.value = true
  error.value = null

  try {
    await $fetch(`/api/projects/${slug}/auth/credentials`, {
      method: 'POST',
      body: { username: username.value, password: password.value }
    })
    open.value = false
    emit('saved')
  } catch {
    error.value = 'Não foi possível salvar as credenciais. Tente novamente.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :dismissable="false"
    title="Credenciais do login"
  >
    <template #body>
      <div
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

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          :description="error"
          data-testid="auth-credenciais-erro"
        />
      </div>
    </template>

    <template #footer>
      <UButton
        label="Cancelar"
        color="neutral"
        variant="ghost"
        data-testid="auth-credenciais-cancelar"
        @click="open = false"
      />
      <UButton
        label="Salvar e executar"
        :loading="saving"
        :disabled="!username || !password"
        data-testid="auth-credenciais-salvar"
        @click="save"
      />
    </template>
  </BaseModal>
</template>
