import type { RecordingEvent } from '@/types/recording'
import { injectRecorder } from './inject'
import { waitForSignal } from './waitForSignal'

// Service worker: conecta ao frontend por WS (o frontend comanda START/STOP),
// abre a aba anônima, injeta o recorder a cada navegação e repassa os eventos.

const DEFAULT_FRONTEND_URL = 'http://localhost:3000'
let frontendUrl = DEFAULT_FRONTEND_URL

function wsUrl(): string {
    return frontendUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/_ws?source=extension-bg'
}

let ws: WebSocket | null = null
let disabled = false // true = desconectado manualmente (não reconecta até Connect)
const pendingMessages: string[] = []
let activeTabId: number | null = null
let isRecording = false
let recordingStarted = false
let recordingWindowId: number | null = null
let heartbeatInterval: number | null = null
let reconnectTimeout: number | null = null
let currentSessionId: string | null = null
let captureStarted = false

function isOpen(): boolean {
    return !!ws && ws.readyState === WebSocket.OPEN
}

function sendToNuxt(data: object): void {
    const text = JSON.stringify(data)
    if (isOpen()) {
        ws!.send(text)
    } else {
        pendingMessages.push(text)
        connectWs()
    }
}

function clearHeartbeat(): void {
    if (heartbeatInterval !== null) {
        clearInterval(heartbeatInterval)
        heartbeatInterval = null
    }
}

function startHeartbeat(): void {
    clearHeartbeat()
    heartbeatInterval = setInterval(() => {
        if (isOpen()) ws!.send(JSON.stringify({ type: 'PING' }))
    }, 15000) as unknown as number
}

function scheduleReconnect(): void {
    if (reconnectTimeout !== null) return
    reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null
        connectWs()
    }, 1500) as unknown as number
}

function connectWs(): void {
    if (disabled) return
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return

    try {
        ws = new WebSocket(wsUrl())
    } catch {
        scheduleReconnect()
        return
    }

    ws.onopen = () => {
        startHeartbeat()
        sendToNuxt({ event: 'recorder:hello', recording: isRecording }) // anuncia presença
        while (pendingMessages.length > 0 && isOpen()) {
            ws!.send(pendingMessages.shift()!)
        }
    }

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'PONG') return
            void handleNuxtMessage(msg)
        } catch { /* mensagem não-JSON */ }
    }

    ws.onerror = () => {
        try { ws?.close() } catch { /* noop */ }
    }

    ws.onclose = () => {
        clearHeartbeat()
        ws = null
        scheduleReconnect()
    }
}

async function handleNuxtMessage(msg: { type: string }): Promise<void> {
    if (msg.type === 'WHO') sendToNuxt({ event: 'recorder:hello', recording: isRecording })
    if (msg.type === 'START_RECORDING') await handleStartRecording()
    if (msg.type === 'STOP_RECORDING') await handleStopRecording()
}

async function handleStartRecording(): Promise<void> {
    const allowed = await chrome.extension.isAllowedIncognitoAccess().catch(() => false)
    if (!allowed) {
        sendToNuxt({
            event: 'recorder:error',
            error: 'Extensão sem acesso ao modo anônimo. Abra chrome://extensions, selecione Acutis Recorder, clique em "Detalhes" e ative "Permitir em modo anônimo".',
        })
        return
    }

    let win: chrome.windows.Window
    try {
        win = await chrome.windows.create({ incognito: true, state: 'normal', url: 'about:blank' })
    } catch (e) {
        sendToNuxt({ event: 'recorder:error', error: `Falha ao criar janela anônima: ${(e as Error).message}` })
        return
    }

    const tab = win.tabs?.[0]
    if (!tab?.id) {
        sendToNuxt({ event: 'recorder:error', error: 'Janela anônima sem aba inicial' })
        return
    }

    recordingWindowId = win.id ?? null
    activeTabId = tab.id
    isRecording = true
    recordingStarted = false
    currentSessionId = crypto.randomUUID()
    captureStarted = false
    // aba abre em about:blank; ao navegar para uma página http(s) o recorder é injetado
}

