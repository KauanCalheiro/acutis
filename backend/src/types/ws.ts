import type { RecordingEvent } from './recording.js'
import type { StorageState } from '../recorder/recorder.service.js'

export type OutgoingMessage =
    | { event: 'recorder:hello'; recording: boolean }
    | { event: 'recorder:started'; recordingStartedAt: number }
    | { event: 'recorder:stop'; sessionId: string | null; storageState: StorageState | null }
    | { event: 'recorder:error'; error: string }
    | ({ event: string } & Partial<RecordingEvent>)
