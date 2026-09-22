import { createReadStream } from 'node:fs'
import { extname } from 'node:path'
import { sendStream, setHeader, type H3Event } from 'h3'

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.zip': 'application/zip'
}

/** O tipo declarado para o arquivo do relatório; binário genérico quando a extensão é desconhecida. */
export function contentTypeOf(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

/** Um arquivo do relatório do Playwright com o tipo que o navegador exige para executá-lo. */
export function sendReportFile(event: H3Event, path: string) {
  setHeader(event, 'Content-Type', contentTypeOf(path))

  return sendStream(event, createReadStream(path))
}
