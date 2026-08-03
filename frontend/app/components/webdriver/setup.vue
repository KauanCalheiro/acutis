<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const os = ref('macos')

onMounted(() => {
  const agent = navigator.userAgent
  if (/Windows/i.test(agent)) os.value = 'windows'
  else if (!/Mac/i.test(agent)) os.value = 'linux'
})

const tabs: TabsItem[] = [
  {
    label: 'macOS',
    value: 'macos'
  },
  {
    label: 'Linux',
    value: 'linux'
  },
  {
    label: 'Windows',
    value: 'windows'
  }
]

const route = useRoute()
const origin = useRequestURL().origin
const currentUrl = computed(() => `${origin}${route.fullPath}`)

const commands = computed<Record<string, string>>(() => ({
  macos: `open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.acutis/chrome" "${currentUrl.value}"`,
  linux: `google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.acutis/chrome" "${currentUrl.value}" &`,
  windows: `Start-Process "chrome" -ArgumentList "--remote-debugging-port=9222","--user-data-dir=$env:USERPROFILE\\.acutis\\chrome","${currentUrl.value}"`
}))

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  await navigator.clipboard.writeText(commands.value[os.value]!)
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-lg bg-elevated p-4">
    <p class="text-sm text-muted">
      Abra o Chrome com a porta de depuração — ele já abre nesta página, é só clicar em
      <span class="font-medium text-default">Novo cenário</span> de novo:
    </p>
    <UTabs
      v-model="os"
      :items="tabs"
      :content="false"
      class="w-full"
    />
    <div class="flex items-center gap-2">
      <code
        data-testid="webdriver-comando"
        class="grow overflow-x-auto whitespace-nowrap rounded-md bg-default p-3 text-xs"
      >{{ commands[os] }}</code>
      <BaseButtonIcon
        :icon="copied ? 'i-ic-round-check' : 'i-ic-round-content-copy'"
        :label="copied ? 'Copiado!' : 'Copiar comando'"
        color="neutral"
        variant="soft"
        data-testid="webdriver-copiar"
        @click="copy"
      />
    </div>
  </div>
</template>
