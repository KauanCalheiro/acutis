import type { RunStreamEvent, RunTest, RunTimelineStep as RunStep } from '@acutis/contracts/scenario'

export type { RunTest, RunTimelineStep as RunStep } from '@acutis/contracts/scenario'

/** O que o Playwright reporta por passo/teste, no vocabulário da timeline. */
const STATUS: Record<RunStreamEvent['status'], RunStep['status']> = {
  pending: 'running',
  success: 'success',
  failed: 'failed',
  skipped: 'waiting'
}

export function videoUrlFor(path: string) {
  const webdriverUrl = useRuntimeConfig().public.webdriver.acutis.url

  return `${webdriverUrl}/runner/video?${new URLSearchParams({ path })}`
}

/** O relatório HTML da última execução do projeto, servido pelo backend com vídeo e trace dentro. */
export function reportUrlFor(slug: string) {
  return `${useRuntimeConfig().public.webdriver.acutis.url}/api/v1/projects/${slug}/report/`
}

export function formatTestedAt(date: Date) {
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}

/** Execução de um spec pelo backend, com a timeline chegando passo a passo por SSE. */
export function useRunStream(slug: () => string) {
  const steps = ref<RunStep[]>([])
  const ran = ref<Omit<RunTest, 'steps'>[]>([])
  const running = ref(false)
  const passed = ref(false)
  const videoUrl = ref<string | null>(null)
  const testedAt = ref<string | null>(null)
  const output = ref<string | null>(null)

  /** A ordem é a que o teste declarou; o passo que ele nunca anunciou entra no fim, na chegada. */
  const tests = computed<RunTest[]>(() => ran.value.map(test => ({
    ...test,
    steps: steps.value
      .map((step, arrival) => ({ step, arrival }))
      .filter(({ step }) => step.testId === test.id)
      .sort((a, b) => (a.step.order ?? Infinity) - (b.step.order ?? Infinity) || a.arrival - b.arrival)
      .map(({ step }) => step)
  })))

  function reset() {
    steps.value = []
    ran.value = []
    videoUrl.value = null
    testedAt.value = null
    output.value = null
    passed.value = false
  }

  /** O passo pertence ao teste do evento; a semente da timeline ainda não tem dono e serve a qualquer um. */
  function sameTest(step: RunStep, event: RunStreamEvent) {
    return !event.testId || !step.testId || step.testId === event.testId
  }

  /** A timeline semeada pelo run inteiro não tem dono: o teste adota a que é dele antes de criar a sua. */
  function seed(testId: string, titles: string[]) {
    const seeded = [...steps.value]

    titles.forEach((title, order) => {
      const orphan = seeded.findIndex(step => step.title === title && step.status === 'waiting' && !step.testId)
      const step: RunStep = { testId, order, title, status: 'waiting' }

      if (orphan === -1) seeded.push(step)
      else seeded[orphan] = step
    })

    steps.value = seeded
  }

  function start({ spec, grep }: { spec?: string, grep?: string }, onFinish?: () => void) {
    reset()
    running.value = true

    const query = new URLSearchParams({
      ...(spec ? { spec } : {}),
      ...(grep ? { grep } : {})
    })
    const source = new EventSource(`/api/projects/${slug()}/run-stream?${query}`)

    source.onmessage = (message) => {
      const data = JSON.parse(message.data) as RunStreamEvent

      if (data.event === 'run:started') {
        steps.value = (data.steps ?? []).map(title => ({ title, status: 'waiting' }))
      }

      if (data.event === 'step') {
        if (data.status === 'pending') {
          const own = steps.value.findIndex(step => step.title === data.title && step.status === 'waiting' && step.testId === data.testId)
          const waiting = own !== -1
            ? own
            : steps.value.findIndex(step => step.title === data.title && step.status === 'waiting' && sameTest(step, data))
          const seeded = waiting === -1 ? undefined : steps.value[waiting]
          const step: RunStep = { testId: data.testId, order: seeded?.order, title: data.title, status: 'running' }
          if (waiting === -1) steps.value = [...steps.value, step]
          else steps.value[waiting] = step
          return
        }

        // O timeout do teste chega depois do passo já ter fechado verde: corrige a linha dele.
        const running = steps.value.findLastIndex(step => step.title === data.title && step.status === 'running' && sameTest(step, data))
        const index = running !== -1 || data.status !== 'failed'
          ? running
          : steps.value.findLastIndex(step => step.title === data.title && step.status === 'success' && sameTest(step, data))

        if (index !== -1) {
          steps.value[index] = {
            testId: steps.value[index]!.testId ?? data.testId,
            order: steps.value[index]!.order,
            title: data.title,
            status: STATUS[data.status],
            error: data.error ?? null
          }
        }
      }

      if (data.event === 'test') {
        if (data.id) {
          const seeded = ran.value.some(previous => previous.id === data.id)

          if (!seeded && data.steps?.length) seed(data.id, data.steps)

          const test = {
            id: data.id,
            title: data.title,
            status: STATUS[data.status],
            error: data.error ?? null
          }
          const known = ran.value.findIndex(previous => previous.id === data.id)

          if (known === -1) ran.value = [...ran.value, test]
          else ran.value[known] = test
        }

        if (data.status !== 'pending' && data.videoPath) {
          videoUrl.value = videoUrlFor(data.videoPath)
        }
      }

      if (data.event === 'run:finished') {
        source.close()
        running.value = false
        passed.value = data.passed
        output.value = data.output ?? null
        testedAt.value = formatTestedAt(new Date())
        onFinish?.()
      }
    }

    source.onerror = () => {
      source.close()
      running.value = false
      testedAt.value = formatTestedAt(new Date())
      if (steps.value.length === 0) steps.value = [{ title: 'Não foi possível executar o teste.', status: 'failed' }]
    }
  }

  const failedStep = computed(() => steps.value.find(step => step.status === 'failed'))

  return { steps, tests, running, passed, videoUrl, testedAt, output, failedStep, start, reset }
}
