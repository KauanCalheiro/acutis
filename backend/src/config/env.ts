import type { LogLevel } from '@nestjs/common'

export const PORT = Number(process.env.PORT) || 4000
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'
export const RECORDER_CDP_URL = process.env.RECORDER_CDP_URL || ''

export const RECORDER_HEADLESS = process.env.RECORDER_HEADLESS === '1'

// Níveis do logger do Nest. O `acutis` publicado sobe a API dentro do próprio processo do
// terminal, e ali o inventário de rotas do boot só atrapalha — ele passa LOG_LEVEL=error e
// fica só com o que indica problema. Vazio silencia tudo.
export const LOG_LEVELS = (process.env.LOG_LEVEL ?? 'log,error,warn,debug,verbose,fatal')
    .split(',')
    .map((level) => level.trim())
    .filter(Boolean) as LogLevel[]
