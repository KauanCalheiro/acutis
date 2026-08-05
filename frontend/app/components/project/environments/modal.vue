<script setup lang="ts">
import type { EditableVar, Environment, EnvironmentList, EnvironmentVar } from '~/types/project'

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
const creating = ref(false)
const newName = ref('')
const confirmingRemove = ref(false)
const confirmingClose = ref(false)
const loading = ref(false)
const saving = ref(false)
const toast = useToast()

function complain(message: string) {
  toast.add({
    title: message,
    color: 'error',
    icon: 'i-ic-round-error'
  })
}

const environments = computed(() => list.value?.environments ?? [])
const current = computed(() => environments.value.find(environment => environment.slug === selected.value) ?? null)

const snapshot = ref('')
const dirty = computed(() => Boolean(current.value) && edited() !== snapshot.value)

function edited() {
  return JSON.stringify({
    name: name.value,
    vars: vars.value
  })
}

function editable(variable: EnvironmentVar): EditableVar {
  return {
    key: variable.key,
    value: variable.value ?? '',
    secret: variable.secret,
    pending: variable.pending
  }
}

function select(environment: Environment) {
  selected.value = environment.slug
  name.value = environment.name
  vars.value = environment.vars.map(editable)
  confirmingRemove.value = false
  confirmingClose.value = false
  snapshot.value = edited()
}

function revert() {
  if (current.value) select(current.value)
}

function dismissConfirmations(event: MouseEvent) {
  const target = event.target as HTMLElement

  if (!target.closest('[data-testid="ambientes-remover"]')) confirmingRemove.value = false
  if (!target.closest('[data-testid="ambientes-fechar"]')) confirmingClose.value = false

  if (!target.closest('[data-testid="ambientes-criar"], [data-testid="ambientes-novo-nome"]')) {
    creating.value = false
    newName.value = ''
  }
}

function close() {
  if (dirty.value && !confirmingClose.value) {
    confirmingClose.value = true

    return
  }

  open.value = false
}

async function load() {
  loading.value = true

  try {
    const environmentList = await $fetch<EnvironmentList>(`/api/projects/${slug}/environments`)

    list.value = environmentList

    const active = environmentList.environments.find(environment => environment.slug === environmentList.active)
    const target = active ?? environmentList.environments[0]

    if (target) select(target)
    else selected.value = null
  } catch (err) {
    complain(extractServerError(err, 'Não foi possível carregar os ambientes.'))
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) load()
})

async function act(action: () => Promise<unknown>, done: string, failure: string) {
  saving.value = true

  try {
    await action()
    await load()
    emit('saved')

    toast.add({
      title: done,
      color: 'success',
      icon: 'i-ic-round-check-circle'
    })
  } catch (err) {
    complain(extractServerError(err, failure))
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
    'Ambiente criado',
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
    'Ambiente salvo',
    'Não foi possível salvar o ambiente.'
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
    'Ambiente removido',
    'Não foi possível remover o ambiente.'
  )

  confirmingRemove.value = false
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    wide
    :dismissable="!dirty"
    title="Ambientes"
    description="Cada ambiente diz contra o que os cenários rodam. Os arquivos ficam fora do git, então cada máquina tem os seus."
  >
    <template #body>
      <div @click.capture="dismissConfirmations">
        <div class="flex flex-col gap-4 sm:flex-row">
          <div class="flex flex-col gap-3 sm:w-56 shrink-0">
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
              @keyup.esc="creating = false"
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
              :known-keys="list?.known_keys"
              testid="ambientes-variaveis"
            />

            <div class="flex flex-wrap gap-2">
              <UButton
                label="Salvar"
                :loading="saving"
                :disabled="!dirty"
                data-testid="ambientes-salvar"
                @click="save"
              />
              <UButton
                v-if="dirty"
                label="Reverter"
                color="neutral"
                variant="soft"
                data-testid="ambientes-reverter"
                @click="revert"
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
      </div>
    </template>

    <template #footer>
      <p
        v-if="confirmingClose"
        class="mr-auto self-center text-sm text-warning"
        data-testid="ambientes-fechar-aviso"
      >
        Há alterações não salvas neste ambiente.
      </p>

      <UButton
        :label="confirmingClose ? 'Descartar alterações' : 'Fechar'"
        :color="confirmingClose ? 'warning' : 'neutral'"
        :variant="confirmingClose ? 'soft' : 'ghost'"
        data-testid="ambientes-fechar"
        @click="close"
      />
    </template>
  </BaseModal>
</template>
