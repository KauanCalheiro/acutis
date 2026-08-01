export interface RunStep {
  title: string
  status: 'waiting' | 'running' | 'success' | 'failed'
  error?: string | null
}

interface RunStreamEvent {
  event: 'run:started' | 'step' | 'test' | 'run:finished'
  title: string
  status: 'pending' | 'success' | 'failed'
  steps?: string[]
  error?: string | null
  videoPath?: string | null
  passed: boolean
  /** Saída do runner quando a execução morreu antes de qualquer teste reportar. */
  output?: string
}

export function videoUrlFor(path: string) {
  const webdriverUrl = useRuntimeConfig().public.webdriver.acutis.url

  return `${webdriverUrl}/runner/video?${new URLSearchParams({ path })}`
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
  const running = ref(false)
  const passed = ref(false)
  const live = ref(false)
  const videoUrl = ref<string | null>(null)
  const testedAt = ref<string | null>(null)
  const output = ref<string | null>(null)

  function reset() {
    steps.value = []
    videoUrl.value = null
    testedAt.value = null
    output.value = null
    passed.value = false
  }

  function start(spec: string, onFinish?: () => void) {
    reset()
    running.value = true
    live.value = true

    const query = new URLSearchParams({ spec })
    const source = new EventSource(`/api/projects/${slug()}/run-stream?${query}`)

    source.onmessage = (message) => {
      const data = JSON.parse(message.data) as RunStreamEvent

      if (data.event === 'run:started') {
        steps.value = (data.steps ?? []).map(title => ({ title, status: 'waiting' }))
      }

      if (data.event === 'step') {
        if (data.status === 'pending') {
          const waiting = steps.value.findIndex(step => step.title === data.title && step.status === 'waiting')
          if (waiting === -1) steps.value = [...steps.value, { title: data.title, status: 'running' }]
          else steps.value[waiting] = { title: data.title, status: 'running' }
          return
        }

        const index = steps.value.findLastIndex(step => step.title === data.title && step.status === 'running')
        if (index !== -1) steps.value[index] = { title: data.title, status: data.status, error: data.error }
      }

      if (data.event === 'test' && data.status !== 'pending' && data.videoPath) {
        videoUrl.value = videoUrlFor(data.videoPath)
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

  return { steps, running, passed, live, videoUrl, testedAt, output, failedStep, start, reset }
}
