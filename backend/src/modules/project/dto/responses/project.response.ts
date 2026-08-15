/**
 * O que a API responde sobre um projeto — o lugar das `ProjectResource` do Laravel.
 *
 * Os nomes em snake_case e o projeto achatado na raiz (e não sob uma chave `project`) são o formato
 * que o frontend já lê; o tipo existe para que mudá-lo seja uma decisão, e não um efeito colateral
 * de mexer no service.
 */
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
