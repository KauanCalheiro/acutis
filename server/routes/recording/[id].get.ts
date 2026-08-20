import { defineEventHandler, getRouterParam, setHeader, sendStream, createError } from 'h3'
import { videoService } from '../../utils/composition/recorder'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')!
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw createError({ statusCode: 400 })

  if (!videoService.exists(id)) throw createError({ statusCode: 404 })

  setHeader(event, 'Content-Type', 'video/webm')
  return sendStream(event, videoService.openStream(id))
})
