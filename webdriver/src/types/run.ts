export type RunEvent =
    | { event: 'run:started'; total: number }
    | { event: 'test:started'; title: string; file?: string }
    | { event: 'test:passed'; title: string; status: string; durationMs: number; error: null }
    | { event: 'test:failed'; title: string; status: string; durationMs: number; error: string | null }
    | { event: 'run:finished'; status: string; passed: boolean }
    | { event: 'run:error'; message: string }
