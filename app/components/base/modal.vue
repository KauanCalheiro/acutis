<script setup lang="ts">
interface BaseModal {
  title?: string
  description?: string
  dismissable?: boolean
  closable?: boolean
  wide?: boolean
  loading?: boolean
}

const {
  title = '',
  description = '',
  dismissable = true,
  closable = false,
  wide = false,
  loading = false
} = defineProps<BaseModal>()

const open = defineModel<boolean>('open', {
  default: false
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="loading ? '' : title"
    :description="loading ? '' : description"
    :dismissible="dismissable"
    :close="!loading && closable"
    :ui="{
      content: wide ? 'divide-y-0 sm:max-w-5xl' : 'divide-y-0',
      title: 'text-xl p-2',
      body: 'scroll-fade',
      footer: 'justify-end'
    }"
  >
    <template
      v-if="!loading && $slots.header"
      #header
    >
      <slot name="header" />
    </template>

    <template #body>
      <slot name="body" />
    </template>

    <template
      v-if="!loading && $slots.footer"
      #footer
    >
      <slot name="footer" />
    </template>
  </UModal>
</template>
