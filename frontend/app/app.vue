<script setup>
const favicon = ref('/favicon.svg')

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { key: 'favicon', rel: 'icon', type: 'image/svg+xml', href: favicon }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: 'Acutis'
})

const appConfig = useAppConfig()
const colorMode = useColorMode()

function repaintFaviconWhenThemeColorsLand(framesLeftToWaitForTheme = 10) {
  const style = getComputedStyle(document.documentElement)
  const svg = logoSvg(style.getPropertyValue('--ui-primary'), style.getPropertyValue('--ui-bg'))
  const repainted = `data:image/svg+xml,${encodeURIComponent(svg)}`

  const themeStillHoldsTheOldColors = repainted === favicon.value

  if (themeStillHoldsTheOldColors && framesLeftToWaitForTheme > 0) {
    requestAnimationFrame(() => repaintFaviconWhenThemeColorsLand(framesLeftToWaitForTheme - 1))
    return
  }

  favicon.value = repainted
}

onMounted(() => repaintFaviconWhenThemeColorsLand())

watch(
  [
    () => appConfig.ui.colors.primary,
    () => colorMode.value
  ],
  () => nextTick(() => repaintFaviconWhenThemeColorsLand())
)
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
