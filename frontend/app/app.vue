<script setup>
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: 'Acutis'
})
</script>

<template>
  <UApp>
    <div class="flex min-h-screen">
      <Navbar />
      <main class="min-w-0 flex-1">
        <NuxtPage />
      </main>
    </div>
  </UApp>
</template>
