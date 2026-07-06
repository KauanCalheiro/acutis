<script setup lang="ts">
interface BaseModal {
  title?: string
  description?: string
  dismissable?: boolean
  closable?: boolean
}

const {
  title = '',
  description = '',
  dismissable = true,
  closable = true
} = defineProps<BaseModal>()

const open = defineModel<boolean>('open', {
  default: false
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="description"
    :dismissible="dismissable"
    :close="closable"
    :ui="{
      content: 'divide-y-0',
      footer: 'justify-end'
    }"
  >
    <template
      v-if="$slots.header"
      #header
    >
      <slot name="header" />
    </template>

    <template #body>
      <slot name="body" />
    </template>

    <template
      v-if="$slots.footer"
      #footer
    >
      <slot name="footer" />
    </template>
  </UModal>
</template>
