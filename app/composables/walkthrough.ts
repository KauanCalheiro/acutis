import type { MaybeRefOrGetter } from 'vue'

/** O que um passo abre na tela e fecha ao sair, como um modal. Passos seguidos da mesma cena a mantêm aberta. */
export interface WalkthroughScene {
  open: () => void
  close: () => void
}

/** Um termo explicado dentro do passo. */
export interface WalkthroughItem {
  term: string
  text: string
}

/** Um passo da apresentação, apontando para o elemento de `data-testid` igual a `testid`; sem ele, fica centralizado. */
export interface WalkthroughStep {
  testid?: string
  title: string
  body: string
  items?: WalkthroughItem[]
  side?: 'top' | 'right' | 'bottom' | 'left'
  scene?: WalkthroughScene
  enter?: () => void
}

const SEEN_KEY = 'acutis-walkthrough'

const FIVE_YEARS = 60 * 60 * 24 * 365 * 5

const TARGET_WAIT_MS = 2000

const TARGET_POLL_MS = 20

/** O elemento que o passo aponta, ou null quando ele não está na tela. */
export function findWalkthroughTarget(testid: string) {
  return document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)
}

/** As apresentações já vistas, guardadas em cookie. */
export function useWalkthroughSeen() {
  const cookie = useCookie<string[]>(SEEN_KEY, {
    default: () => [],
    maxAge: FIVE_YEARS
  })
  const seen = useState<string[]>(SEEN_KEY, () => cookie.value)

  function save(ids: string[]) {
    seen.value = ids
    cookie.value = ids
  }

  return {
    seen,
    mark: (id: string) => {
      if (!seen.value.includes(id)) save([...seen.value, id])
    },
    reset: () => save([])
  }
}

/** Se alguma apresentação está na tela agora. */
export const useWalkthroughRunning = () => useState('walkthrough-running', () => false)

async function waitForTarget(testid: string) {
  const deadline = Date.now() + TARGET_WAIT_MS

  while (!findWalkthroughTarget(testid) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, TARGET_POLL_MS))
  }
}

/** Conduz a apresentação `id` pelos passos, abrindo sozinha na primeira visita. */
export function useWalkthrough(id: string, steps: MaybeRefOrGetter<WalkthroughStep[]>) {
  const { seen, mark } = useWalkthroughSeen()
  const running = useWalkthroughRunning()

  const visible = shallowRef<WalkthroughStep[]>([])

  const tour = useTour(() => visible.value.map(step => ({
    target: step.testid ? () => findWalkthroughTarget(step.testid!) : null
  })))

  const current = computed(() => tour.open.value ? visible.value[tour.index.value] : undefined)

  let moving = false

  async function go(to: number) {
    const from = current.value
    const target = visible.value[to]

    if (!target || moving) return
    moving = true

    if (from?.scene !== target.scene) {
      from?.scene?.close()
      target.scene?.open()
    }
    target.enter?.()

    if (target.testid) await waitForTarget(target.testid)

    tour.goTo(to)
    moving = false
  }

  function start() {
    visible.value = toValue(steps).filter(step =>
      !step.testid || step.scene || step.enter || findWalkthroughTarget(step.testid)
    )

    if (!visible.value.length) return

    running.value = true
    go(0)
  }

  function finish() {
    current.value?.scene?.close()
    tour.finish()
    running.value = false
    mark(id)
  }

  function next() {
    if (tour.hasNext.value) go(tour.index.value + 1)
    else finish()
  }

  function prev() {
    if (tour.hasPrev.value) go(tour.index.value - 1)
  }

  const unseen = computed(() => !seen.value.includes(id))

  onMounted(() => {
    if (unseen.value) start()
  })

  watch(unseen, (again) => {
    if (again && !tour.open.value) start()
  })

  onBeforeUnmount(() => {
    if (tour.open.value) running.value = false
  })

  return {
    open: tour.open,
    index: tour.index,
    total: tour.total,
    reference: tour.reference,
    hasPrev: tour.hasPrev,
    hasNext: tour.hasNext,
    current,
    next,
    prev,
    finish
  }
}
