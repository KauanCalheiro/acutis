<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { createProjectSchema, type CreateProject } from '#shared/schemas/project'

interface ProjectRenameModal {
  slug: string
  name: string
}

const { slug, name } = defineProps<ProjectRenameModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  renamed: [slug: string]
}>()

const state = reactive({
  name
})

watch(open, (value) => {
  if (value) state.name = name
})

const saving = ref(false)
const serverError = ref<string>()

watch(() => state.name, () => {
  serverError.value = undefined
})

async function onSubmit(event: FormSubmitEvent<CreateProject>) {
  saving.value = true

  try {
    const updated = await $fetch<{ slug: string }>(`/api/projects/${slug}`, {
      method: 'PUT',
      body: {
        name: event.data.name
      }
    })
    open.value = false
    emit('renamed', updated.slug)
  } catch (error) {
    const err = error as { data?: { data?: { errors?: Record<string, string[]> } } }
    serverError.value = err.data?.data?.errors?.name?.[0] ?? 'Não foi possível renomear o projeto.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Renomear projeto"
  >
    <template #body>
      <UForm
        id="projeto-renomear-form"
        :schema="createProjectSchema"
        :state="state"
        data-testid="projeto-form"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Nome"
          name="name"
          :error="serverError"
        >
          <UInput
            v-model="state.name"
            data-testid="projeto-form-nome"
            placeholder="Nome do projeto"
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
        form="projeto-renomear-form"
        :loading="saving"
        data-testid="projeto-form-salvar"
      />
    </template>
  </BaseModal>
</template>
