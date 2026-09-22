import { writeTestRequestSchema } from '#shared/contracts/generation'
import type * as z from 'zod'

export const scenarioDraftSchema = writeTestRequestSchema.pick({
  title: true,
  path: true,
  domain: true,
  gherkin: true,
  playwright: true,
  tags: true
})

export const authDraftSchema = scenarioDraftSchema.pick({
  title: true,
  gherkin: true,
  playwright: true
})

export type ScenarioDraft = z.input<typeof scenarioDraftSchema>
export type AuthDraft = z.input<typeof authDraftSchema>
