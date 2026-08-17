import * as z from 'zod';
import { recorderEventSchema } from './recording.js';
export const scenarioSchema = z.object({
    title: z.string(),
    spec: z.string(),
    feature: z.string().nullable(),
    tags: z.array(z.string()),
    domain: z.string().nullable()
});
export const scenarioRunStepSchema = z.object({
    title: z.string(),
    status: z.enum(['waiting', 'running', 'success', 'failed']),
    duration_ms: z.number(),
    error: z.string().nullable()
});
export const scenarioRunSchema = z.object({
    started_at: z.string(), duration_ms: z.number(), passed: z.boolean(),
    branch: z.string().nullable(), author: z.string().nullable(), steps: z.array(scenarioRunStepSchema),
    playwright: z.string(), video_path: z.string().nullable()
});
export const scenarioDetailSchema = scenarioSchema.extend({
    playwright: z.string(),
    gherkin: z.string().nullable(),
    events: z.array(recorderEventSchema),
    updated_at: z.string(),
    is_auth: z.boolean(),
    runs: z.array(scenarioRunSchema)
});
export const updateScenarioRequestSchema = z.object({
    title: z.string(), path: z.string(), domain: z.string().nullable().optional(),
    gherkin: z.string().nullable().optional(), playwright: z.string(), tags: z.array(z.string()).optional()
});
export const scenarioFixRequestSchema = z.object({ step: z.string(), error: z.string() });
export const fixedSpecSchema = z.object({ playwright: z.string(), summary: z.string() });
export const selectorSuggestionSchema = z.object({
    event: z.string(), currentSelector: z.string(), suggestedTestId: z.string(), reason: z.string()
});
export const runProjectRequestSchema = z.object({ spec: z.string().optional(), grep: z.string().optional() }).passthrough();
export const runProjectResponseSchema = z.object({ passed: z.boolean(), output: z.string() });
