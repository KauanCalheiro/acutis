import { createError, defineEventHandler, getRouterParam, sendNoContent } from 'h3'
import { videoService } from '../../utils/composition/recorder'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw createError({ statusCode: 400 })

  await videoService.delete(id)
  sendNoContent(event, 204)
})
