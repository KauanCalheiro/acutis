import * as z from 'zod'
import { recordedEventSchema } from './recording.js'

export const draftRecordingRequestSchema = z.object({
    baseUrl: z.string(),
    events: z.array(recordedEventSchema),
    executionUrl: z.string().nullable().optional(),
    isPublic: z.boolean().optional(),
    sessionId: z.string().nullable().optional(),
    recordedAt: z.string().nullable().optional(),
    video: z.string().nullable().optional()
})
export type DraftRecordingRequest = z.input<typeof draftRecordingRequestSchema>

export const writeTestRequestSchema = z.object({
    title: z.string(),
    path: z.string(),
    domain: z.string(),
    gherkin: z.string().nullable().optional(),
    playwright: z.string(),
    tags: z.array(z.string()).optional(),
    events: z.array(recordedEventSchema).nullable().optional(),
    envVars: z.array(z.string()).optional()
})
export type WriteTestRequest = z.input<typeof writeTestRequestSchema>

export const testDraftSchema = z.object({
    title: z.string(),
    tags: z.array(z.string()),
    domain: z.string(),
    path: z.string(),
    gherkin: z.string(),
    playwright: z.string(),
    events: z.array(recordedEventSchema).optional(),
    envVars: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional()
})
export type TestDraft = z.output<typeof testDraftSchema>

export const writtenTestSchema = z.object({
    gherkin: z.string().nullable(),
    playwright: z.string(),
    spec: z.string(),
    feature: z.string().nullable()
})
export type WrittenTest = z.output<typeof writtenTestSchema>

export const writeTestResponseSchema = writtenTestSchema.extend({ testRun: z.null() })
export type WriteTestResponse = z.output<typeof writeTestResponseSchema>
