<script setup lang="ts">
import type { Dotenv, EditableVar, Environment, EnvironmentList, EnvironmentVar } from '~/types/project'

interface ProjectEnvironmentsModal {
  slug: string
}

const { slug } = defineProps<ProjectEnvironmentsModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  saved: []
}>()

const list = ref<EnvironmentList | null>(null)
const selected = ref<string | null>(null)
const name = ref('')
const vars = ref<EditableVar[]>([])
const dotenv = ref<EditableVar[]>([])
const tab = ref('ambientes')
const creating = ref(false)
const newName = ref('')
const confirmingRemove = ref(false)
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

const environments = computed(() => list.value?.environments ?? [])
const current = computed(() => environments.value.find(environment => environment.slug === selected.value) ?? null)

const tabs = [
  {
    value: 'ambientes',
    label: 'Ambientes',
    icon: 'i-ic-round-layers'
  },
  {
    value: 'dotenv',
    label: '.env do projeto',
    icon: 'i-ic-round-vpn-key'
  }
]

function editable(variable: EnvironmentVar): EditableVar {
  return {
    key: variable.key,
    value: variable.secret ? '' : (variable.value ?? ''),
    secret: variable.secret,
    pending: variable.pending
  }
}

function select(environment: Environment) {
  selected.value = environment.slug
  name.value = environment.name
  vars.value = environment.vars.map(editable)
  confirmingRemove.value = false
}

async function load() {
  loading.value = true
  error.value = null

  try {
    const [environmentList, projectDotenv] = await Promise.all([
      $fetch<EnvironmentList>(`/api/projects/${slug}/environments`),
      $fetch<Dotenv>(`/api/projects/${slug}/env`)
    ])

    list.value = environmentList
    dotenv.value = projectDotenv.vars.map(editable)

    const active = environmentList.environments.find(environment => environment.slug === environmentList.active)
    const target = active ?? environmentList.environments[0]

    if (target) select(target)
    else selected.value = null
  } catch (err) {
    error.value = extractServerError(err, 'Não foi possível carregar os ambientes.')
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) load()
})

async function act(action: () => Promise<unknown>, message: string) {
  saving.value = true
  error.value = null

  try {
    await action()
    await load()
    emit('saved')
  } catch (err) {
    error.value = extractServerError(err, message)
  } finally {
    saving.value = false
  }
}

async function create() {
  const label = newName.value.trim()

  if (!label) return

  await act(
    async () => {
      const created = await $fetch<Environment>(`/api/projects/${slug}/environments`, {
        method: 'POST',
        body: { name: label }
      })

      selected.value = created.slug
    },
    'Não foi possível criar o ambiente.'
  )

  newName.value = ''
  creating.value = false
}

function save() {
  if (!selected.value) return

  return act(
    () => $fetch(`/api/projects/${slug}/environments/${selected.value}`, {
      method: 'PUT',
      body: {
        name: name.value.trim(),
        vars: vars.value.map(variable => ({
          key: variable.key.trim(),
          value: variable.value === '' ? null : variable.value,
          secret: variable.secret
        }))
      }
    }),
    'Não foi possível salvar o ambiente.'
  )
}

function activate(environment: Environment) {
  return act(
    () => $fetch(`/api/projects/${slug}/environments/${environment.slug}/activate`, { method: 'POST' }),
    'Não foi possível ativar o ambiente.'
  )
}

async function remove() {
  if (!current.value) return

  if (!confirmingRemove.value) {
    confirmingRemove.value = true

    return
  }

  const removed = current.value.slug

  await act(
    async () => {
      await $fetch(`/api/projects/${slug}/environments/${removed}`, { method: 'DELETE' })
      selected.value = null
    },
    'Não foi possível remover o ambiente.'
  )

  confirmingRemove.value = false
}

