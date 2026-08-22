import * as z from 'zod'

export const selectorsSchema = z.object({
  dataTestId: z.string().nullish(),
  dataCy: z.string().nullish(),
  ariaLabel: z.string().nullish(),
  ariaRole: z.string().nullish(),
  id: z.string().nullish(),
  name: z.string().nullish(),
  placeholder: z.string().nullish(),
  cssStable: z.string().nullish(),
  xpath: z.string().nullish(),
  text: z.string().nullish(),
  finder: z.string().nullish()
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
  checked: z.boolean().nullable().optional(),
  assert: recordedAssertSchema.optional()
})

export type RecordedEvent = z.output<typeof recordedEventSchema>

export const storageStateSchema = z.object({
  cookies: z.array(z.unknown()),
  origins: z.array(z.unknown())
})

export const recorderEventSchema = z.object({
  event: z.string().optional(),
  type: z.string().optional(),
  url: z.string().optional(),
  html: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  innerText: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  sensitive: z.boolean().optional(),
  selectors: z.object({
    dataTestId: z.string().nullable().optional(),
    text: z.string().nullable().optional(),
    placeholder: z.string().nullable().optional(),
    cssStable: z.string().nullable().optional()
  }).passthrough().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  timestamp: z.number().optional(),
  recordingStartedAt: z.number().optional(),
  storageState: z.lazy(() => storageStateSchema).nullable().optional(),
  inputType: z.string().nullable().optional(),
  tagName: z.string().nullable().optional(),
  checked: z.boolean().nullable().optional(),
  assert: recordedAssertSchema.optional()
}).passthrough()

export type RecorderEvent = z.output<typeof recorderEventSchema>
export type StorageState = z.output<typeof storageStateSchema>
