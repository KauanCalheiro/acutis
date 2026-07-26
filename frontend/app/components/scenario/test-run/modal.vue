<script setup lang="ts">
interface TestStep {
  title: string
  status: 'waiting' | 'running' | 'success' | 'failed'
  error?: string | null
}

interface FixedSpec {
  playwright: string
  summary: string
}

interface ScenarioTestRunModal {
  running?: boolean
  live?: boolean
  passed?: boolean
  steps?: TestStep[]
  videoUrl?: string | null
  projectName: string
  scenarioName: string
  branch?: string | null
  testedAt?: string | null
  fixing?: boolean
  fix?: FixedSpec | null
  fixError?: string | null
  applyingFix?: boolean
  playwright?: string | null
}

const {
  running = false,
  live = false,
  passed = false,
  steps = [],
  videoUrl = null,
  projectName,
  scenarioName,
  branch = null,
  testedAt = null,
  fixing = false,
  fix = null,
  fixError = null,
  applyingFix = false,
  playwright = null
} = defineProps<ScenarioTestRunModal>()

const emit = defineEmits<{
  fix: []
  applyFix: []
  discardFix: []
}>()

const open = defineModel<boolean>('open', {
  default: false
})

const failedStep = computed(() => steps.findIndex(step => step.status === 'failed'))

function seekToPreviewFrame(event: Event) {
  const video = event.target as HTMLVideoElement

  video.currentTime = video.duration * 0.25
}

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
        <div class="flex flex-col pt-6 gap-2">
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
          </template>
        </div>

        <UButton
          v-if="live && !running && !passed && !fix && failedStep !== -1"
          label="Corrigir"
          trailing-icon="i-ic-round-auto-awesome"
          class="mt-6 shrink-0"
          :loading="fixing"
          :disabled="fixing"
          data-testid="execucao-corrigir"
          @click="emit('fix')"
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
        <div
          v-if="!running"
          class="mb-6 space-y-0.5 text-sm"
          data-testid="execucao-detalhes"
        >
          <p><span class="font-semibold">Projeto:</span> {{ projectName }}</p>
          <p><span class="font-semibold">Cenário:</span> {{ scenarioName }}</p>
          <p v-if="branch">
            <span class="font-semibold">Branch:</span> {{ branch }}
          </p>
          <p v-if="testedAt">
            <span class="font-semibold">Testado em:</span> {{ testedAt }}
          </p>
        </div>

        <BaseLoadingPhrases
          v-if="fixing"
          :phrases="['Analisando a falha', 'Procurando um seletor melhor', 'Reescrevendo o teste']"
          class="mb-6"
          data-testid="correcao-carregando"
        />

        <UAlert
          v-else-if="fixError"
          color="error"
          variant="subtle"
          icon="i-ic-round-error"
          :description="fixError"
          class="mb-6"
          data-testid="correcao-erro"
        />

        <div
          v-else-if="fix"
          class="mb-6"
          data-testid="correcao-proposta"
        >
          <p class="mb-1 text-lg font-semibold">
            Correção proposta
          </p>
          <p
            class="mb-3 text-sm text-muted"
            data-testid="correcao-resumo"
          >
            {{ fix.summary }}
          </p>

          <BaseCodefield
            :model-value="fix.playwright"
            language="typescript"
            readonly
            testid="correcao-spec"
          />

          <div class="mt-3 flex gap-2">
            <UButton
              label="Aplicar"
              icon="i-ic-round-check"
              :loading="applyingFix"
              :disabled="applyingFix"
              data-testid="correcao-aplicar"
              @click="emit('applyFix')"
            />
            <UButton
              label="Descartar"
              color="neutral"
              variant="ghost"
              :disabled="applyingFix"
              data-testid="correcao-descartar"
              @click="emit('discardFix')"
            />
          </div>
        </div>

        <video
          v-if="videoUrl"
          :src="videoUrl"
          preload="metadata"
          controls
          @loadedmetadata="seekToPreviewFrame"
          class="mx-auto mb-6 w-3/4 rounded-lg bg-elevated"
          data-testid="execucao-video"
        />

        <p class="mb-3 text-lg font-semibold">
          Timeline de eventos
        </p>
        <ol class="flex flex-col">
          <li
            v-for="(step, i) in steps"
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
                v-if="i < steps.length - 1"
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

        <template v-if="playwright">
          <p class="mt-6 mb-3 text-lg font-semibold">
            Código executado
          </p>
          <BaseCodefield
            :model-value="playwright"
            language="typescript"
            readonly
            testid="execucao-playwright"
          />
        </template>
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