function saveDotenv() {
  return act(
    () => $fetch(`/api/projects/${slug}/env`, {
      method: 'PUT',
      body: {
        vars: dotenv.value.map(variable => ({
          key: variable.key.trim(),
          value: variable.value === '' ? null : variable.value
        }))
      }
    }),
    'Não foi possível salvar o .env.'
  )
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    wide
    title="Ambientes"
    description="Cada ambiente diz contra o que os cenários rodam. O valor marcado como segredo nunca vai para o git — fica só no .env."
  >
    <template #body>
      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        class="w-full"
      >
        <template #default="{ item }">
          <span :data-testid="`ambientes-aba-${item.value}`">{{ item.label }}</span>
        </template>
      </UTabs>

      <div
        v-if="tab === 'ambientes'"
        class="mt-4 flex flex-col gap-4 sm:flex-row"
      >
        <div class="flex flex-col gap-1 sm:w-56 shrink-0">
          <UButton
            v-for="environment in environments"
            :key="environment.slug"
            :label="environment.name"
            :color="environment.slug === selected ? 'primary' : 'neutral'"
            :variant="environment.slug === selected ? 'soft' : 'ghost'"
            :trailing-icon="environment.slug === list?.active ? 'i-ic-round-check-circle' : undefined"
            class="justify-between"
            :data-testid="`ambientes-selecionar-${environment.slug}`"
            @click="select(environment)"
          />

          <UInput
            v-if="creating"
            v-model="newName"
            autofocus
            placeholder="Nome do ambiente"
            data-testid="ambientes-novo-nome"
            @keyup.enter="create"
          />
          <UButton
            :icon="creating ? 'i-ic-round-check' : 'i-ic-round-add'"
            :label="creating ? 'Criar' : 'Novo ambiente'"
            color="neutral"
            variant="soft"
            :loading="saving"
            :disabled="creating && !newName.trim()"
            data-testid="ambientes-criar"
            @click="creating ? create() : (creating = true)"
          />
        </div>

        <div
          v-if="current"
          class="flex-1 flex flex-col gap-4 min-w-0"
        >
          <UFormField label="Nome">
            <UInput
              v-model="name"
              class="w-full"
              data-testid="ambientes-nome"
            />
          </UFormField>

          <ProjectEnvironmentsVars
            v-model="vars"
            secrets
            :known-keys="list?.known_keys"
            :pointer-keys="list?.dotenv_keys"
            testid="ambientes-variaveis"
          />

          <div class="flex flex-wrap gap-2">
            <UButton
              label="Salvar"
              :loading="saving"
              data-testid="ambientes-salvar"
              @click="save"
            />
            <UButton
              v-if="current.slug !== list?.active"
              label="Ativar"
              color="neutral"
              variant="soft"
              :loading="saving"
              data-testid="ambientes-ativar"
              @click="activate(current)"
            />
            <UButton
              :label="confirmingRemove ? 'Confirmar remoção' : 'Remover'"
              color="error"
              :variant="confirmingRemove ? 'solid' : 'ghost'"
              :loading="saving"
              data-testid="ambientes-remover"
              @click="remove"
            />
          </div>
        </div>

        <BaseEmpty
          v-else-if="!loading"
          icon="i-ic-round-layers"
          testid="ambientes-vazio"
          title="Nenhum ambiente ainda"
          description="Crie o primeiro ambiente para separar desenvolvimento, homologação e produção. Ele já nasce com o que o projeto tem configurado hoje."
        />
      </div>

      <div
        v-else
        class="mt-4 flex flex-col gap-4"
      >
        <p class="text-sm text-muted">
          Este arquivo fica fora do git. É aqui que mora o valor de cada segredo que os ambientes apontam — inclusive os que ainda estão em branco.
        </p>

        <ProjectEnvironmentsVars
          v-model="dotenv"
          :known-keys="list?.known_keys"
          testid="dotenv-variaveis"
        />

        <UButton
          label="Salvar"
          class="self-start"
          :loading="saving"
          data-testid="dotenv-salvar"
          @click="saveDotenv"
        />
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :description="error"
        class="mt-4"
        data-testid="ambientes-erro"
      />
    </template>

    <template #footer>
      <UButton
        label="Fechar"
        color="neutral"
        variant="ghost"
        data-testid="ambientes-fechar"
        @click="open = false"
      />
    </template>
  </BaseModal>
</template>
