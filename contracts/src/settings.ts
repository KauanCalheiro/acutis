import * as z from 'zod'

export const providerCredentialSchema = z.object({ key: z.string().nullable(), url: z.string().nullable(), model: z.string().nullable() })
export type ProviderCredential = z.output<typeof providerCredentialSchema>

export const aiSettingsSchema = z.object({
    provider: z.string(), configured: z.boolean(), credentials: z.record(z.string(), providerCredentialSchema),
    providers: z.array(z.string()), provider_urls: z.record(z.string(), z.string()), keyless_providers: z.array(z.string())
})
export type AiSettings = z.output<typeof aiSettingsSchema>

export const aiSettingsRequestSchema = z.object({ provider: z.string(), key: z.string().nullable().optional(), url: z.string().nullable().optional(), model: z.string().nullable().optional() })
export type AiSettingsRequest = z.input<typeof aiSettingsRequestSchema>

export const listModelsRequestSchema = z.object({ provider: z.string(), key: z.string().nullable().optional(), url: z.string().nullable().optional() })
export type ListModelsRequest = z.input<typeof listModelsRequestSchema>

export const pingModelRequestSchema = listModelsRequestSchema.extend({ model: z.string() })
export type PingModelRequest = z.input<typeof pingModelRequestSchema>

export const availableModelSchema = z.object({ id: z.string(), label: z.string() })
export type AvailableModel = z.output<typeof availableModelSchema>
export const availableModelsSchema = z.array(availableModelSchema)

export const pingResponseSchema = z.object({ ok: z.boolean(), model: z.string(), elapsed_ms: z.number() })
export type PingResponse = z.output<typeof pingResponseSchema>
