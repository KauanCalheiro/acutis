# Extensão Acutis — Chrome MV3 (base: legado)

Extensão instalável (Manifest V3, Vite + Vue via `@crxjs/vite-plugin`), portada do
projeto legado. O **frontend comanda por WebSocket**: envia START/STOP; a extensão
abre uma **aba anônima**, injeta o gravador a cada navegação, transmite os eventos
e grava a aba em vídeo via `getDisplayMedia`, disparado pelo primeiro clique real
do usuário na página gravada.

## Arquitetura

```
Frontend (/record) ──WS START/STOP──▶ background (service worker) ──abre aba anônima
      ▲                                     │ injeta recorder a cada navegação
      │                                     │ manda sessionId + frontendUrl no START
      └────WS recorder:event───────────────┘ (via relay /_ws)
                                        recorder (pill + captura) ──RECORD_EVENT──▶ background
                                        recorder (1º clique) ──getDisplayMedia+MediaRecorder──▶ POST /recording/{id}
```

| Arquivo | Papel |
|---------|-------|
| `manifest.json` | MV3; permissões `tabs`, `windows`, `scripting`, `storage`, `activeTab`, `alarms` |
| `src/background/index.ts` | WS ao frontend (reconexão/heartbeat/buffer/alarms), abre aba anônima, injeta recorder, repassa eventos, envia `sessionId`/`frontendUrl` no `START`; handshake `WHO`/`recorder:hello` |
| `src/background/inject.ts` | injeta o content script (recorder) via `chrome.scripting` |
| `src/recorder/pill/useVideoRecording.ts` | `createVideoRecordingGate` (dispara a captura só uma vez, no primeiro clique) + `startScreenCapture`/`stopScreenCapture` (`getDisplayMedia` + `MediaRecorder` + upload) |
| `src/recorder/` | pill UI (Vue, shadow DOM), captura click/fill/submit/navigate, assert/hover mode, `useSelectorCapture` (@medv/finder) |
| `src/popup/` | popup com status de conexão |

Frontend: `frontend/app/pages/record.vue` (comanda via WS + eventos ao vivo),
`frontend/server/routes/_ws.ts` (WS + relay extensão↔página) e
`frontend/server/routes/recording/[id].{post,get}.ts` (upload/download local do vídeo, `.tmp/recordings/`).

## Protocolo WebSocket

- **frontend → extensão:** `{type:'WHO'}`, `{type:'START_RECORDING'}`, `{type:'STOP_RECORDING'}`
- **extensão → frontend:** `{event:'recorder:hello'}`, `recorder:started`, `recorder:error`, `recorder:stop` (com `sessionId` do vídeo gravado, se houver), e por evento gravado `recorder:{click|fill|submit|navigate|assert|hover}` com `selectors`, `label`, `value`, `url`.

## Vídeo

- Captura via `navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true })`, direto no content script — sem `tabCapture`/`offscreen`/permissão extra no manifest. `tabCapture.getMediaStreamId` foi tentado primeiro e descartado: exige um gesto real do usuário invocando a extensão (clique no ícone/menu de contexto/atalho) mesmo com `host_permissions: ["<all_urls>"]`, o que não é automatizável no fluxo atual (start via WS, sem interação na aba).
- O disparo é o **primeiro clique real do usuário na aba gravada** (via `createVideoRecordingGate`) — nenhum botão extra, o diálogo nativo "Compartilhar aba" do Chrome aparece nesse clique e o usuário só confirma.
- Armazenamento por enquanto é local (`.tmp/recordings/{sessionId}.webm` no frontend) — sem persistência em backend/DB ainda; o frontend decide o que fazer com cada gravação numa próxima iteração.
- `sessionId` é gerado por gravação (`crypto.randomUUID()`) e correlaciona o vídeo com a sessão de eventos.

## Build e instalação

```bash
cd extension && pnpm install && pnpm build   # gera extension/dist/
```
1. `chrome://extensions` → **Modo do desenvolvedor** → **Load unpacked** → selecionar **`extension/dist`**.
2. Extensão → **Detalhes** → **Permitir no modo anônimo** (obrigatório).
3. `cd frontend && pnpm dev` → abrir `http://localhost:3000/record` → deve mostrar **Extensão conectada**.
4. **Gravar** → abre aba anônima → primeiro clique dispara o diálogo "Compartilhar aba" (confirmar) → eventos aparecem em `/record`, vídeo sobe ao parar.

> `pnpm dev` na extensão = `vite build --watch` (rebuild no `dist/` a cada mudança; recarregue a extensão no Chrome).

## ✅ Validado

- Build + typecheck limpos.
- Unit (Vitest): `useVideoRecording`, `useSelectorCapture`, `usePillState` — `extension/pnpm test`.
- E2E (Playwright + extensão real, totalmente automatizado via `--auto-select-tab-capture-source-by-title`): injeção do recorder + captura de clique + captura de vídeo real via `getDisplayMedia` + upload — `extension/pnpm test:e2e`.
- E2E cross-tool (`e2e/` na raiz): `/record` mostra eventos ao vivo e o player de vídeo depois do `recorder:stop`.

## 🔜 Próxima iteração

- Persistir/normalizar eventos no backend (`/api/driver/ingest`); decidir o que fazer com os vídeos gravados localmente.
- Assert mode ponta a ponta; contador/pausa na pill; highlight do alvo.
- Indicador de seletor fraco + sugestão via IA. Empacotar/publicar (ID estável via `key`).
