/** As configurações de IA: o provedor ativo, o cadastro de cada um e o que deles já dá para usar. */
import { pingModel } from '../ai/agents/ping.js'
import { type AvailableModel, listModels } from '../ai/providers/model-catalog.js'
import { isSupported } from '../ai/providers/provider-model.js'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { ValidationFailed } from '../../common/exceptions/errors.js'
import { PROVIDERS, PROVIDER_NAMES, defaultProviderUrls, keylessProviders, providerFromEnvironment } from './providers/ai-providers.js'
import { decrypt, encrypt } from './providers/crypto.js'
import { AiCredential } from './entities/ai-credential.entity.js'
import { Setting } from './entities/setting.entity.js'
import type { AiSettings, ProviderCredential, ResolvedProvider } from './entities/ai-settings.entity.js'
import type { PingResponse } from '../../dto/settings/responses/ping.response.js'

export type { AvailableModel } from '../ai/providers/model-catalog.js'

/** A chave global que guarda qual provedor está ativo. */
const AI_PROVIDER = 'ai.provider'

/** Campo em branco vira ausência. */
function blankToNull(value: string | null | undefined): string | null {
    return value === undefined || value === null || value.trim() === '' ? null : value
}

@Injectable()
export class SettingsService implements OnModuleInit {
    constructor(
        @InjectRepository(Setting) private readonly settings: Repository<Setting>,
        @InjectRepository(AiCredential) private readonly aiCredentials: Repository<AiCredential>
    ) {}

    /** Toda a tela conta com uma linha por provedor, então ela nasce junto com o banco. */
    async onModuleInit(): Promise<void> {
        await this.aiCredentials.upsert(
            PROVIDER_NAMES.map((provider) => ({ provider })),
            { conflictPaths: ['provider'], skipUpdateIfNoValuesChanged: true }
        )
    }

    /** O provedor ativo; sem nada gravado, o das variáveis de ambiente. Fora da lista, é sem IA. */
    async activeProvider(): Promise<string> {
        const stored = await this.storedProvider()

        return PROVIDER_NAMES.includes(stored) ? stored : ''
    }

    private async storedProvider(): Promise<string> {
        try {
            const row = await this.settings.findOneBy({ key: AI_PROVIDER })

            return row === null ? providerFromEnvironment() : (decrypt(row.value) ?? '')
        } catch {
            return providerFromEnvironment()
        }
    }

    async show(): Promise<AiSettings> {
        const provider = await this.activeProvider()

        return {
            provider,
            configured: provider !== '',
            credentials: await this.credentials(),
            providers: PROVIDER_NAMES,
            provider_urls: defaultProviderUrls(),
            keyless_providers: keylessProviders()
        }
    }

    /**
     * Grava o cadastro no provedor escolhido e o torna o ativo. Provedor vazio desliga a IA sem
     * tocar em cadastro nenhum.
     */
    async update(input: {
        provider: string
        key?: string | null
        url?: string | null
        model?: string | null
    }): Promise<AiSettings> {
        const provider = input.provider ?? ''

        await this.ensureHasKey(provider, input.key)

        await this.settings.save({ key: AI_PROVIDER, value: encrypt(provider) })

        if (provider !== '') {
            await this.aiCredentials.save({
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
        try {
            return await listModels(await this.configFrom(input))
        } catch (error) {
            throw new ValidationFailed({ provider: [(error as Error).message] })
        }
    }

    /** O que o formulário mandou por cima do cadastro guardado, e este por cima do padrão do provedor. */
    private async configFrom(
        input: { provider: string, key?: string | null, url?: string | null, model?: string | null }
    ): Promise<ResolvedProvider> {
        const defaults = PROVIDERS[input.provider] ?? {}
        const saved = await this.credentialOf(input.provider)

        return {
            provider: input.provider,
            key: blankToNull(input.key) ?? saved?.key ?? null,
            url: blankToNull(input.url) ?? saved?.url ?? defaults.url ?? null,
            model: blankToNull(input.model) ?? null
        }
    }

    /** Uma chamada de verdade ao modelo, para a tela saber se o cadastro funciona antes de gravá-lo. */
    async ping(input: { provider: string, key?: string | null, url?: string | null, model: string }): Promise<PingResponse> {
        const config = await this.configFrom(input)
        const started = Date.now()
        const result = await pingModel(config)

        return { ok: result.ok, model: input.model, elapsed_ms: Date.now() - started }
    }

    /** Se há provedor suportado e modelo informado — ou seja, se dá para chamar um modelo agora. */
    async canUseAi(): Promise<boolean> {
        const config = await this.resolved()

        if (config.provider === '' || !isSupported(config.provider)) return false

        return Boolean(config.model)
    }

    /** O cadastro do provedor ativo por cima dos padrões dele. */
    async resolved(): Promise<ResolvedProvider> {
        const provider = await this.activeProvider()
        const defaults = PROVIDERS[provider] ?? {}
        const saved = await this.credentialOf(provider)

        return {
            provider,
            key: saved?.key ?? null,
            url: saved?.url ?? defaults.url ?? null,
            model: saved?.model ?? defaults.model ?? null
        }
    }

    /** Cobra a chave de quem não é `keyless`, aceitando a que já estiver guardada. */
    private async ensureHasKey(provider: string, key?: string | null): Promise<void> {
        if (provider === '' || PROVIDERS[provider]?.keyless) return
        if (blankToNull(key) !== null) return
        if ((await this.credentialOf(provider))?.key) return

        const message = PROVIDERS[provider]?.keyError ?? 'A chave de API do provedor escolhido é obrigatória.'

        throw new ValidationFailed({ key: [message] })
    }

    /** O cadastro de cada provedor, chave inclusive. */
    private async credentials(): Promise<Record<string, ProviderCredential>> {
        const rows = await this.rows()

        return Object.fromEntries(rows.map((row) => [row.provider, this.toCredential(row)]))
    }

    private async credentialOf(provider: string): Promise<ProviderCredential | null> {
        const row = (await this.rows()).find((candidate) => candidate.provider === provider)

        return row === undefined ? null : this.toCredential(row)
    }

    private toCredential(row: AiCredential): ProviderCredential {
        return {
            key: decrypt(row.key),
            url: row.url,
            model: row.model
        }
    }

    /** Os cadastros gravados; lista vazia quando o banco ainda não existe. */
    private async rows(): Promise<AiCredential[]> {
        try {
            return await this.aiCredentials.find()
        } catch {
            return []
        }
    }
}
