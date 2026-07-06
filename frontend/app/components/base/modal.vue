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
  closable = false
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
      title: 'text-xl',
      body: '[mask-image:linear-gradient(to_bottom,transparent,black_3rem,black_calc(100%-3rem),transparent)]',
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
