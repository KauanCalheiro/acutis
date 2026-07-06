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
    :description="description"
  >
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
