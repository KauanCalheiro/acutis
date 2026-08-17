/** O que a tela recebe depois de testar o cadastro do provedor. */
export interface PingResponse {
    /** O provedor respondeu no formato pedido. */
    ok: boolean
    /** O modelo que atendeu, para o toast dizer qual foi testado. */
    model: string
    /** Quanto a chamada demorou; é o que denuncia o provedor lento antes de ele virar problema. */
    elapsed_ms: number
}
