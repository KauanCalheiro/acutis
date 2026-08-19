import { watchableVideo } from '@acutis/core/webdriver/runner/run-video.js'
import { createReadStream, existsSync, statSync } from 'node:fs'
import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeader,
  sendStream,
  setHeader,
  setResponseStatus
} from 'h3'

export default defineEventHandler(async (event) => {
  const requested = getQuery(event).path
  const path = typeof requested === 'string' ? requested : ''
  if (!path.endsWith('.webm') || !existsSync(path)) throw createError({ statusCode: 404 })

  const video = await watchableVideo(path)
  const size = statSync(video).size
  const range = getRequestHeader(event, 'range')

  setHeader(event, 'Content-Type', 'video/webm')
  setHeader(event, 'Accept-Ranges', 'bytes')

  if (!range) {
    setHeader(event, 'Content-Length', size)
    return sendStream(event, createReadStream(video))
  }

  const match = range.match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (match[1] === '' && match[2] === '')) {
    setHeader(event, 'Content-Range', `bytes */${size}`)
    throw createError({ statusCode: 416, message: 'Intervalo de vídeo inválido.' })
  }

  const suffix = match[1] === ''
  const requestedStart = suffix ? Math.max(size - Number(match[2]), 0) : Number(match[1])
  const requestedEnd = suffix || match[2] === '' ? size - 1 : Number(match[2])
  const start = requestedStart
  const end = Math.min(requestedEnd, size - 1)

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) {
    setHeader(event, 'Content-Range', `bytes */${size}`)
    throw createError({ statusCode: 416, message: 'Intervalo de vídeo inválido.' })
  }

  setResponseStatus(event, 206)
  setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
  setHeader(event, 'Content-Length', end - start + 1)
  return sendStream(event, createReadStream(video, { start, end }))
})
