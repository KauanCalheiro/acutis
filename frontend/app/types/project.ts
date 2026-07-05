export interface Project {
  name: string
  slug: string
  path: string
  repository: string | null
  provider: 'github' | 'gitlab' | null
  created_at: string | null
}
