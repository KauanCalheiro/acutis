import type { RecordingEvent } from './recording.js'

export type OutgoingMessage =
    | { event: 'recorder:hello'; recording: boolean }
    | { event: 'recorder:started'; recordingStartedAt: number }
    | { event: 'recorder:stop'; sessionId: string | null }
    | ({ event: string } & Partial<RecordingEvent>)
