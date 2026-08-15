/**
 * As configurações de IA. Aqui vieram parar as Actions `ShowAiSettings` e `UpdateAiSettings`,
 * agrupadas por domínio em vez de uma classe por operação.
 *
 * O que o Laravel fazia em três lugares — o middleware `ApplyAiSettings` sobrepondo o config, o
 * model com o cast `encrypted`, e as duas Actions — cabe aqui porque não existe config global a
 * mutar: quem precisa do provedor ativo chama `resolved()` e recebe o cadastro já aplicado sobre os
 * padrões.
 */
import { Injectable } from '@nestjs/common'
import { ValidationFailed } from '../kernel/errors.js'
import { PROVIDERS, PROVIDER_NAMES, defaultProviderUrls, providerFromEnvironment } from './ai-providers.js'
import { db, decrypt, encrypt } from './database.js'
import type { AiSettings, ProviderCredential, ResolvedProvider } from './entities/ai-settings.entity.js'

/** A chave global que guarda qual provedor está ativo. O cadastro de cada um mora em `ai_settings`. */
const AI_PROVIDER = 'ai.provider'

interface CredentialRow {
    provider: string
    key: string | null
    url: string | null
    model_cheapest: string | null
    model_smartest: string | null
}

/** Campo em branco é ausência: é assim que o padrão do provedor volta a valer. */
function blankToNull(value: string | null | undefined): string | null {
    return value === undefined || value === null || value.trim() === '' ? null : value
}

@Injectable()
export class SettingsService {
    /**
     * O provedor ativo. Sem nada gravado valem as variáveis de ambiente, que é como o projeto
     * funcionava antes desta tela existir.
     *
     * O `catch` cobre a instalação que ainda não tem banco: sem ele, toda rota responderia 500 até
     * alguém criar o arquivo.
     */
    activeProvider(): string {
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
     * Grava o cadastro no provedor escolhido e o torna o ativo. Campo em branco é gravado em
     * branco: a tela devolve o que está guardado, então apagar na tela é ordem de apagar.
     *
     * Sem provedor é a escolha "sem IA": nenhum cadastro é tocado, para religar não pedir a chave
     * de novo.
     */
    update(input: {
        provider: string
        key?: string | null
        url?: string | null
        modelCheapest?: string | null
        modelSmartest?: string | null
    }): AiSettings {
        const provider = input.provider ?? ''

        this.ensureHasKey(provider, input.key)

        db()
            .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
            .run(AI_PROVIDER, encrypt(provider))

        if (provider !== '') {
            db()
                .prepare(`
                    INSERT INTO ai_settings (provider, key, url, model_cheapest, model_smartest)
                    VALUES (@provider, @key, @url, @cheapest, @smartest)
                    ON CONFLICT(provider) DO UPDATE SET
                        key = excluded.key,
                        url = excluded.url,
                        model_cheapest = excluded.model_cheapest,
                        model_smartest = excluded.model_smartest
                `)
                .run({
                    provider,
                    key: blankToNull(input.key) === null ? null : encrypt(input.key!),
                    url: blankToNull(input.url),
                    cheapest: blankToNull(input.modelCheapest),
                    smartest: blankToNull(input.modelSmartest)
                })
        }

        return this.show()
    }

    /**
     * O cadastro do provedor ativo por cima dos padrões — o que o middleware `ApplyAiSettings`
     * escrevia no config a cada requisição. É o ponto de leitura de quem for chamar um modelo.
     */
    resolved(): ResolvedProvider {
        const provider = this.activeProvider()
        const defaults = PROVIDERS[provider] ?? {}
        const saved = this.credentialOf(provider)

        return {
            provider,
            key: saved?.key ?? null,
            url: saved?.url ?? defaults.url ?? null,
            modelCheapest: saved?.model_cheapest ?? defaults.modelCheapest ?? null,
            modelSmartest: saved?.model_smartest ?? defaults.modelSmartest ?? null
        }
    }

    /**
     * Provedor que fala com serviço de terceiro precisa de chave, e ficar ativo sem ela só
     * produziria 401 na primeira geração. Provedor local não tem o que pedir, e "sem IA" não tem
     * provedor nenhum a quem pedir.
     *
     * A regra não cabe no DTO porque depende do que já está guardado: reativar um provedor que já
     * tem chave não pode exigir digitá-la de novo.
     */
    private ensureHasKey(provider: string, key?: string | null): void {
        if (provider === '' || PROVIDERS[provider]?.keyless) return
        if (blankToNull(key) !== null) return
        if (this.credentialOf(provider)?.key) return

        throw new ValidationFailed({ key: ['A chave de API do provedor escolhido é obrigatória.'] })
    }

    /**
     * O cadastro de cada provedor, chave inclusive. Ela volta para a tela de propósito: o acutis
     * roda na máquina de quem o usa, sem multiusuário, e conferir a chave que está guardada vale
     * mais do que esconder de quem a digitou. A tela a mostra mascarada, com botão de revelar.
     */
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
            model_cheapest: row.model_cheapest,
            model_smartest: row.model_smartest
        }
    }

    /** Lista vazia quando o banco ainda não existe — o mesmo motivo do `catch` de `activeProvider`. */
    private rows(): CredentialRow[] {
        try {
            return db().prepare('SELECT * FROM ai_settings').all() as CredentialRow[]
        } catch {
            return []
        }
    }
}
