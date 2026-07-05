<script setup lang="ts">
const pinned = useCookie<boolean>('navbar-expanded', {
  default: () => false,
})
const hovering = ref(false)
const colorPickerOpen = ref(false)
const expanded = computed(() => pinned.value || hovering.value || colorPickerOpen.value)

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
  rose: 'bg-rose-500',
}

const appConfig = useAppConfig()
const primaryColor = useCookie<string>('primary-color', {
  default: () => 'blue',
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
    testid: 'navbar-projetos',
  },
  {
    label: 'Gravação',
    icon: 'i-ic-round-fiber-manual-record',
    to: '/record',
    testid: 'navbar-gravacao',
  },
]
</script>

<template>
  <aside
    class="sticky top-6 my-6 lg:top-10 lg:my-10 mr-3 flex h-[calc(100vh-3rem)] lg:h-[calc(100vh-5rem)] shrink-0 flex-col justify-between overflow-hidden rounded-r-xl border-y border-r border-default bg-accented/50 p-3 transition-[width] duration-300"
    :class="expanded ? 'w-56' : 'w-18'"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <div class="flex flex-col gap-6">
      <NuxtLink
        to="/"
        class="flex items-center gap-3 overflow-hidden"
        data-testid="navbar-logo"
      >
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-inverted">
          A
        </span>
        <span
          v-if="expanded"
          class="font-bold"
        >
          Acutis
        </span>
      </NuxtLink>

      <nav class="flex flex-col gap-2">
        <UTooltip
          v-for="item in items"
          :key="item.to"
          :text="item.label"
          :disabled="expanded"
          :content="{
            side: 'right',
          }"
        >
          <UButton
            :to="item.to"
            :icon="item.icon"
            :label="expanded ? item.label : undefined"
            variant="ghost"
            color="neutral"
            active-variant="soft"
            active-color="primary"
            block
            :square="!expanded"
            :class="{
              'justify-center': !expanded,
              'justify-start': expanded
            }"
            :data-testid="item.testid"
          />
        </UTooltip>
      </nav>
    </div>

    <div class="flex flex-col gap-2">
      <UPopover
        v-model:open="colorPickerOpen"
        :content="{
          side: 'right',
        }"
      >
        <UButton
          icon="i-ic-round-palette"
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
                color === primaryColor ? 'ring-2 ring-default ring-offset-2 ring-offset-bg' : '',
              ]"
              :title="color"
              :data-testid="`cor-${color}`"
              @click="pickColor(color)"
            />
          </div>
        </template>
      </UPopover>
      <UColorModeButton
        block
        data-testid="navbar-tema"
      />
      <UButton
        :icon="pinned ? 'i-ic-round-chevron-left' : 'i-ic-round-chevron-right'"
        variant="ghost"
        color="neutral"
        block
        data-testid="navbar-alternar"
        @click="pinned = !pinned"
      />
    </div>
  </aside>
</template>
