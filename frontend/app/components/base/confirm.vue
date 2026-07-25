<script setup lang="ts">
interface BaseConfirm {
  title: string
  description?: string
  confirmLabel?: string
  confirmColor?: 'primary' | 'error'
  confirmTestid?: string
  loading?: boolean
}

const {
  title,
  description = '',
  confirmLabel = 'Confirmar',
  confirmColor = 'primary',
  confirmTestid = 'confirmar',
  loading = false
} = defineProps<BaseConfirm>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  confirm: []
}>()
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="title"
  >
    <template #body>
      <div class="flex min-h-24 items-center justify-center text-center">
        <p class="w-full text-lg text-muted break-words">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
    </template>

    <template #footer>
      <UButton
        label="Cancelar"
        color="neutral"
        variant="ghost"
        data-testid="confirmar-cancelar"
        @click="open = false"
      />
      <UButton
        :label="confirmLabel"
        :color="confirmColor"
        :loading="loading"
        :data-testid="confirmTestid"
        @click="emit('confirm')"
      />
    </template>
  </BaseModal>
</template>
