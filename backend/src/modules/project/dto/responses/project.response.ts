/** O que a API responde sobre um projeto. */
import type { ScenarioData } from '../../../scenario/providers/scenario.js'

export interface ProjectResponse {
    name: string
    slug: string
    path: string
    created_at: string
    repository: string | null
    provider: string | null
}

export interface ProjectShowResponse extends ProjectResponse {
    branch: string | null
    updated_at: string
    scenarios: ScenarioData[]
    /** `unset`, `skipped`, `configured` ou `failing` — o que a tela usa para decidir o que oferecer. */
    auth_status: string
    base_url: string | null
    storage_state: string
    /** Sem URL o projeto não roda nada, então a tela pede — a menos que o usuário já tenha recusado. */
    requires_url: boolean
    vscode_url: string
}

/** A listagem no formato JSON:API que o frontend pagina. */
export interface PaginatedResponse<T> {
    data: T[]
    meta: { current_page: number, per_page: number, total: number }
}
