<script setup lang="ts">
import type { RunStep } from '~/composables/run-stream'

interface ScenarioTestRunModal {
  running?: boolean
  passed?: boolean
  steps?: RunStep[]
  videoUrl?: string | null
  projectName: string
  scenarioName: string
  branch?: string | null
  testedAt?: string | null
  playwright?: string | null
  /** Saída do runner quando a execução morreu antes de qualquer passo. */
  output?: string | null
  /** Autenticação não é cenário: muda o título e o rótulo, o resto do modal é igual. */
  kind?: 'cenario' | 'autenticacao'
}

const {
  running = false,
  passed = false,
  steps = [],
  videoUrl = null,
  projectName,
  scenarioName,
  branch = null,
  testedAt = null,
  playwright = null,
  output = null,
  kind = 'cenario'
} = defineProps<ScenarioTestRunModal>()

const emit = defineEmits<{
  fix: []
}>()

const open = defineModel<boolean>('open', {
  default: false
})

const { configured: aiConfigured } = useAi()

const isAuth = computed(() => kind === 'autenticacao')
const label = computed(() => isAuth.value ? 'Autenticação' : 'Cenário')
const runningTitle = computed(() => isAuth.value ? 'Testando autenticação...' : 'Testando cenário...')
const resultTitle = computed(() => isAuth.value ? 'Resultado da autenticação' : 'Resultado do teste')

const failedStep = computed(() => steps.findIndex(step => step.status === 'failed'))

function seekToPreviewFrame(event: Event) {
  const video = event.target as HTMLVideoElement

  video.currentTime = video.duration * 0.25
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
            {{ runningTitle }}
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
              {{ resultTitle }}
            </p>
          </template>
        </div>

        <UTooltip
          v-if="!running && !passed && failedStep !== -1"
          :text="AI_OFF_HINT"
          :disabled="aiConfigured"
          :delay-duration="0"
          arrow
        >
          <!-- O botão desabilitado não dispara evento de mouse: quem recebe o hover é o span. -->
          <span class="mt-6 shrink-0">
            <UButton
              label="Corrigir"
              trailing-icon="i-ic-round-auto-awesome"
              :disabled="!aiConfigured"
              :class="aiConfigured ? '' : 'pointer-events-none'"
              data-testid="execucao-corrigir"
              @click="emit('fix')"
            />
          </span>
        </UTooltip>
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
          <p><span class="font-semibold">{{ label }}:</span> {{ scenarioName }}</p>
          <p v-if="branch">
            <span class="font-semibold">Branch:</span> {{ branch }}
          </p>
          <p v-if="testedAt">
            <span class="font-semibold">Testado em:</span> {{ testedAt }}
          </p>
        </div>

        <video
          v-if="videoUrl"
          :src="videoUrl"
          preload="metadata"
          controls
          class="mx-auto mb-6 w-3/4 rounded-lg bg-elevated"
          data-testid="execucao-video"
          @loadedmetadata="seekToPreviewFrame"
        />

        <UAlert
          v-if="output"
          color="error"
          variant="soft"
          icon="i-ic-round-error"
          title="A execução não chegou a começar"
          class="mb-6"
          data-testid="execucao-saida"
        >
          <template #description>
            <p class="mb-2">
              O Playwright encerrou antes de rodar qualquer passo. Saída do runner:
            </p>
            <code class="block whitespace-pre-wrap font-mono text-xs">{{ output }}</code>
          </template>
        </UAlert>

        <template v-if="steps.length">
          <p class="mb-3 text-lg font-semibold">
            Timeline de eventos
          </p>
        </template>
        <ScenarioTestRunSteps :steps="steps" />

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
