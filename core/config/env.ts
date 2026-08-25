import * as z from 'zod'
import { DEFAULT_TELEMETRY_KEY, DEFAULT_TELEMETRY_URL } from './telemetry-endpoint.js'

export type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal'

const logLevelSchema = z.enum([
  'log',
  'error',
  'warn',
  'debug',
  'verbose',
  'fatal'
])

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  CORS_ORIGIN: z.url().default('http://localhost:3000'),
  RECORDER_CDP_URL: z.string().default(''),
  RECORDER_HEADLESS: z.enum([
    '0',
    '1'
  ]).default('0'),
  LOG_LEVEL: z.string().default('log,error,warn,debug,verbose,fatal'),
  ACUTIS_APP_KEY: z.string().optional(),
  TELEMETRY_URL: z.string().default(DEFAULT_TELEMETRY_URL),
  TELEMETRY_KEY: z.string().default(DEFAULT_TELEMETRY_KEY),
  ANTHROPIC_URL: z.string().optional(),
  CLAUDE_AGENT_MODEL: z.string().optional(),
  CODEX_MODEL: z.string().optional(),
  CODEX_PATH: z.string().optional(),
  GEMINI_URL: z.string().optional(),
  OLLAMA_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().optional(),
  OPENAI_URL: z.string().optional(),
  OPENROUTER_URL: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional()
})

export interface AppConfig {
  port: number
  corsOrigin: string
  recorderCdpUrl: string
  recorderHeadless: boolean
  logLevels: LogLevel[]
  appKey?: string
  telemetry: {
    url: string
    key: string
  }
  providers: {
    anthropicUrl: string
    claudeAgentModel?: string
    codexModel?: string
    codexPath: string
    geminiUrl: string
    ollamaUrl: string
    ollamaModel: string
    openaiUrl: string
    openrouterUrl: string
    openrouterModel: string
  }
}

export function readAppConfig(environment: Record<string, string | undefined>): AppConfig {
  const result = environmentSchema.safeParse(environment)

  if (!result.success) {
    throw new Error(`Configuração inválida: ${z.prettifyError(result.error)}`)
  }

  const env = result.data
  const logLevels = env.LOG_LEVEL
    .split(',')
    .map(level => level.trim())
    .filter(Boolean)
    .map(level => logLevelSchema.parse(level))

  return {
    port: env.PORT,
    corsOrigin: env.CORS_ORIGIN,
    recorderCdpUrl: env.RECORDER_CDP_URL,
    recorderHeadless: env.RECORDER_HEADLESS === '1',
    logLevels,
    appKey: env.ACUTIS_APP_KEY,
    telemetry: {
      url: env.TELEMETRY_URL,
      key: env.TELEMETRY_KEY
    },
    providers: {
      anthropicUrl: env.ANTHROPIC_URL ?? 'https://api.anthropic.com/v1',
      claudeAgentModel: env.CLAUDE_AGENT_MODEL,
      codexModel: env.CODEX_MODEL,
      codexPath: env.CODEX_PATH ?? 'codex',
      geminiUrl: env.GEMINI_URL ?? 'https://generativelanguage.googleapis.com/v1beta/',
      ollamaUrl: env.OLLAMA_URL ?? 'http://localhost:11434',
      ollamaModel: env.OLLAMA_MODEL ?? 'llama3.1:8b',
      openaiUrl: env.OPENAI_URL ?? 'https://api.openai.com/v1',
      openrouterUrl: env.OPENROUTER_URL ?? 'https://openrouter.ai/api/v1',
      openrouterModel: env.OPENROUTER_MODEL ?? 'qwen/qwen3-coder'
    }
  }
}

export function processEnvironment(): NodeJS.ProcessEnv {
  return process.env
}

export const APP_CONFIG = readAppConfig(processEnvironment())
export const PORT = APP_CONFIG.port
export const CORS_ORIGIN = APP_CONFIG.corsOrigin
export const RECORDER_CDP_URL = APP_CONFIG.recorderCdpUrl
export const RECORDER_HEADLESS = APP_CONFIG.recorderHeadless
export const LOG_LEVELS = APP_CONFIG.logLevels
