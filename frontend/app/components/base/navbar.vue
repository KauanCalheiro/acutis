<script setup lang="ts">
const colorPickerOpen = ref(false)
const settingsOpen = ref(false)

const colors = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  yellow: 'bg-yellow-500',
  lime: 'bg-lime-500',
  green: 'bg-green-500',
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  cyan: 'bg-cyan-500',
  sky: 'bg-sky-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  purple: 'bg-purple-500',
  fuchsia: 'bg-fuchsia-500',
  pink: 'bg-pink-500',
  rose: 'bg-rose-500'
}

const appConfig = useAppConfig()
const primaryColor = useCookie<string>('primary-color', {
  default: () => 'blue'
})
appConfig.ui.colors.primary = primaryColor.value

function pickColor(color: string) {
  primaryColor.value = color
  appConfig.ui.colors.primary = color
}

const items = [
  {
    label: 'Projetos',
    icon: 'i-ic-round-folder',
    to: '/',
    testid: 'navbar-projetos'
  }
]
</script>

<template>
  <aside
    class="fixed left-0 top-1/2 z-10 flex w-18 -translate-y-1/2 flex-col gap-6 rounded-r-xl bg-accented/50 p-3 shadow-[0_0_14px_-2px_rgb(0_0_0/0.28)] dark:shadow-[0_0_14px_-2px_rgb(0_0_0/0.8)]"
  >
    <UTooltip
      text="Acutis"
      :delay-duration="0"
      arrow
      :content="{
        side: 'right'
      }"
    >
      <NuxtLink
        to="/"
        aria-label="Acutis"
        class="flex items-center justify-center"
        data-testid="navbar-logo"
      >
        <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-inverted">
          <BaseLogo class="size-7" />
        </span>
      </NuxtLink>
    </UTooltip>

    <nav class="flex flex-col gap-2">
      <UTooltip
        v-for="item in items"
        :key="item.to"
        :text="item.label"
        :delay-duration="0"
        arrow
        :content="{
          side: 'right'
        }"
      >
        <UButton
          :to="item.to"
          :icon="item.icon"
          :aria-label="item.label"
          variant="ghost"
          color="neutral"
          active-variant="soft"
          active-color="primary"
          block
          square
          :data-testid="item.testid"
        />
      </UTooltip>

      <UTooltip
        text="Configurações"
        :delay-duration="0"
        arrow
        :content="{
          side: 'right'
        }"
      >
        <UButton
          icon="i-ic-round-settings"
          aria-label="Configurações"
          variant="ghost"
          color="neutral"
          block
          square
          data-testid="navbar-configuracoes"
          @click="settingsOpen = true"
        />
      </UTooltip>
    </nav>

    <SettingsModal v-model:open="settingsOpen" />

    <div class="flex flex-col gap-2">
      <UPopover
        v-model:open="colorPickerOpen"
        :content="{
          side: 'right'
        }"
      >
        <BaseButtonIcon
          icon="i-ic-round-palette"
          label="Cor primária"
          side="right"
          variant="ghost"
          color="neutral"
          block
          data-testid="navbar-cor"
        />
        <template #content>
          <div class="grid grid-cols-6 gap-2 p-3">
            <button
              v-for="(swatch, color) in colors"
              :key="color"
              type="button"
              class="size-6 rounded-full transition-transform hover:scale-110"
              :class="[
                swatch,
                color === primaryColor ? 'ring-2 ring-default ring-offset-2 ring-offset-bg' : ''
              ]"
              :title="color"
              :data-testid="`cor-${color}`"
              @click="pickColor(color)"
            />
          </div>
        </template>
      </UPopover>

      <UTooltip
        text="Tema"
        :delay-duration="0"
        arrow
        :content="{
          side: 'right'
        }"
      >
        <UColorModeButton
          block
          data-testid="navbar-tema"
        />
      </UTooltip>
    </div>
  </aside>
</template>
