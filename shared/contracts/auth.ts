import * as z from 'zod'
import { recordedEventSchema } from './recording'

export const authCredentialsRequestSchema = z.object({
  username: z.string().trim().min(1, 'O usuário é obrigatório.'),
  password: z.string().min(1, 'A senha é obrigatória.')
})

export type AuthCredentialsRequest = z.input<typeof authCredentialsRequestSchema>

export const updateAuthSetupRequestSchema = z.object({
  authSetup: z.string().min(1, 'O conteúdo do setup de autenticação é obrigatório.')
})
export type UpdateAuthSetupRequest = z.input<typeof updateAuthSetupRequestSchema>

export const authSetupSchema = z.object({ authSetup: z.string().nullable().optional() })
export type AuthSetupResponse = z.output<typeof authSetupSchema>

export const authRecordingRequestSchema = z.object({
  baseUrl: z.url('A URL base deve ser uma URL válida.'),
  events: z.array(recordedEventSchema).min(1, 'A gravação precisa conter ao menos um evento.'),
  executionUrl: z.string().optional()
})

export type AuthRecordingRequest = z.input<typeof authRecordingRequestSchema>

export const generatedAuthSetupSchema = z.object({
  authSetup: z.string(),
  credentialsNeeded: z.boolean(),
  warnings: z.array(z.string())
})

export type GeneratedAuthSetup = z.output<typeof generatedAuthSetupSchema>
