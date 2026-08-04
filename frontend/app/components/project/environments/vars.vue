<script setup lang="ts">
import type { EditableVar } from '~/types/project'

interface ProjectEnvironmentsVars {
  knownKeys?: string[]
  pointerKeys?: string[]
  secrets?: boolean
  testid?: string
}

const {
  knownKeys = [],
  pointerKeys = [],
  secrets = false,
  testid = 'variaveis'
} = defineProps<ProjectEnvironmentsVars>()

const vars = defineModel<EditableVar[]>({
  default: () => []
})

const keys = ref([...knownKeys])

watch(() => knownKeys, (updated) => {
  keys.value = [...updated]
})

function pointersFor(variable: EditableVar) {
  return pointerKeys.map(key => ({
    label: `{{env.${key}}}`,
    onSelect: () => (variable.value = `{{env.${key}}}`)
  }))
}

function declare(variable: EditableVar, key: string) {
  if (!keys.value.includes(key)) keys.value.push(key)

  variable.key = key
}

function add() {
  vars.value = [
    ...vars.value,
    {
      key: '',
      value: '',
      secret: false,
      pending: false
    }
  ]
}

function remove(index: number) {
  vars.value = vars.value.filter((_, position) => position !== index)
}

function placeholderOf(variable: EditableVar) {
  if (!variable.secret) return 'valor'

  return variable.pending ? 'ainda sem valor' : 'guardado — digite para trocar'
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(variable, index) in vars"
      :key="index"
      class="flex items-center gap-2"
    >
      <UInputMenu
        v-model="variable.key"
        :items="keys"
        create-item="always"
        class="w-1/3"
        placeholder="CHAVE"
        :data-testid="`${testid}-chave-${index}`"
        @create="declare(variable, $event)"
      />
      <UInput
        v-model="variable.value"
        class="flex-1"
        :placeholder="placeholderOf(variable)"
        :color="variable.pending ? 'warning' : undefined"
        :data-testid="`${testid}-valor-${index}`"
      >
        <template
          v-if="variable.secret && pointerKeys.length"
          #trailing
        >
          <UDropdownMenu :items="pointersFor(variable)">
            <UButton
              icon="i-ic-round-link"
              color="neutral"
              variant="link"
              aria-label="Apontar para uma chave do .env"
              :data-testid="`${testid}-apontar-${index}`"
            />

            <template #item="{ item }">
              <span :data-testid="`${testid}-ponteiro-${item.label}`">{{ item.label }}</span>
            </template>
          </UDropdownMenu>
        </template>
      </UInput>
      <UTooltip
        v-if="secrets"
        text="Segredo: o valor sai do arquivo versionado e vai para o .env"
      >
        <UButton
          icon="i-ic-round-lock"
          :color="variable.secret ? 'primary' : 'neutral'"
          :variant="variable.secret ? 'solid' : 'ghost'"
          :aria-label="variable.secret ? 'Deixar de ser segredo' : 'Marcar como segredo'"
          :data-testid="`${testid}-segredo-${index}`"
          @click="variable.secret = !variable.secret"
        />
      </UTooltip>
      <UButton
        icon="i-ic-round-close"
        color="error"
        variant="ghost"
        aria-label="Remover variável"
        :data-testid="`${testid}-remover-${index}`"
        @click="remove(index)"
      />
    </div>

    <p
      v-if="!vars.length"
      class="text-sm text-muted italic"
    >
      Nenhuma variável ainda.
    </p>

    <UButton
      icon="i-ic-round-add"
      label="Adicionar variável"
      color="neutral"
      variant="soft"
      class="self-start"
      :data-testid="`${testid}-adicionar`"
      @click="add"
    />
  </div>
</template>
