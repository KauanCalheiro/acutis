<script setup lang="ts">
import type { FormSubmitEvent, TabsItem } from '@nuxt/ui'
import { cloneProjectSchema, createProjectSchema, type CloneProject, type CreateProject } from '#shared/schemas/project'

const open = defineModel<boolean>('open', {
  default: false,
})

const emit = defineEmits<{
  saved: []
}>()

const tabs: TabsItem[] = [
  {
    label: 'Template',
    value: 'template',
  },
  {
    label: 'Git',
    value: 'git',
  },
]

const tab = ref('template')

const templateState = reactive({
  name: '',
})

const cloneState = reactive({
  url: '',
  name: '',
  branch: '',
  auth: 'public' as CloneProject['auth'],
  token: '',
  ssh_key: '',
})

const authItems = [
  {
    label: 'Público',
    value: 'public',
  },
  {
    label: 'Token',
    value: 'token',
  },
  {
    label: 'Chave SSH',
    value: 'ssh_key',
  },
]

const saving = ref(false)
const serverError = ref<string>()

const probe = ref<'idle' | 'checking' | 'public' | 'private'>('idle')
let probeTimer: ReturnType<typeof setTimeout> | undefined

watch(() => cloneState.url, (url) => {
  probe.value = 'idle'
  clearTimeout(probeTimer)
  if (url.trim()) probeTimer = setTimeout(probeRepository, 500)
})

function preselectAuth(url: string): CloneProject['auth'] {
  if (url.startsWith('https://') || url.startsWith('http://')) return 'token'
  if (url.startsWith('git@') || url.startsWith('ssh://')) return 'ssh_key'
  return cloneState.auth
}

async function probeRepository() {
  const url = cloneState.url.trim()
  probe.value = 'checking'

  try {
    const result = await $fetch<{ public: boolean }>('/api/projects/probe', {
      method: 'POST',
      body: {
        url,
      },
    })
    if (url !== cloneState.url.trim()) return

    probe.value = result.public ? 'public' : 'private'
    cloneState.auth = result.public ? 'public' : preselectAuth(url)
  } catch {
    if (url === cloneState.url.trim()) probe.value = 'idle'
  }
}

watch([() => templateState.name, () => cloneState.url, () => cloneState.name, tab], () => {
  serverError.value = undefined
})

function extractServerError(error: unknown): string {
  const err = error as { data?: { data?: { message?: string, errors?: Record<string, string[]> } } }
  const errors = err.data?.data?.errors

  return errors?.[Object.keys(errors)[0] ?? '']?.[0]
    ?? err.data?.data?.message
    ?? 'Não foi possível criar o projeto.'
}

async function save(request: Promise<unknown>) {
  saving.value = true

  try {
    await request
    open.value = false
    templateState.name = ''
    cloneState.url = ''
    cloneState.name = ''
    cloneState.branch = ''
    cloneState.auth = 'public'
    cloneState.token = ''
    cloneState.ssh_key = ''
    emit('saved')
  } catch (error) {
    serverError.value = extractServerError(error)
  } finally {
    saving.value = false
  }
}

function onSubmitTemplate(event: FormSubmitEvent<CreateProject>) {
  return save($fetch('/api/projects', {
    method: 'POST',
    body: {
      name: event.data.name,
    },
  }))
}

function onSubmitClone(event: FormSubmitEvent<CloneProject>) {
  return save($fetch('/api/projects/clone', {
    method: 'POST',
    body: {
      url: event.data.url,
      name: event.data.name || undefined,
      branch: event.data.branch || undefined,
      auth: event.data.auth,
      token: event.data.token || undefined,
      ssh_key: event.data.ssh_key || undefined,
    },
  }))
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Criar projeto"
    :ui="{
      content: 'divide-y-0',
      footer: 'justify-end',
    }"
  >
    <template #body>
      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        class="mb-4 w-full"
      >
        <template #default="{ item }">
          <span :data-testid="`projeto-form-tab-${item.value}`">
            {{ item.label }}
          </span>
        </template>
      </UTabs>

      <UForm
        v-if="tab === 'template'"
        id="projeto-form"
        :schema="createProjectSchema"
        :state="templateState"
        data-testid="projeto-form"
        class="flex flex-col gap-4"
        @submit="onSubmitTemplate"
      >
        <UFormField
          label="Nome"
          name="name"
          :error="serverError"
        >
          <UInput
            v-model="templateState.name"
            data-testid="projeto-form-nome"
            placeholder="Nome do projeto"
            class="w-full"
          />
        </UFormField>
      </UForm>

      <UForm
        v-else
        id="projeto-form"
        :schema="cloneProjectSchema"
        :state="cloneState"
        data-testid="projeto-form"
        class="flex flex-col gap-4"
        @submit="onSubmitClone"
      >
        <UFormField
          label="URL do repositório"
          name="url"
          :error="serverError"
        >
          <UInput
            v-model="cloneState.url"
            :loading="probe === 'checking'"
            data-testid="projeto-form-url"
            placeholder="https://github.com/usuario/repositorio.git"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Nome"
          name="name"
          hint="Opcional"
        >
          <UInput
            v-model="cloneState.name"
            data-testid="projeto-form-git-nome"
            placeholder="Derivado da URL"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Branch"
          name="branch"
          hint="Opcional"
        >
          <UInput
            v-model="cloneState.branch"
            data-testid="projeto-form-branch"
            placeholder="Branch padrão do repositório"
            class="w-full"
          />
        </UFormField>

        <UBadge
          v-if="probe === 'public'"
          color="success"
          variant="soft"
          icon="i-ic-round-public"
          data-testid="projeto-form-publico"
        >
          Repositório público — sem autenticação
        </UBadge>

        <UFormField
          v-else
          label="Autenticação"
          name="auth"
        >
          <USelect
            v-model="cloneState.auth"
            :items="authItems"
            data-testid="projeto-form-auth"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="cloneState.auth === 'token'"
          label="Token"
          name="token"
        >
          <UInput
            v-model="cloneState.token"
            type="password"
            data-testid="projeto-form-token"
            placeholder="Token de acesso ao repositório"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="cloneState.auth === 'ssh_key'"
          label="Chave SSH"
          name="ssh_key"
        >
          <UTextarea
            v-model="cloneState.ssh_key"
            :rows="5"
            data-testid="projeto-form-ssh"
            placeholder="Chave privada com acesso ao repositório"
            class="w-full"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <UButton
        label="Cancelar"
        color="neutral"
        variant="ghost"
        data-testid="projeto-form-cancelar"
        @click="open = false"
      />
      <UButton
        label="Salvar"
        type="submit"
        form="projeto-form"
        :loading="saving"
        data-testid="projeto-form-salvar"
      />
    </template>
  </UModal>
</template>
