import * as z from 'zod'

export const environmentVarSchema = z.object({
  key: z.string(),
  value: z.string().nullable(),
  secret: z.boolean(),
  pending: z.boolean()
})

export type EnvironmentVar = z.output<typeof environmentVarSchema>
export type EditableVar = { key: string, value: string, secret: boolean, pending: boolean }

export const environmentSchema = z.object({
  slug: z.string(),
  name: z.string(),
  vars: z.array(environmentVarSchema)
})

export type Environment = z.output<typeof environmentSchema>

export const environmentListSchema = z.object({
  environments: z.array(environmentSchema),
  active: z.string().nullable(),
  known_keys: z.array(z.string())
})

export type EnvironmentList = z.output<typeof environmentListSchema>

export const environmentVarRequestSchema = z.object({
  key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'A chave da variável é inválida.'),
  value: z.string({ error: 'O valor da variável deve ser um texto.' }).nullable().optional(),
  secret: z.boolean({ error: 'O campo secreto deve ser verdadeiro ou falso.' }).optional()
})

export type EnvironmentVarRequest = z.input<typeof environmentVarRequestSchema>

export const environmentRequestSchema = z.object({
  name: z.string({ error: 'O nome do ambiente é obrigatório.' })
    .min(1, 'O nome do ambiente é obrigatório.')
    .max(60, 'O nome do ambiente é muito longo.'),
  vars: z.array(environmentVarRequestSchema, { error: 'As variáveis devem vir em uma lista.' }).default([])
})

export type EnvironmentRequest = z.input<typeof environmentRequestSchema>
