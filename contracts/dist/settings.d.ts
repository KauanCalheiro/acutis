import * as z from 'zod';
export declare const providerCredentialSchema: z.ZodObject<{
    key: z.ZodNullable<z.ZodString>;
    url: z.ZodNullable<z.ZodString>;
    model: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type ProviderCredential = z.output<typeof providerCredentialSchema>;
export declare const aiSettingsSchema: z.ZodObject<{
    provider: z.ZodString;
    configured: z.ZodBoolean;
    credentials: z.ZodRecord<z.ZodString, z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        model: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    providers: z.ZodArray<z.ZodString>;
    provider_urls: z.ZodRecord<z.ZodString, z.ZodString>;
    keyless_providers: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type AiSettings = z.output<typeof aiSettingsSchema>;
export declare const aiSettingsRequestSchema: z.ZodObject<{
    provider: z.ZodString;
    key: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    model: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type AiSettingsRequest = z.input<typeof aiSettingsRequestSchema>;
export declare const listModelsRequestSchema: z.ZodObject<{
    provider: z.ZodString;
    key: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type ListModelsRequest = z.input<typeof listModelsRequestSchema>;
export declare const pingModelRequestSchema: z.ZodObject<{
    provider: z.ZodString;
    key: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    model: z.ZodString;
}, z.core.$strip>;
export type PingModelRequest = z.input<typeof pingModelRequestSchema>;
export declare const availableModelSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
}, z.core.$strip>;
export type AvailableModel = z.output<typeof availableModelSchema>;
export declare const availableModelsSchema: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
}, z.core.$strip>>;
export declare const pingResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    model: z.ZodString;
    elapsed_ms: z.ZodNumber;
}, z.core.$strip>;
export type PingResponse = z.output<typeof pingResponseSchema>;
