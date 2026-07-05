<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const open = defineModel<boolean>('open', {
  default: false,
})

const emit = defineEmits<{
  saved: []
}>()

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'O nome é obrigatório.')
    .max(255, 'O nome não pode ter mais de 255 caracteres.'),
})

type Schema = z.output<typeof schema>

const state = reactive({
  name: '',
})

const saving = ref(false)
const serverError = ref<string>()

watch(() => state.name, () => {
  serverError.value = undefined
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true

  try {
    await $fetch('/api/projects', {
      method: 'POST',
      body: {
        name: event.data.name,
      },
    })
    open.value = false
    state.name = ''
    emit('saved')
  } catch (error) {
    const err = error as { data?: { data?: { errors?: Record<string, string[]> } } }
    serverError.value = err.data?.data?.errors?.name?.[0] ?? 'Não foi possível criar o projeto.'
  } finally {
    saving.value = false
  }
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
      <UForm
        id="projeto-form"
        :schema="schema"
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
        form="projeto-form"
        :loading="saving"
        data-testid="projeto-form-salvar"
      />
    </template>
  </UModal>
</template>
