import * as z from 'zod';
import { scenarioSchema } from './scenario.js';
export const createProjectSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'O nome é obrigatório.')
        .max(255, 'O nome não pode ter mais de 255 caracteres.')
});
export const cloneProjectSchema = z
    .object({
    url: z
        .string()
        .trim()
        .min(1, 'A URL do repositório é obrigatória.'),
    name: z
        .string()
        .trim()
        .max(255, 'O nome não pode ter mais de 255 caracteres.')
        .optional(),
    branch: z
        .string()
        .trim()
        .max(255, 'A branch não pode ter mais de 255 caracteres.')
        .optional(),
    auth: z.enum([
        'public',
        'token',
        'ssh_key'
    ]).default('public'),
    token: z.string().trim().optional(),
    ssh_key: z.string().trim().optional()
})
    .superRefine((data, context) => {
    if (data.auth === 'token' && !data.token) {
        context.addIssue({
            code: 'custom',
            path: [
                'token'
            ],
            message: 'O token é obrigatório para autenticação por token.'
        });
    }
    if (data.auth === 'ssh_key' && !data.ssh_key) {
        context.addIssue({
            code: 'custom',
            path: [
                'ssh_key'
            ],
            message: 'A chave SSH é obrigatória para autenticação por chave.'
        });
    }
});
export const projectSchema = z.object({
    name: z.string(),
    slug: z.string(),
    path: z.string(),
    repository: z.string().nullable(),
    provider: z.enum([
        'github',
        'gitlab'
    ]).nullable(),
    created_at: z.string()
});
export const projectDetailSchema = projectSchema.extend({
    branch: z.string().nullable(),
    updated_at: z.string(),
    scenarios: z.array(scenarioSchema),
    auth_status: z.enum([
        'unset',
        'skipped',
        'configured',
        'failing'
    ]),
    base_url: z.string().nullable(),
    storage_state: z.string(),
    requires_url: z.boolean(),
    vscode_url: z.string(),
    has_report: z.boolean()
});
export const paginationMetaSchema = z.object({
    current_page: z.number().int().nonnegative(),
    per_page: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
});
export const projectsResponseSchema = z.object({
    data: z.array(projectSchema),
    meta: paginationMetaSchema
});
export const updateProjectSchema = z.object({ name: z.string() });
export const projectSettingsSchema = z.object({ baseUrl: z.string() });
export const projectBaseUrlResponseSchema = z.object({ base_url: z.string().nullable() });
