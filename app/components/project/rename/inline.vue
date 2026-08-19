<script setup lang="ts">
interface ProjectRenameInline {
  slug: string
  name: string
}

const { slug, name } = defineProps<ProjectRenameInline>()

const emit = defineEmits<{
  renamed: [slug: string]
}>()

const notify = useNotify()
const editing = ref(false)
const draft = ref(name)
const saving = ref(false)

function edit() {
  draft.value = name
  editing.value = true
}

function cancel() {
  editing.value = false
}

async function confirm() {
  const wanted = draft.value.trim()

  if (wanted === '' || wanted === name) return cancel()

  saving.value = true

  try {
    const updated = await $fetch<{ slug: string }>(`/api/projects/${slug}`, {
      method: 'PUT',
      body: {
        name: wanted
      }
    })

    editing.value = false
    emit('renamed', updated.slug)
  } catch (error) {
    notify.failure(error, 'Não foi possível renomear o projeto.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    v-if="editing"
    class="flex items-center gap-2"
  >
    <UInput
      v-model="draft"
      autofocus
      class="grow"
      data-testid="projeto-nome-campo"
      @keydown.enter="confirm"
      @keydown.esc="cancel"
    />
    <BaseButtonIcon
      icon="i-ic-round-check"
      label="Confirmar"
      color="success"
      variant="soft"
      :loading="saving"
      data-testid="projeto-nome-confirmar"
      @click="confirm"
    />
    <BaseButtonIcon
      icon="i-ic-round-close"
      label="Cancelar"
      color="neutral"
      variant="soft"
      :disabled="saving"
      data-testid="projeto-nome-cancelar"
      @click="cancel"
    />
  </div>

  <UTooltip
    v-else
    text="Clique para renomear"
    :delay-duration="0"
    arrow
  >
    <h1
      class="text-3xl font-bold truncate cursor-pointer"
      data-testid="projeto-nome"
      @click="edit"
    >
      {{ name }}
    </h1>
  </UTooltip>
</template>
