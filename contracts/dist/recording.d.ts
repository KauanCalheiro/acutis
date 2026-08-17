import * as z from 'zod';
export declare const selectorsSchema: z.ZodObject<{
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
}, z.core.$strip>;
export type Selectors = z.output<typeof selectorsSchema>;
export declare const recordedAssertSchema: z.ZodObject<{
    assertType: z.ZodOptional<z.ZodString>;
    expectedValue: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type RecordedAssert = z.output<typeof recordedAssertSchema>;
export declare const recordedEventSchema: z.ZodObject<{
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
}, z.core.$strip>;
export type RecordedEvent = z.output<typeof recordedEventSchema>;
export declare const recorderEventSchema: z.ZodObject<{
    event: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    innerText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    value: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sensitive: z.ZodOptional<z.ZodBoolean>;
    selectors: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        dataTestId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        placeholder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        cssStable: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
    sessionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timestamp: z.ZodOptional<z.ZodNumber>;
    recordingStartedAt: z.ZodOptional<z.ZodNumber>;
    storageState: z.ZodOptional<z.ZodNullable<z.ZodLazy<z.ZodObject<{
        cookies: z.ZodArray<z.ZodUnknown>;
        origins: z.ZodArray<z.ZodUnknown>;
    }, z.core.$strip>>>>;
    inputType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
export type RecorderEvent = z.output<typeof recorderEventSchema>;
export declare const storageStateSchema: z.ZodObject<{
    cookies: z.ZodArray<z.ZodUnknown>;
    origins: z.ZodArray<z.ZodUnknown>;
}, z.core.$strip>;
export type StorageState = z.output<typeof storageStateSchema>;
