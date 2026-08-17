import * as z from 'zod';
export declare const probeRepositoryRequestSchema: z.ZodObject<{
    url: z.ZodString;
}, z.core.$strip>;
export type ProbeRepositoryRequest = z.input<typeof probeRepositoryRequestSchema>;
export declare const probeRepositoryResponseSchema: z.ZodObject<{
    public: z.ZodBoolean;
}, z.core.$strip>;
export type ProbeRepositoryResponse = z.output<typeof probeRepositoryResponseSchema>;
