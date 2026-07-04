import type { RecordingEvent } from './recording.js'
import type { RunEvent } from './run.js'

export type OutgoingMessage =
    | { event: 'recorder:hello'; recording: boolean }
    | { event: 'recorder:started'; recordingStartedAt: number }
    | { event: 'recorder:stop'; sessionId: string | null }
    | RunEvent
    | ({ event: string } & Partial<RecordingEvent>)
