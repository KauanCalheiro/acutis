export const PORT = Number(process.env.PORT) || 4000
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'
export const RECORDER_CDP_URL = process.env.RECORDER_CDP_URL || ''

// Gravação é uma pessoa usando o sistema, então o padrão é janela visível. Headless existe para
// quem dirige o recorder por API — a suíte E2E e agentes — sem roubar o foco de quem está no micro.
export const RECORDER_HEADLESS = process.env.RECORDER_HEADLESS === '1'
