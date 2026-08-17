import * as z from 'zod';
export const environmentVarSchema = z.object({
    key: z.string(),
    value: z.string().nullable(),
    secret: z.boolean(),
    pending: z.boolean()
});
export const environmentSchema = z.object({
    slug: z.string(),
    name: z.string(),
    vars: z.array(environmentVarSchema)
});
export const environmentListSchema = z.object({
    environments: z.array(environmentSchema),
    active: z.string().nullable(),
    known_keys: z.array(z.string())
});
export const environmentVarRequestSchema = z.object({ key: z.string(), value: z.string().nullable().optional(), secret: z.boolean().optional() });
export const environmentRequestSchema = z.object({
    name: z.string(),
    vars: z.array(environmentVarRequestSchema).default([])
});
