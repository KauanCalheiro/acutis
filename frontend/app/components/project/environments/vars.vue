<script setup lang="ts">
import type { EditableVar } from '~/types/project'

interface ProjectEnvironmentsVars {
  knownKeys?: string[]
  testid?: string
}

const {
  knownKeys = [],
  testid = 'variaveis'
} = defineProps<ProjectEnvironmentsVars>()

const vars = defineModel<EditableVar[]>({
  default: () => []
})

const keyListId = useId()

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

const revealed = ref<number[]>([])

function toggleReveal(index: number) {
  revealed.value = revealed.value.includes(index)
    ? revealed.value.filter(position => position !== index)
    : [...revealed.value, index]
}

function typeOf(variable: EditableVar, index: number) {
  return variable.secret && !revealed.value.includes(index) ? 'password' : 'text'
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <datalist :id="keyListId">
      <option
        v-for="key in knownKeys"
        :key="key"
        :value="key"
      />
    </datalist>

    <div
      v-for="(variable, index) in vars"
      :key="index"
      class="flex items-center gap-2"
    >
      <UInput
        v-model="variable.key"
        class="w-1/3"
        placeholder="CHAVE"
        :list="keyListId"
        :data-testid="`${testid}-chave-${index}`"
      />

      <UInput
        v-model="variable.value"
        class="flex-1"
        :type="typeOf(variable, index)"
        placeholder="valor"
        :color="variable.pending ? 'warning' : undefined"
        :data-testid="`${testid}-valor-${index}`"
      >
        <template
          v-if="variable.secret"
          #trailing
        >
          <UButton
            :icon="revealed.includes(index) ? 'i-ic-round-visibility-off' : 'i-ic-round-visibility'"
            color="neutral"
            variant="link"
            :aria-label="revealed.includes(index) ? 'Esconder o valor' : 'Revelar o valor'"
            :data-testid="`${testid}-revelar-${index}`"
            @click="toggleReveal(index)"
          />
        </template>
      </UInput>

      <UTooltip text="Segredo: o valor fica mascarado na tela">
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
