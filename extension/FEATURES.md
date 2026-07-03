# Extensão Acutis — Chrome MV3 (base: legado)

Extensão instalável (Manifest V3, Vite + Vue via `@crxjs/vite-plugin`), portada do
projeto legado. O **frontend comanda por WebSocket**: envia START/STOP; a extensão
abre uma **aba anônima**, injeta o gravador a cada navegação, transmite os eventos
e grava a aba em vídeo (`tabCapture` + documento `offscreen`).

## Arquitetura

```
Frontend (/record) ──WS START/STOP──▶ background (service worker) ──abre aba anônima
      ▲                                     │ injeta recorder a cada navegação
      │                                     │ inicia tabCapture + offscreen
      └────WS recorder:event───────────────┘ (via relay /_ws)
                                        recorder (pill + captura) ──RECORD_EVENT──▶ background
                                        offscreen (MediaRecorder) ──POST /recording/{id}──▶ frontend
```

| Arquivo | Papel |
|---------|-------|
| `manifest.json` | MV3; permissões `tabs`, `windows`, `scripting`, `storage`, `activeTab`, `alarms`, `tabCapture`, `offscreen` |
| `src/background/index.ts` | WS ao frontend (reconexão/heartbeat/buffer/alarms), abre aba anônima, injeta recorder, repassa eventos, orquestra a captura de vídeo; handshake `WHO`/`recorder:hello` |
| `src/background/inject.ts` | injeta o content script (recorder) via `chrome.scripting` |
| `src/background/videoCaptureCoordinator.ts` | handshake com o documento offscreen (evita a race condition do legado: `OFFSCREEN_READY` só dispara uma vez por documento) |
| `src/offscreen.ts` / `src/offscreen.html` | documento offscreen: `getUserMedia` via `tabCapture` streamId, `MediaRecorder`, upload do blob final |
| `src/recorder/` | pill UI (Vue, shadow DOM), captura click/fill/submit/navigate, assert/hover mode, `useSelectorCapture` (@medv/finder) |
| `src/popup/` | popup com status de conexão |

Frontend: `frontend/app/pages/record.vue` (comanda via WS + eventos ao vivo),
`frontend/server/routes/_ws.ts` (WS + relay extensão↔página) e
`frontend/server/routes/recording/[id].{post,get}.ts` (upload/download local do vídeo, `.tmp/recordings/`).

## Protocolo WebSocket

- **frontend → extensão:** `{type:'WHO'}`, `{type:'START_RECORDING'}`, `{type:'STOP_RECORDING'}`
- **extensão → frontend:** `{event:'recorder:hello'}`, `recorder:started`, `recorder:error`, `recorder:stop` (com `sessionId` do vídeo gravado, se houver), e por evento gravado `recorder:{click|fill|submit|navigate|assert|hover}` com `selectors`, `label`, `value`, `url`.

## Vídeo

- Armazenamento por enquanto é local (`.tmp/recordings/{sessionId}.webm` no frontend) — sem persistência em backend/DB ainda; o frontend decide o que fazer com cada gravação numa próxima iteração.
- `sessionId` é gerado por gravação (`crypto.randomUUID()`) e correlaciona o vídeo com a sessão de eventos.

## Build e instalação

```bash
cd extension && pnpm install && pnpm build   # gera extension/dist/
```
1. `chrome://extensions` → **Modo do desenvolvedor** → **Load unpacked** → selecionar **`extension/dist`**.
2. Extensão → **Detalhes** → **Permitir no modo anônimo** (obrigatório).
3. `cd frontend && pnpm dev` → abrir `http://localhost:3000/record` → deve mostrar **Extensão conectada**.
4. **Gravar** → abre aba anônima → navegar/interagir → eventos aparecem em `/record`, vídeo sobe ao parar.

> `pnpm dev` na extensão = `vite build --watch` (rebuild no `dist/` a cada mudança; recarregue a extensão no Chrome).

## ✅ Validado

- Build + typecheck limpos; `dist/src/offscreen.html` no path esperado pelo manifest/`getURL`.
- Unit (Vitest): `videoCaptureCoordinator`, `useSelectorCapture`, `usePillState` — `extension/pnpm test`.
- E2E (Playwright + extensão real): injeção do recorder + captura de clique — `extension/pnpm test:e2e`.

## 🔜 Próxima iteração

- Persistir/normalizar eventos no backend (`/api/driver/ingest`); decidir o que fazer com os vídeos gravados localmente.
- Assert mode ponta a ponta; contador/pausa na pill; highlight do alvo.
- Indicador de seletor fraco + sugestão via IA. Empacotar/publicar (ID estável via `key`).
