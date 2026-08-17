import * as z from 'zod'
import { recordedEventSchema } from './recording.js'

export const authCredentialsRequestSchema = z.object({
    username: z.string(),
    password: z.string()
})
export type AuthCredentialsRequest = z.input<typeof authCredentialsRequestSchema>

export const updateAuthSetupRequestSchema = z.object({ authSetup: z.string() })
export type UpdateAuthSetupRequest = z.input<typeof updateAuthSetupRequestSchema>

export const authSetupSchema = z.object({ authSetup: z.string().nullable().optional() })
export type AuthSetupResponse = z.output<typeof authSetupSchema>

export const authRecordingRequestSchema = z.object({
    baseUrl: z.string(),
    events: z.array(recordedEventSchema),
    executionUrl: z.string().optional()
})
export type AuthRecordingRequest = z.input<typeof authRecordingRequestSchema>

export const generatedAuthSetupSchema = z.object({
    authSetup: z.string(),
    credentialsNeeded: z.boolean(),
    warnings: z.array(z.string())
})
export type GeneratedAuthSetup = z.output<typeof generatedAuthSetupSchema>