async function handleStopRecording(): Promise<void> {
    if (!isRecording && recordingWindowId === null) return

    const winId = recordingWindowId
    const tabId = activeTabId
    const wasCapturing = captureStarted

    isRecording = false
    recordingStarted = false
    activeTabId = null
    recordingWindowId = null

    let stopMessageSent = false
    if (tabId !== null) {
        try {
            chrome.tabs.sendMessage(tabId, { type: 'STOP' })
            stopMessageSent = true
        } catch { /* aba já fechada */ }
    }
    if (wasCapturing && stopMessageSent) {
        await waitForSignal(
            (l) => chrome.runtime.onMessage.addListener(l),
            (l) => chrome.runtime.onMessage.removeListener(l),
            (msg: { type: string }) => msg.type === 'VIDEO_READY' || msg.type === 'VIDEO_FAILED',
            8000,
        )
    }
    if (winId !== null) {
        try { await chrome.windows.remove(winId) } catch { /* janela já fechada */ }
    }
    if (!wasCapturing) {
        sendToNuxt({ event: 'recorder:stop', sessionId: null })
    }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (!isRecording || tabId !== activeTabId || info.status !== 'complete') return
    const url = tab.url ?? ''
    if (!/^https?:\/\//.test(url)) return

    injectRecorder(tabId).then(() => {
        try {
            chrome.tabs.sendMessage(tabId, { type: 'START', sessionId: currentSessionId, frontendUrl })
        } catch { /* noop */ }
        if (!recordingStarted) {
            recordingStarted = true
            sendToNuxt({ event: 'recorder:started' })
        }
    }).catch(() => { /* páginas restritas */ })
})

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeTabId) void handleStopRecording()
})

chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === recordingWindowId) void handleStopRecording()
})

function handleRecordEvent(ev: RecordingEvent): void {
    sendToNuxt({ event: `recorder:${ev.type}`, ...ev })
}

chrome.runtime.onMessage.addListener((message: { type: string; event?: RecordingEvent; url?: string; sessionId?: string }, sender, sendResponse) => {
    if (message.type === 'RECORD_EVENT' && message.event) handleRecordEvent(message.event)

    if (message.type === 'STOP_RECORDING' || message.type === 'RECORDER_STOPPED') void handleStopRecording()

    if (message.type === 'VIDEO_CAPTURE_STARTED') {
        captureStarted = true
    }

    if (message.type === 'VIDEO_READY') {
        sendToNuxt({ event: 'recorder:stop', sessionId: message.sessionId ?? null })
        captureStarted = false
    }

    if (message.type === 'VIDEO_FAILED') {
        sendToNuxt({ event: 'recorder:stop', sessionId: null })
        captureStarted = false
    }

    if (message.type === 'RECORDER_QUERY_ACTIVE') {
        const active = isRecording && sender.tab?.id === activeTabId
        sendResponse({ active, sessionId: active ? currentSessionId : null, frontendUrl: active ? frontendUrl : null })
        return false
    }

    if (message.type === 'GET_STATUS') {
        if (!isOpen()) connectWs()
        sendResponse({ connected: isOpen(), url: frontendUrl })
        return false
    }

    if (message.type === 'SET_FRONTEND_URL' && typeof message.url === 'string') {
        frontendUrl = message.url.trim() || DEFAULT_FRONTEND_URL
        void chrome.storage.local.set({ frontendUrl })
        disabled = false
        if (reconnectTimeout !== null) { clearTimeout(reconnectTimeout); reconnectTimeout = null }
        try { ws?.close() } catch { /* noop */ }
        ws = null
        connectWs()
        sendResponse({ ok: true, url: frontendUrl })
        return false
    }

    if (message.type === 'DISCONNECT') {
        disabled = true
        if (reconnectTimeout !== null) { clearTimeout(reconnectTimeout); reconnectTimeout = null }
        clearHeartbeat()
        try { ws?.close() } catch { /* noop */ }
        ws = null
        sendResponse({ ok: true, connected: false })
        return false
    }
})

chrome.alarms.create('ws-keepalive', { periodInMinutes: 0.4 })
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'ws-keepalive' && !disabled && !isOpen()) connectWs()
})

// carrega a URL salva e conecta
chrome.storage.local.get('frontendUrl').then(({ frontendUrl: saved }) => {
    if (typeof saved === 'string' && saved) frontendUrl = saved
    connectWs()
})
