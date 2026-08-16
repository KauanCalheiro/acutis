/**
 * O que fazer quando o provedor de IA falha: quantas vezes insistir e como explicar a recusa. Sem
 * isto o erro do SDK sobe cru e a tela mostra "Internal server error".
 */
import { ProviderFailed } from '../../../common/exceptions/errors.js'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'

/**
 * Quantas vezes reenviar quando a chamada falha por conexão. O padrão do LangChain são sete
 * tentativas, que somam mais de um minuto de espera antes de o usuário ver qualquer aviso.
 */
export const MAX_RETRIES = 1

/** O status HTTP que o provedor devolveu; o SDK ora o expõe, ora só o escreve no início da mensagem. */
function statusOf(error: unknown): number | null {
    const candidate = error as { status?: number, statusCode?: number, message?: string }
    const declared = candidate.status ?? candidate.statusCode

    if (typeof declared === 'number') return declared

    const written = /^(\d{3})\b/.exec(candidate.message ?? '')

    return written === null ? null : Number(written[1])
}

function reasonOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

/** O Claude Code é um binário local: ele falta ou não está logado, nunca responde um status HTTP. */
function missingClaudeCode(error: unknown): boolean {
    return /executable not found|native binary not found|failed to launch|failed to spawn/i.test(reasonOf(error))
}

export function providerFailure(config: ResolvedProvider, error: unknown): ProviderFailed {
    const provider = config.provider
    const model = config.model ?? 'o modelo cadastrado'

    if (missingClaudeCode(error)) {
        return new ProviderFailed(
            'O Claude Code não foi encontrado nesta máquina. Instale-o e rode `claude login` no terminal para este provedor funcionar.'
        )
    }

    switch (statusOf(error)) {
        case 429:
            return new ProviderFailed(
                `O provedor ${provider} atingiu o limite de uso no modelo ${model}. Espere alguns minutos ou escolha outro modelo nas configurações.`,
                429
            )

        case 401:
        case 403:
            return new ProviderFailed(
                `O provedor ${provider} recusou a credencial cadastrada. Confira-a nas configurações de inteligência artificial.`
            )

        case 404:
            return new ProviderFailed(
                `O provedor ${provider} não conhece o modelo ${model}, ou o endereço cadastrado para ele está errado.`
            )

        default:
            return new ProviderFailed(`Não foi possível falar com o provedor ${provider}: ${reasonOf(error)}`)
    }
}
