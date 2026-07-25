<script setup lang="ts">
interface TestStep {
  title: string
  status: 'waiting' | 'running' | 'success' | 'failed'
  error?: string | null
}

interface ScenarioTestRunModal {
  running?: boolean
  steps?: TestStep[]
  videoUrl?: string | null
  projectName: string
  scenarioName: string
  branch?: string | null
  testedAt?: string | null
}

const {
  running = false,
  steps = [],
  videoUrl = null,
  projectName,
  scenarioName,
  branch = null,
  testedAt = null
} = defineProps<ScenarioTestRunModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const passed = computed(() => !steps.some(step => step.status === 'failed'))

const visibleSteps = computed(() => {
  const failed = steps.findIndex(step => step.status === 'failed')

  return failed === -1 ? steps : steps.slice(0, failed + 1)
})

const stepIcons: Record<TestStep['status'], string> = {
  waiting: 'i-ic-round-radio-button-unchecked',
  running: 'i-ic-round-radio-button-unchecked',
  success: 'i-ic-round-check-circle',
  failed: 'i-ic-round-error'
}

const stepColors: Record<TestStep['status'], string> = {
  waiting: 'text-dimmed',
  running: 'text-warning animate-pulse',
  success: 'text-success',
  failed: 'text-error'
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :dismissable="!running"
    wide
  >
    <template #header>
      <div class="flex w-full items-start justify-between gap-4">
        <div class="flex flex-col pt-3 gap-2">
          <p
            v-if="running"
            class="text-xl font-bold"
          >
            Testando cenário...
          </p>

          <template v-else>
            <UBadge
              class="self-start"
              :color="passed ? 'success' : 'error'"
              :icon="passed ? 'i-ic-round-check-circle' : 'i-ic-round-error'"
              :label="passed ? 'Sucesso' : 'Falha'"
              data-testid="execucao-status"
            />
            <p class="mt-2 text-xl font-bold">
              Resultado do teste
            </p>
            <div class="mt-2 space-y-0.5 text-sm">
              <p><span class="font-semibold">Projeto:</span> {{ projectName }}</p>
              <p><span class="font-semibold">Cenário:</span> {{ scenarioName }}</p>
              <p v-if="branch">
                <span class="font-semibold">Branch:</span> {{ branch }}
              </p>
              <p v-if="testedAt">
                <span class="font-semibold">Testado em:</span> {{ testedAt }}
              </p>
            </div>
          </template>
        </div>

        <UButton
          v-if="!running && !passed"
          label="Corrigir"
          trailing-icon="i-ic-round-auto-awesome"
          class="mt-3 shrink-0"
          data-testid="execucao-corrigir"
        />
      </div>
    </template>

    <template #body>
      <BaseLoadingPhrases
        v-if="running && steps.length === 0"
        :phrases="['Iniciando a execução']"
        data-testid="execucao-iniciando"
      />

      <template v-else>
        <video
          v-if="videoUrl"
          :src="videoUrl"
          controls
          class="mb-6 w-full rounded-lg"
          data-testid="execucao-video"
        />

        <p class="mb-3 text-lg font-semibold">
          Timeline de eventos
        </p>
        <ol class="flex flex-col">
          <li
            v-for="(step, i) in visibleSteps"
            :key="i"
            data-testid="execucao-step"
            :data-status="step.status"
            class="flex items-stretch gap-3"
          >
            <div class="flex flex-col items-center">
              <UIcon
                :name="stepIcons[step.status]"
                class="size-6 shrink-0 transition-colors"
                :class="stepColors[step.status]"
              />
              <span
                v-if="i < visibleSteps.length - 1"
                class="w-px grow bg-accented"
              />
            </div>
            <div class="pb-4 min-w-0">
              <p
                class="text-base"
                data-testid="execucao-step-titulo"
              >
                {{ step.title }}
              </p>
              <p
                v-if="step.status === 'failed' && step.error"
                class="text-sm text-dimmed mt-1"
                data-testid="execucao-step-erro"
              >
                <span class="font-semibold text-error">Erro:</span> {{ step.error }}
              </p>
            </div>
          </li>
        </ol>
      </template>
    </template>

    <template
      v-if="!running"
      #footer
    >
      <UButton
        label="Fechar"
        color="neutral"
        variant="ghost"
        data-testid="execucao-fechar"
        @click="open = false"
      />
    </template>
  </BaseModal>
</template>
