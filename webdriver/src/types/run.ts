export type TestStatus = 'pending' | 'success' | 'failed' | 'skipped'

export type RunEvent =
    | { event: 'run:started'; total: number }
    | { event: 'test'; id: string; title: string; status: 'pending' }
    | { event: 'test'; id: string; title: string; status: 'success' | 'failed' | 'skipped'; durationMs: number; error: string | null }
    | { event: 'run:finished'; status: string; passed: boolean }
