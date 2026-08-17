import * as z from 'zod';
export declare const authCredentialsRequestSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type AuthCredentialsRequest = z.input<typeof authCredentialsRequestSchema>;
export declare const updateAuthSetupRequestSchema: z.ZodObject<{
    authSetup: z.ZodString;
}, z.core.$strip>;
export type UpdateAuthSetupRequest = z.input<typeof updateAuthSetupRequestSchema>;
export declare const authSetupSchema: z.ZodObject<{
    authSetup: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type AuthSetupResponse = z.output<typeof authSetupSchema>;
export declare const authRecordingRequestSchema: z.ZodObject<{
    baseUrl: z.ZodString;
    events: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        url: z.ZodString;
        timestamp: z.ZodOptional<z.ZodNumber>;
        selectors: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            dataTestId: z.ZodNullable<z.ZodString>;
            dataCy: z.ZodNullable<z.ZodString>;
            ariaLabel: z.ZodNullable<z.ZodString>;
            ariaRole: z.ZodNullable<z.ZodString>;
            id: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            placeholder: z.ZodNullable<z.ZodString>;
            cssStable: z.ZodNullable<z.ZodString>;
            xpath: z.ZodNullable<z.ZodString>;
            text: z.ZodNullable<z.ZodString>;
            finder: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>>;
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        value: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sensitive: z.ZodOptional<z.ZodBoolean>;
        tagName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        innerText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        inputType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        html: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        checked: z.ZodOptional<z.ZodBoolean>;
        assert: z.ZodOptional<z.ZodObject<{
            assertType: z.ZodOptional<z.ZodString>;
            expectedValue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    executionUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AuthRecordingRequest = z.input<typeof authRecordingRequestSchema>;
export declare const generatedAuthSetupSchema: z.ZodObject<{
    authSetup: z.ZodString;
    credentialsNeeded: z.ZodBoolean;
    warnings: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type GeneratedAuthSetup = z.output<typeof generatedAuthSetupSchema>;
