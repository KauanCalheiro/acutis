/** O que a API responde sobre um cenário e sobre cada execução dele. */

/** Um passo da execução como a tela o desenha: a linha do tempo, não o evento cru do reporter. */
export interface RunStep {
    title: string
    status: string
    duration_ms: number
    error: string | null
}

export interface ScenarioRunResponse {
    started_at: string
    duration_ms: number
    passed: boolean
    branch: string | null
    author: string | null
    steps: RunStep[]
    playwright: string
    /** Só a execução mais recente que gravou vídeo o recebe; nas demais vem nulo. */
    video_path: string | null
}

export interface ScenarioResponse {
    title: string
    spec: string
    feature: string | null
    tags: string[]
    domain: string | null
    /** Vazio enquanto o arquivo não existe em disco — é o caso do setup de autenticação novo. */
    playwright: string
    gherkin: string | null
    events: unknown
    updated_at: string
    is_auth: boolean
    runs: ScenarioRunResponse[]
}
