<script setup lang="ts">
import { computed } from 'vue'
import type { PillIconName } from './pillIcon'

const { name, size } = defineProps<{
  name: PillIconName
  size: number
}>()

const viewBox = computed(() =>
  ['pause', 'resume', 'assert', 'hover', 'stop'].includes(name)
    ? '0 0 14 14'
    : '0 0 16 16'
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="viewBox"
    fill="none"
    aria-hidden="true"
  >
    <template v-if="name === 'pause'">
      <rect
        x="2.5"
        y="2"
        width="3.5"
        height="10"
        rx="1"
        fill="currentColor"
      />
      <rect
        x="8"
        y="2"
        width="3.5"
        height="10"
        rx="1"
        fill="currentColor"
      />
    </template>
    <path
      v-else-if="name === 'resume'"
      d="M3.5 2.5L11.5 7L3.5 11.5V2.5Z"
      fill="currentColor"
    />
    <template v-else-if="name === 'assert'">
      <circle
        cx="7"
        cy="7"
        r="5.25"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M4.5 7L6.5 9L9.5 5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>
    <path
      v-else-if="name === 'hover'"
      d="M3 1.5V10.5L5.5 8.2L7.5 12.5L9 11.8L7 7.5L11 7.5L3 1.5Z"
      fill="currentColor"
    />
    <rect
      v-else-if="name === 'stop'"
      x="2.5"
      y="2.5"
      width="9"
      height="9"
      rx="1.5"
      fill="currentColor"
    />
    <template v-else-if="name === 'exists'">
      <ellipse
        cx="8"
        cy="8"
        rx="6"
        ry="4.5"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <circle
        cx="8"
        cy="8"
        r="2"
        fill="currentColor"
      />
    </template>
    <template v-else-if="name === 'visible'">
      <path
        d="M2 8C2 8 4.5 3.5 8 3.5C11.5 3.5 14 8 14 8C14 8 11.5 12.5 8 12.5C4.5 12.5 2 8 2 8Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <circle
        cx="8"
        cy="8"
        r="2"
        fill="currentColor"
      />
    </template>
    <template v-else-if="name === 'hidden'">
      <path
        d="M2 2L14 14"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path
        d="M6.5 4.2C7 4.07 7.5 4 8 4C11.5 4 14 8 14 8C13.4 9 12.6 9.9 11.7 10.6M9.5 11.7C9 11.9 8.5 12 8 12C4.5 12 2 8 2 8C2.5 7 3.3 6.1 4.2 5.4"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>
    <template v-else-if="name === 'checked'">
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M5 8L7 10.5L11 5.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>
    <template v-else-if="name === 'disabled'">
      <rect
        x="5"
        y="7"
        width="7"
        height="6.5"
        rx="1"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M7 7V5.5C7 4.4 7.9 3.5 9 3.5V3.5C10.1 3.5 11 4.4 11 5.5V7"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <circle
        cx="9"
        cy="10"
        r="1"
        fill="currentColor"
      />
    </template>
    <path
      v-else-if="name === 'text'"
      d="M2 4.5H14M2 8H10M2 11.5H12"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <template v-else-if="name === 'value'">
      <path
        d="M10.5 2.5L13.5 5.5L5.5 13.5H2.5V10.5L10.5 2.5Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path
        d="M8.5 4.5L11.5 7.5"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </template>
    <template v-else-if="name === 'contains'">
      <circle
        cx="7"
        cy="7"
        r="4.5"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M10.5 10.5L13.5 13.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path
        d="M5 7H9M7 5V9"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>
    <template v-else-if="name === 'url'">
      <path
        d="M6.5 9.5C7.3 10.3 8.8 10.6 9.9 9.5L11.9 7.5C13 6.4 13 4.6 11.9 3.5C10.8 2.4 9 2.4 7.9 3.5L7 4.4"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path
        d="M9.5 6.5C8.7 5.7 7.2 5.4 6.1 6.5L4.1 8.5C3 9.6 3 11.4 4.1 12.5C5.2 13.6 7 13.6 8.1 12.5L9 11.6"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>
  </svg>
</template>
