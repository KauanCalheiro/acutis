export interface VideoRecordingGate {
    readonly started: boolean
    handleClick(): void
    reset(): void
}

export function createVideoRecordingGate(startCapture: () => Promise<void>): VideoRecordingGate {
    let started = false

    return {
        get started() {
            return started
        },
        handleClick() {
            if (started) return
            started = true
            void startCapture()
        },
        reset() {
            started = false
        },
    }
}

interface ActiveCapture {
    recorder: MediaRecorder
    chunks: Blob[]
    stream: MediaStream
}

export async function startScreenCapture(): Promise<ActiveCapture> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: false,
        // @ts-expect-error
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
    })

    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' })
    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.start(1000)

    return { recorder, chunks, stream }
}

export async function stopScreenCapture(capture: ActiveCapture, sessionId: string, frontendUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
        capture.recorder.onstop = async () => {
            capture.stream.getTracks().forEach((t) => t.stop())
            const blob = new Blob(capture.chunks, { type: 'video/webm' })
            try {
                const res = await fetch(`${frontendUrl.replace(/\/+$/, '')}/recording/${sessionId}`, {
                    method: 'POST',
                    body: blob,
                    headers: { 'Content-Type': 'video/webm' },
                })
                resolve(res.ok)
            } catch {
                resolve(false)
            }
        }
        capture.recorder.stop()
    })
}
