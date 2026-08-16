<script setup lang="ts">
import type { RunTest } from '~/composables/run-stream'

interface ProjectRunFilteredModal {
  running?: boolean
  passed?: boolean
  tests?: RunTest[]
  projectName: string
  slug: string
  /** Texto da busca que decidiu quais cenários entraram na execução. */
  filter?: string
  testedAt?: string | null
  output?: string | null
}

const {
  running = false,
  passed = false,
  tests = [],
  projectName,
  slug,
  filter = '',
  testedAt = null,
  output = null
} = defineProps<ProjectRunFilteredModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const testIcons: Record<RunTest['status'], string> = {
  waiting: 'i-ic-round-radio-button-unchecked',
  running: 'line-md:loading-twotone-loop',
  success: 'i-ic-round-check-circle',
  failed: 'i-ic-round-error'
}

const testColors: Record<RunTest['status'], string> = {
  waiting: 'text-dimmed',
  running: 'text-neutral',
  success: 'text-success',
  failed: 'text-error'
}

/** O teste chega em execução e só depois falha, então abrir o que falhou é reação, não estado inicial. */
const opened = ref<string[]>([])

watch(() => tests, (current) => {
  if (!current.length) {
    opened.value = []

    return
  }

  const failed = current.filter(test => test.status === 'failed').map(test => test.id)
  opened.value = [...new Set([...opened.value, ...failed])]
}, {
  deep: true,
  immediate: true
})

function toggle(id: string, open: boolean) {
  opened.value = open ? [...opened.value, id] : opened.value.filter(other => other !== id)
}

function ownError(test: RunTest) {
  return test.error && test.steps.every(step => step.status !== 'failed') ? test.error : null
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :dismissable="!running"
    wide
  >
    <template #header>
      <div class="flex flex-col pt-6 gap-2">
        <p
          v-if="running"
          class="text-xl font-bold"
        >
          Testando cenários filtrados...
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
            Resultado dos testes
          </p>
        </template>
      </div>
    </template>

    <template #body>
      <BaseLoadingPhrases
        v-if="running && tests.length === 0"
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
          <p v-if="filter">
            <span class="font-semibold">Filtro:</span> {{ filter }}
          </p>
          <p><span class="font-semibold">Cenários:</span> {{ tests.length }}</p>
          <p v-if="testedAt">
            <span class="font-semibold">Testado em:</span> {{ testedAt }}
          </p>
        </div>

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

        <div class="flex flex-col gap-3">
          <UCollapsible
            v-for="test in tests"
            :key="test.id"
            :open="opened.includes(test.id)"
            data-testid="execucao-teste"
            :data-status="test.status"
            @update:open="toggle(test.id, $event)"
          >
            <UButton
              block
              color="neutral"
              variant="soft"
              :icon="testIcons[test.status]"
              trailing-icon="i-ic-round-expand-more"
              :ui="{
                base: 'justify-start gap-3',
                leadingIcon: testColors[test.status],
                trailingIcon: 'text-dimmed'
              }"
              data-testid="execucao-teste-abrir"
            >
              <span
                class="grow truncate text-left"
                data-testid="execucao-teste-titulo"
              >
                {{ test.title }}
              </span>
            </UButton>

            <template #content>
              <div class="mt-1 rounded-md bg-elevated py-3 pl-3.5 pr-3">
                <p
                  v-if="ownError(test)"
                  class="text-sm text-dimmed"
                  data-testid="execucao-teste-erro"
                >
                  <span class="font-semibold text-error">Erro:</span> {{ ownError(test) }}
                </p>
                <p
                  v-else-if="test.steps.length === 0"
                  class="text-sm text-dimmed"
                >
                  Nenhum passo reportado.
                </p>
                <ScenarioTestRunSteps :steps="test.steps" />
              </div>
            </template>
          </UCollapsible>
        </div>
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
      <UButton
        label="Relatório do Playwright"
        trailing-icon="i-ic-round-assessment"
        :to="reportUrlFor(slug)"
        target="_blank"
        external
        data-testid="execucao-relatorio"
      />
    </template>
  </BaseModal>
</template>
