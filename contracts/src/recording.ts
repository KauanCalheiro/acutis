import * as z from 'zod'

export const selectorsSchema = z.object({
    dataTestId: z.string().nullable(), dataCy: z.string().nullable(), ariaLabel: z.string().nullable(),
    ariaRole: z.string().nullable(), id: z.string().nullable(), name: z.string().nullable(),
    placeholder: z.string().nullable(), cssStable: z.string().nullable(), xpath: z.string().nullable(),
    text: z.string().nullable(), finder: z.string().nullable()
})

export type Selectors = z.output<typeof selectorsSchema>

export const recordedAssertSchema = z.object({
    assertType: z.string().optional(),
    expectedValue: z.string().nullable().optional()
})

export type RecordedAssert = z.output<typeof recordedAssertSchema>

export const recordedEventSchema = z.object({
    type: z.string(),
    url: z.string(),
    timestamp: z.number().optional(),
    selectors: selectorsSchema.nullable().optional(),
    label: z.string().nullable().optional(),
    value: z.string().nullable().optional(),
    sensitive: z.boolean().optional(),
    tagName: z.string().nullable().optional(),
    innerText: z.string().nullable().optional(),
    inputType: z.string().nullable().optional(),
    html: z.string().nullable().optional(),
    checked: z.boolean().optional(),
    assert: recordedAssertSchema.optional()
})

export type RecordedEvent = z.output<typeof recordedEventSchema>

export const recorderEventSchema = z.object({
    event: z.string().optional(),
    type: z.string().optional(),
    url: z.string().optional(),
    html: z.string().nullable().optional(), label: z.string().nullable().optional(), innerText: z.string().nullable().optional(),
    value: z.string().nullable().optional(), sensitive: z.boolean().optional(), selectors: z.object({
        dataTestId: z.string().nullable().optional(), text: z.string().nullable().optional(),
        placeholder: z.string().nullable().optional(), cssStable: z.string().nullable().optional()
    }).passthrough().nullable().optional(),
    sessionId: z.string().nullable().optional(), timestamp: z.number().optional(), recordingStartedAt: z.number().optional(),
    storageState: z.lazy(() => storageStateSchema).nullable().optional(), inputType: z.string().nullable().optional()
}).passthrough()

export type RecorderEvent = z.output<typeof recorderEventSchema>

export const storageStateSchema = z.object({
    cookies: z.array(z.unknown()),
    origins: z.array(z.unknown())
})

export type StorageState = z.output<typeof storageStateSchema>
