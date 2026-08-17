import * as z from 'zod';
export declare const environmentVarSchema: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodNullable<z.ZodString>;
    secret: z.ZodBoolean;
    pending: z.ZodBoolean;
}, z.core.$strip>;
export type EnvironmentVar = z.output<typeof environmentVarSchema>;
export type EditableVar = {
    key: string;
    value: string;
    secret: boolean;
    pending: boolean;
};
export declare const environmentSchema: z.ZodObject<{
    slug: z.ZodString;
    name: z.ZodString;
    vars: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodNullable<z.ZodString>;
        secret: z.ZodBoolean;
        pending: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Environment = z.output<typeof environmentSchema>;
export declare const environmentListSchema: z.ZodObject<{
    environments: z.ZodArray<z.ZodObject<{
        slug: z.ZodString;
        name: z.ZodString;
        vars: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodNullable<z.ZodString>;
            secret: z.ZodBoolean;
            pending: z.ZodBoolean;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    active: z.ZodNullable<z.ZodString>;
    known_keys: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type EnvironmentList = z.output<typeof environmentListSchema>;
export declare const environmentVarRequestSchema: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    secret: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type EnvironmentVarRequest = z.input<typeof environmentVarRequestSchema>;
export declare const environmentRequestSchema: z.ZodObject<{
    name: z.ZodString;
    vars: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        secret: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type EnvironmentRequest = z.input<typeof environmentRequestSchema>;
