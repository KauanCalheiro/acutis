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
}

export interface ProjectDetail extends Project {
  branch: string | null
  updated_at: string
  scenarios: Scenario[]
}

export interface TestDraft {
  title: string
  tags: string[]
  path: string
  gherkin: string
  playwright: string
}
