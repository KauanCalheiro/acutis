/**
 * O diário de requisições: uma linha JSON por requisição atendida, com o que entrou, o que saiu e
 * toda chamada HTTP que ela disparou para fora.
 */
import type { CallHandler, ExecutionContext, INestApplication, NestInterceptor } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express'
import type { Observable } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { acutis } from '../utils/acutis.js'

export interface Payload {
    headers?: Record<string, string>
    body?: unknown
}

export interface OutboundCall {
    method: string
    url: string
    status: number | null
    durationMs: number
    /** Desde o início da requisição. */
    startedAtMs: number
    request: Payload
    response: Payload
    error?: string
}

export interface RequestEntry {
    id: string
    at: string
    method: string
    url: string
    status: number
    durationMs: number
    request: Payload
    response: Payload
    outbound: OutboundCall[]
    error: string | null
}

/** O que uma requisição acumula enquanto é atendida. */
interface Store {
    startedAt: number
    outbound: OutboundCall[]
    responseBody?: unknown
    error?: string
}

const store = new AsyncLocalStorage<Store>()

/** Por quantos dias o diário guarda um arquivo. */
const RETENTION_DAYS = 7

/** O teto de cada payload guardado. */
const MAX_PAYLOAD = 4_000

/** Os nomes de campo cujo valor nunca é escrito. */
const SECRET = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[-_]?key|key|token|secret|password|senha|pass)$/i

const REDACTED = '[redigido]'

function isSecret(name: string): boolean {
    return SECRET.test(name.trim())
}

/** Redige o valor de todo campo secreto, em qualquer profundidade. */
function redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redact)

    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .map(([name, item]) => [name, isSecret(name) ? REDACTED : redact(item)])
        )
    }

    return value
}

/** O valor redigido e dentro do teto; acima dele, cortado. */
function capture(value: unknown): unknown {
    if (value === undefined || value === null || value === '') return undefined

    const clean = redact(value)
    const text = JSON.stringify(clean)

    if (text === undefined) return undefined

    return text.length <= MAX_PAYLOAD
        ? clean
        : `[truncado, ${text.length} caracteres] ${text.slice(0, MAX_PAYLOAD)}`
}

function captureHeaders(headers: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(headers).map(([name, value]) => [
            name.toLowerCase(),
            isSecret(name) ? REDACTED : String(value)
        ])
    )
}

/** O corpo como objeto quando ele é JSON; o texto cru quando não é. */
function parsed(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

/** O pedaço de texto que cada formato de streaming carrega. */
function delta(chunk: unknown): string | null {
    const piece = chunk as {
        message?: { content?: unknown }
        choices?: { delta?: { content?: unknown } }[]
        response?: unknown
    }

    const value = piece?.message?.content ?? piece?.choices?.[0]?.delta?.content ?? piece?.response

    return typeof value === 'string' ? value : null
}

/**
 * A resposta que veio em pedaços (NDJSON do Ollama, `data:` do SSE), remontada no texto que ela
 * formava. Null quando o corpo não é streaming.
 */
function joinStreamed(text: string): string | null {
    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line !== '')

    if (lines.length < 2) return null

    const parts: string[] = []

    for (const line of lines) {
        const payload = line.startsWith('data:') ? line.slice(5).trim() : line

        if (payload === '[DONE]') continue

        let chunk: unknown

        try {
            chunk = JSON.parse(payload)
        } catch {
            return null
        }

        const piece = delta(chunk)

        if (piece === null) return null

        parts.push(piece)
    }

    return parts.length === 0 ? null : parts.join('')
}

export function logDir(): string {
    const dir = join(acutis().root, 'runtime/logs')

    mkdirSync(dir, { recursive: true })

    return dir
}

function fileFor(date: Date): string {
    return `requests-${date.toISOString().slice(0, 10)}.jsonl`
}

/** O arquivo do dia cuja limpeza já rodou, por raiz do acutis. */
let purgedFor = ''

/** Apaga os arquivos que passaram da retenção, uma vez por arquivo do dia. */
function purge(dir: string, current: string): void {
    const key = join(dir, current)

    if (purgedFor === key) return

    purgedFor = key

    const limit = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000

    for (const file of readdirSync(dir)) {
        if (!file.startsWith('requests-') || !file.endsWith('.jsonl')) continue

        const path = join(dir, file)

        if (statSync(path).mtimeMs < limit) rmSync(path, { force: true })
    }
}

function write(entry: RequestEntry): void {
    try {
        const dir = logDir()
        const file = fileFor(new Date())

        purge(dir, file)

        appendFileSync(join(dir, file), `${JSON.stringify(entry)}\n`)
    } catch {
        // Diário quebrado não derruba requisição.
    }
}

let installed = false

/** Embrulha o `fetch` global uma vez, para anotar toda chamada feita dentro de uma requisição. */
function installFetchCapture(): void {
    if (installed) return

    installed = true

    const original = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const current = store.getStore()

        if (!current) return original(input, init)

        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
        const startedAt = Date.now()

        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))

        const call: OutboundCall = {
            method,
            url,
            status: null,
            durationMs: 0,
            startedAtMs: startedAt - current.startedAt,
            request: {
                headers: captureHeaders(Object.fromEntries(headers.entries())),
                body: typeof init?.body === 'string' ? capture(parsed(init.body)) : undefined
            },
            response: {}
        }

        current.outbound.push(call)

        try {
            const response = await original(input, init)

            call.status = response.status
            call.durationMs = Date.now() - startedAt
            call.response.headers = captureHeaders(Object.fromEntries(response.headers.entries()))

            const text = await response.clone().text()
            const joined = joinStreamed(text)

            call.response.body = capture(joined === null ? parsed(text) : parsed(joined))

            return response
        } catch (error) {
            call.durationMs = Date.now() - startedAt
            call.error = error instanceof Error ? error.message : String(error)

            throw error
        }
    }
}

/** Recolhe o corpo que o controller devolveu e o erro que ele lançou. */
@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const current = store.getStore()

        return next.handle().pipe(
            tap((body) => {
                if (current) current.responseBody = body
            }),
            catchError((error: unknown) => {
                if (current) current.error = error instanceof Error ? error.message : String(error)

                throw error
            })
        )
    }
}

/** Liga o diário no app: o contexto da requisição, a captura de saída e o interceptor. */
export function installRequestLog(app: INestApplication): void {
    installFetchCapture()

    app.use((request: ExpressRequest, response: ExpressResponse, next: NextFunction) => {
        const current: Store = { startedAt: Date.now(), outbound: [] }

        response.on('finish', () => write({
            id: randomUUID(),
            at: new Date(current.startedAt).toISOString(),
            method: request.method,
            url: request.originalUrl,
            status: response.statusCode,
            durationMs: Date.now() - current.startedAt,
            request: {
                headers: captureHeaders(request.headers as Record<string, unknown>),
                body: capture(request.body)
            },
            response: { body: capture(current.responseBody) },
            outbound: current.outbound,
            error: current.error ?? null
        }))

        store.run(current, next)
    })

    app.useGlobalInterceptors(new RequestLogInterceptor())
}
