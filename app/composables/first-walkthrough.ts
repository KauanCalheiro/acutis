import type { SuiteRunsResponse } from '#shared/contracts/report'
import type { Project, ProjectDetail } from '~/types/project'
import type { WalkthroughStep } from '~/composables/walkthrough'

export const FIRST_WALKTHROUGH = 'inicial'

const CHAPTERS = [
  'home',
  'project',
  'auth',
  'scenario',
  'report',
  'run'
] as const

type Chapter = typeof CHAPTERS[number]

interface WalkthroughProgress {
  chapter: number
  slug: string
}

const CLOSING_TESTID = 'navbar-apresentacao'

/** O passo que fecha a apresentação inicial, depois da última página. */
const CLOSING_STEP: WalkthroughStep = {
  testid: CLOSING_TESTID,
  side: 'right',
  title: 'Pronto para começar',
  body: 'O Swag Labs era só um exemplo e sai quando você concluir. Crie o seu primeiro projeto e grave um cenário. Quando quiser rever esta apresentação, é por este botão.'
}

function scenarioIdOf(spec: string) {
  return spec.replace(/^tests\//, '').replace(/\.spec\.ts$/, '')
}

async function firstScenarioPath(slug: string) {
  const { scenarios } = await $fetch<ProjectDetail>(`/api/projects/${slug}`)

  return `/projects/${slug}/scenarios/${scenarioIdOf(scenarios[0]!.spec)}`
}

async function latestRunPath(slug: string) {
  const { runs } = await $fetch<SuiteRunsResponse>(`/api/projects/${slug}/runs`)

  return `/projects/${slug}/report/${Date.parse(runs[0]!.started_at)}`
}

const CHAPTER_PATHS: Record<Chapter, (slug: string) => string | Promise<string>> = {
  home: () => '/',
  project: slug => `/projects/${slug}`,
  auth: slug => `/projects/${slug}/scenarios/auth`,
  scenario: firstScenarioPath,
  report: slug => `/projects/${slug}/report`,
  run: latestRunPath
}

/** A apresentação da primeira visita: percorre o projeto de exemplo página por página e o revoga ao terminar. */
export function useFirstWalkthrough() {
  const progress = useState<WalkthroughProgress | null>('first-walkthrough-progress', () => null)
  const creating = useState('first-walkthrough-creating', () => false)
  const { mark } = useWalkthroughSeen()
  const notify = useNotify()

  const chapter = computed<Chapter | null>(() => progress.value ? CHAPTERS[progress.value.chapter]! : null)
  const isLastChapter = computed(() => progress.value?.chapter === CHAPTERS.length - 1)
  const chapterLabel = computed(() => `Parte ${(progress.value?.chapter ?? 0) + 1} de ${CHAPTERS.length}`)

  /** Cria o exemplo, espera a lista de projetos mostrá-lo e abre a primeira parte. */
  async function begin(refreshProjects: () => Promise<void>) {
    if (creating.value) return
    creating.value = true

    try {
      const demo = await $fetch<Project>('/api/demo', {
        method: 'POST'
      })

      await refreshProjects()
      await nextTick()
      progress.value = {
        chapter: 0,
        slug: demo.slug
      }
    } catch (error) {
      mark(FIRST_WALKTHROUGH)
      notify.failure(error, 'Não foi possível criar o projeto de exemplo.', 'first-walkthrough')
    } finally {
      creating.value = false
    }
  }

  /** Abre a parte seguinte na página dela; depois da última, encerra. */
  async function advance() {
    const { chapter: current, slug } = progress.value!

    if (isLastChapter.value) return end()

    const next = current + 1

    try {
      const path = await CHAPTER_PATHS[CHAPTERS[next]!](slug)

      progress.value = {
        chapter: next,
        slug
      }
      await navigateTo(path)
    } catch (error) {
      notify.failure(error, 'Não foi possível abrir a próxima parte da apresentação.', 'first-walkthrough')
      await end()
    }
  }

  async function end() {
    progress.value = null

    for (const id of [FIRST_WALKTHROUGH, ...CHAPTERS]) mark(id)

    try {
      await $fetch('/api/demo', {
        method: 'DELETE'
      })
    } catch (error) {
      notify.failure(error, 'Não foi possível remover o projeto de exemplo.', 'first-walkthrough')
    }

    await navigateTo('/')
    await refreshNuxtData()
  }

  /** Os passos de uma página dentro da apresentação inicial: o fechamento sai das páginas e entra só no fim. */
  function chapterSteps(steps: WalkthroughStep[]) {
    const pageSteps = steps.filter(step => step.testid !== CLOSING_TESTID)

    return isLastChapter.value ? [...pageSteps, CLOSING_STEP] : pageSteps
  }

  return {
    chapter,
    idle: computed(() => !progress.value && !creating.value),
    chapterLabel,
    isLastChapter,
    begin,
    advance,
    end,
    chapterSteps
  }
}
