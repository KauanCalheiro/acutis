import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { recorderService } from '../../utils/composition/recorder'
import { validatedBody } from '../../utils/http'

const bodySchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, bodySchema)
  await recorderService.debugResize(body.width, body.height)

  return { ok: true as const }
})
