<script setup lang="ts">
interface BaseModal {
  title?: string
  description?: string
  dismissable?: boolean
  closable?: boolean
  wide?: boolean
}

const {
  title = '',
  description = '',
  dismissable = true,
  closable = false,
  wide = false
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
      content: wide ? 'divide-y-0 sm:max-w-5xl' : 'divide-y-0',
      title: 'text-xl',
      body: 'scroll-fade',
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
