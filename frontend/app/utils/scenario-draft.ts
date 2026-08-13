import type { ScenarioDetail, TestDraft } from '~/types/project'

/**
 * Título e caminho viram nome de arquivo, e o backend recusa acima disto. Os dois números
 * acompanham TestArtifact::TITLE_LIMIT e PATH_LIMIT.
 */
export const LIMITE_TITULO = 120

export const LIMITE_CAMINHO = 80

export function draftFromScenario(scenario: ScenarioDetail): TestDraft {
  const id = scenario.spec.replace(/^tests\//, '').replace(/\.spec\.ts$/, '')
  const parts = id.split('/')

  return {
    title: scenario.title,
    path: parts.at(-1)!,
    domain: parts.length > 1 ? parts.slice(0, -1).join('/') : '',
    tags: scenario.tags,
    gherkin: scenario.gherkin ?? '',
    playwright: scenario.playwright
  }
}
