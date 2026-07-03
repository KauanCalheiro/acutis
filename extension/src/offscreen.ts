let mediaRecorder: MediaRecorder | null = null
let chunks: Blob[] = []
let currentSessionId: string | null = null
let currentFrontendUrl: string = 'http://localhost:3000'

chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' })

chrome.runtime.onMessage.addListener((msg: { type: string; streamId?: string; sessionId?: string; frontendUrl?: string }) => {
    if (msg.type === 'START_CAPTURE') {
        currentSessionId = msg.sessionId ?? null
        currentFrontendUrl = msg.frontendUrl || currentFrontendUrl
        chunks = []
        void startCapture(msg.streamId!)
    }

    if (msg.type === 'STOP_CAPTURE') {
        stopCapture()
    }
})

async function startCapture(streamId: string): Promise<void> {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                // @ts-expect-error
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId,
                },
            },
        })

        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' })
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data)
        }
        mediaRecorder.start(1000)
    } catch {
        chrome.runtime.sendMessage({ type: 'VIDEO_FAILED' })
    }
}

function stopCapture(): void {
    if (!mediaRecorder) {
        chrome.runtime.sendMessage({ type: 'VIDEO_FAILED' })
        return
    }

    const sessionId = currentSessionId
    const frontendUrl = currentFrontendUrl

    mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        try {
            const res = await fetch(`${frontendUrl.replace(/\/+$/, '')}/recording/${sessionId}`, {
                method: 'POST',
                body: blob,
                headers: { 'Content-Type': 'video/webm' },
            })
            if (!res.ok) throw new Error('upload failed')
            chrome.runtime.sendMessage({ type: 'VIDEO_READY', sessionId })
        } catch {
            chrome.runtime.sendMessage({ type: 'VIDEO_FAILED' })
        }
    }

    mediaRecorder.stop()
    mediaRecorder.stream.getTracks().forEach((t) => t.stop())
    mediaRecorder = null
}
