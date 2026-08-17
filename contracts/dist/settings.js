import * as z from 'zod';
export const providerCredentialSchema = z.object({ key: z.string().nullable(), url: z.string().nullable(), model: z.string().nullable() });
export const aiSettingsSchema = z.object({
    provider: z.string(), configured: z.boolean(), credentials: z.record(z.string(), providerCredentialSchema),
    providers: z.array(z.string()), provider_urls: z.record(z.string(), z.string()), keyless_providers: z.array(z.string())
});
export const aiSettingsRequestSchema = z.object({ provider: z.string(), key: z.string().nullable().optional(), url: z.string().nullable().optional(), model: z.string().nullable().optional() });
export const listModelsRequestSchema = z.object({ provider: z.string(), key: z.string().nullable().optional(), url: z.string().nullable().optional() });
export const pingModelRequestSchema = listModelsRequestSchema.extend({ model: z.string() });
export const availableModelSchema = z.object({ id: z.string(), label: z.string() });
export const availableModelsSchema = z.array(availableModelSchema);
export const pingResponseSchema = z.object({ ok: z.boolean(), model: z.string(), elapsed_ms: z.number() });
