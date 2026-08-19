<script setup lang="ts">
import { logoPath } from '~/utils/logo'
</script>

<template>
  <svg
    viewBox="0 0 160 160"
    fill="none"
    stroke="currentColor"
    stroke-width="8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="logoPath" />
  </svg>
</template>
