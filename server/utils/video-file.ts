import { createReadStream, statSync } from 'node:fs'
import {
  createError,
  getRequestHeader,
  sendStream,
  setHeader,
  setResponseStatus,
  type H3Event
} from 'h3'

/** O webm servido em pedaços: sem isso o player carrega em fila e não pula no tempo. */
export function sendVideoFile(event: H3Event, path: string) {
  const size = statSync(path).size
  const range = getRequestHeader(event, 'range')

  setHeader(event, 'Content-Type', 'video/webm')
  setHeader(event, 'Accept-Ranges', 'bytes')

  if (!range) {
    setHeader(event, 'Content-Length', size)
    return sendStream(event, createReadStream(path))
  }

  const match = range.match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (match[1] === '' && match[2] === '')) {
    setHeader(event, 'Content-Range', `bytes */${size}`)
    throw createError({ statusCode: 416, message: 'Intervalo de vídeo inválido.' })
  }

  const suffix = match[1] === ''
  const start = suffix ? Math.max(size - Number(match[2]), 0) : Number(match[1])
  const end = Math.min(suffix || match[2] === '' ? size - 1 : Number(match[2]), size - 1)

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) {
    setHeader(event, 'Content-Range', `bytes */${size}`)
    throw createError({ statusCode: 416, message: 'Intervalo de vídeo inválido.' })
  }

  setResponseStatus(event, 206)
  setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
  setHeader(event, 'Content-Length', end - start + 1)

  return sendStream(event, createReadStream(path, { start, end }))
}
