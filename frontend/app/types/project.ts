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
  auth_status: 'unset' | 'skipped' | 'configured' | 'failing'
  base_url: string | null
  environment: { slug: string, name: string } | null
  vscode_url: string
}

export interface EnvironmentVar {
  key: string
  value: string | null
  secret: boolean
  pending: boolean
}

export interface EditableVar {
  key: string
  value: string
  secret: boolean
  pending: boolean
}

export interface Environment {
  slug: string
  name: string
  vars: EnvironmentVar[]
}

export interface EnvironmentList {
  active: string | null
  environments: Environment[]
  known_keys: string[]
  dotenv_keys: string[]
}

export interface Dotenv {
  vars: EnvironmentVar[]
}

export interface ScenarioRunStep {
  title: string
  status: 'waiting' | 'success' | 'failed'
  duration_ms: number
  error: string | null
}

export interface ScenarioRun {
  started_at: string
  duration_ms: number
  passed: boolean
  branch: string | null
  author: string | null
  steps: ScenarioRunStep[]
  playwright: string
  video_path: string | null
}

export interface ScenarioDetail extends Scenario {
  playwright: string
  gherkin: string | null
  events: RecorderEvent[]
  updated_at: string
  runs: ScenarioRun[]
}

export interface SelectorSuggestion {
  event: string
  currentSelector: string
  suggestedTestId: string
  reason: string
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
