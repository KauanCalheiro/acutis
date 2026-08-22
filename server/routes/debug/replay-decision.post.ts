import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { recorderService } from '../../utils/composition/recorder'
import { validatedBody } from '../../utils/http'

const bodySchema = z.object({ decision: z.enum(['resume', 'cancel']) })

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, bodySchema)
  recorderService.decideReplay(body.decision)

  return { ok: true as const }
})
