import * as z from 'zod'

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'O nome é obrigatório.')
    .max(255, 'O nome não pode ter mais de 255 caracteres.'),
})

export type CreateProject = z.output<typeof createProjectSchema>

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
      'ssh_key',
    ]),
    token: z
      .string()
      .trim()
      .optional(),
    ssh_key: z
      .string()
      .trim()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.auth === 'token' && !data.token) {
      ctx.addIssue({
        code: 'custom',
        path: ['token'],
        message: 'O token é obrigatório para autenticação por token.',
      })
    }

    if (data.auth === 'ssh_key' && !data.ssh_key) {
      ctx.addIssue({
        code: 'custom',
        path: ['ssh_key'],
        message: 'A chave SSH é obrigatória para autenticação por chave.',
      })
    }
  })

export type CloneProject = z.output<typeof cloneProjectSchema>

export type ProjectFormTab = 'template' | 'git'
