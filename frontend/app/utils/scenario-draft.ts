import type { ScenarioDetail, TestDraft } from '~/types/project'

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
