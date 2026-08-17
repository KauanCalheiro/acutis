import * as z from 'zod';
import { recordedEventSchema } from './recording.js';
export const authCredentialsRequestSchema = z.object({
    username: z.string(),
    password: z.string()
});
export const updateAuthSetupRequestSchema = z.object({ authSetup: z.string() });
export const authSetupSchema = z.object({ authSetup: z.string().nullable().optional() });
export const authRecordingRequestSchema = z.object({
    baseUrl: z.string(),
    events: z.array(recordedEventSchema),
    executionUrl: z.string().optional()
});
export const generatedAuthSetupSchema = z.object({
    authSetup: z.string(),
    credentialsNeeded: z.boolean(),
    warnings: z.array(z.string())
});
