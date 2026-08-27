import { defineEventHandler, getRouterParam, createError } from 'h3'
import { videoService } from '../../utils/composition/recorder'
import { sendVideoFile } from '../../utils/video-file'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')!
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw createError({ statusCode: 400 })

  if (!videoService.exists(id)) throw createError({ statusCode: 404 })

  return sendVideoFile(event, videoService.path(id))
})
