import * as z from 'zod';
export const probeRepositoryRequestSchema = z.object({ url: z.string() });
export const probeRepositoryResponseSchema = z.object({ public: z.boolean() });
