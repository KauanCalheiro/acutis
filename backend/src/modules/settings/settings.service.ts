/** As configurações de IA: o provedor ativo, o cadastro de cada um e o que deles já dá para usar. */
import { type AvailableModel, listModels } from '../ai/providers/model-catalog.js'
import { isSupported } from '../ai/providers/provider-model.js'
import { Injectable } from '@nestjs/common'
import { ValidationFailed } from '../../common/exceptions/errors.js'
import { PROVIDERS, PROVIDER_NAMES, defaultProviderUrls, providerFromEnvironment } from './providers/ai-providers.js'
import { db, decrypt, encrypt } from './providers/database.js'
import type { AiSettings, ProviderCredential, ResolvedProvider } from './entities/ai-settings.entity.js'

/** A chave global que guarda qual provedor está ativo. */
const AI_PROVIDER = 'ai.provider'

interface CredentialRow {
    provider: string
    key: string | null
    url: string | null
    model: string | null
}

/** Campo em branco vira ausência. */
function blankToNull(value: string | null | undefined): string | null {
    return value === undefined || value === null || value.trim() === '' ? null : value
}

@Injectable()
export class SettingsService {
    /** O provedor ativo; sem nada gravado, o das variáveis de ambiente. Fora da lista, é sem IA. */
    activeProvider(): string {
        const stored = this.storedProvider()

        return PROVIDER_NAMES.includes(stored) ? stored : ''
    }

    private storedProvider(): string {
        try {
            const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(AI_PROVIDER) as
                | { value: string | null }
                | undefined

            return row === undefined ? providerFromEnvironment() : (decrypt(row.value) ?? '')
        } catch {
            return providerFromEnvironment()
        }
    }

    show(): AiSettings {
        const provider = this.activeProvider()

        return {
            provider,
            configured: provider !== '',
            credentials: this.credentials(),
            providers: PROVIDER_NAMES,
            provider_urls: defaultProviderUrls()
        }
    }

    /**
     * Grava o cadastro no provedor escolhido e o torna o ativo. Provedor vazio desliga a IA sem
     * tocar em cadastro nenhum.
     */
    update(input: {
        provider: string
        key?: string | null
        url?: string | null
        model?: string | null
    }): AiSettings {
        const provider = input.provider ?? ''

        this.ensureHasKey(provider, input.key)

        db()
            .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
            .run(AI_PROVIDER, encrypt(provider))

        if (provider !== '') {
            db()
                .prepare(`
                    INSERT INTO ai_settings (provider, key, url, model)
                    VALUES (@provider, @key, @url, @model)
                    ON CONFLICT(provider) DO UPDATE SET
                        key = excluded.key,
                        url = excluded.url,
                        model = excluded.model
                `)
                .run({
                    provider,
                    key: blankToNull(input.key) === null ? null : encrypt(input.key!),
                    url: blankToNull(input.url),
                    model: blankToNull(input.model)
                })
        }

        return this.show()
    }

    /**
     * Os modelos que o provedor oferece. Vale o que o formulário mandou; o que vier em branco cai
     * no cadastro guardado e depois no padrão do provedor.
     */
    async availableModels(input: { provider: string, key?: string | null, url?: string | null }): Promise<AvailableModel[]> {
        const defaults = PROVIDERS[input.provider] ?? {}
        const saved = this.credentialOf(input.provider)

        try {
            return await listModels({
                provider: input.provider,
                key: blankToNull(input.key) ?? saved?.key ?? null,
                url: blankToNull(input.url) ?? saved?.url ?? defaults.url ?? null,
                model: null
            })
        } catch (error) {
            throw new ValidationFailed({ provider: [(error as Error).message] })
        }
    }

    /** Se há provedor suportado e modelo informado — ou seja, se dá para chamar um modelo agora. */
    canUseAi(): boolean {
        const config = this.resolved()

        if (config.provider === '' || !isSupported(config.provider)) return false

        return Boolean(config.model)
    }

    /** O cadastro do provedor ativo por cima dos padrões dele. */
    resolved(): ResolvedProvider {
        const provider = this.activeProvider()
        const defaults = PROVIDERS[provider] ?? {}
        const saved = this.credentialOf(provider)

        return {
            provider,
            key: saved?.key ?? null,
            url: saved?.url ?? defaults.url ?? null,
            model: saved?.model ?? defaults.model ?? null
        }
    }

    /** Cobra a chave de quem não é `keyless`, aceitando a que já estiver guardada. */
    private ensureHasKey(provider: string, key?: string | null): void {
        if (provider === '' || PROVIDERS[provider]?.keyless) return
        if (blankToNull(key) !== null) return
        if (this.credentialOf(provider)?.key) return

        throw new ValidationFailed({ key: ['A chave de API do provedor escolhido é obrigatória.'] })
    }

    /** O cadastro de cada provedor, chave inclusive. */
    private credentials(): Record<string, ProviderCredential> {
        return Object.fromEntries(this.rows().map((row) => [row.provider, this.toCredential(row)]))
    }

    private credentialOf(provider: string): ProviderCredential | null {
        const row = this.rows().find((candidate) => candidate.provider === provider)

        return row === undefined ? null : this.toCredential(row)
    }

    private toCredential(row: CredentialRow): ProviderCredential {
        return {
            key: decrypt(row.key),
            url: row.url,
            model: row.model
        }
    }

    /** Os cadastros gravados; lista vazia quando o banco ainda não existe. */
    private rows(): CredentialRow[] {
        try {
            return db().prepare('SELECT * FROM ai_settings').all() as CredentialRow[]
        } catch {
            return []
        }
    }
}
