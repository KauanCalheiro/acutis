import type { RecorderEvent } from '~/composables/webdriver'

export interface Project {
  name: string
  slug: string
  path: string
  repository: string | null
  provider: 'github' | 'gitlab' | null
  created_at: string | null
}

export interface Scenario {
  title: string
  spec: string
  feature: string | null
  tags: string[]
  domain: string | null
}

export interface ProjectDetail extends Project {
  branch: string | null
  updated_at: string
  scenarios: Scenario[]
  auth_status: 'unset' | 'skipped' | 'configured'
  vscode_url: string
}

export interface ScenarioDetail extends Scenario {
  playwright: string
  gherkin: string | null
  events: RecorderEvent[]
  updated_at: string
}

export interface TestDraft {
  title: string
  tags: string[]
  domain: string
  path: string
  gherkin: string
  playwright: string
  events?: RecorderEvent[]
  envVars?: string[]
}
