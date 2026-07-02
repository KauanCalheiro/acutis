# Extensão Acutis — Chrome MV3 (base: legado)

Extensão instalável (Manifest V3, Vite + Vue via `@crxjs/vite-plugin`), portada do
projeto legado em versão **enxuta** (sem captura de vídeo/offscreen/tabCapture).
O **frontend comanda por WebSocket**: envia START/STOP; a extensão abre uma
**aba anônima**, injeta o gravador a cada navegação e transmite os eventos.

## Arquitetura

```
Frontend (/record) ──WS START/STOP──▶ background (service worker) ──abre aba anônima
      ▲                                     │ injeta recorder a cada navegação
      └────WS recorder:event───────────────┘ (via relay /_ws)
                                        recorder (pill + captura) ──RECORD_EVENT──▶ background
```

| Arquivo | Papel |
|---------|-------|
| `manifest.json` | MV3; permissões `tabs`, `windows`, `scripting`, `storage`, `activeTab`, `alarms` |
| `src/background/index.ts` | WS ao frontend (reconexão/heartbeat/buffer/alarms), abre aba anônima, injeta recorder, repassa eventos; handshake `WHO`/`recorder:hello` |
| `src/background/inject.ts` | injeta o content script (recorder) via `chrome.scripting` |
| `src/recorder/` | pill UI (Vue, shadow DOM), captura click/fill/submit/navigate, assert/hover mode, `useSelectorCapture` (@medv/finder) |
| `src/popup/` | popup com status de conexão |

Frontend: `frontend/app/pages/record.vue` (comanda via WS + eventos ao vivo) e
`frontend/server/routes/_ws.ts` (WS + relay extensão↔página).

## Protocolo WebSocket

- **frontend → extensão:** `{type:'WHO'}`, `{type:'START_RECORDING'}`, `{type:'STOP_RECORDING'}`
- **extensão → frontend:** `{event:'recorder:hello'}`, `recorder:started`, `recorder:error`, `recorder:stop`, e por evento gravado `recorder:{click|fill|submit|navigate|assert|hover}` com `selectors`, `label`, `value`, `url`.

## Removido do legado (enxuto)

- `offscreen` + `tabCapture` (gravação de vídeo) e permissões relacionadas.
- Screenshot por evento (`captureVisibleTab`) e o passo `/recording-start`.
- Adicionado: máscara de campos `password` no `fill`.

## Build e instalação

```bash
cd extension && pnpm install && pnpm build   # gera extension/dist/
```
1. `chrome://extensions` → **Modo do desenvolvedor** → **Load unpacked** → selecionar **`extension/dist`**.
2. Extensão → **Detalhes** → **Permitir no modo anônimo** (obrigatório).
3. `cd frontend && pnpm dev` → abrir `http://localhost:3000/record` → deve mostrar **Extensão conectada**.
4. **Gravar** → abre aba anônima → navegar/interagir → eventos aparecem em `/record`.

> `pnpm dev` na extensão = `vite build --watch` (rebuild no `dist/` a cada mudança; recarregue a extensão no Chrome).

## ✅ Validado

- Build + typecheck limpos; manifest sem offscreen/tabCapture.
- E2E (Playwright + extensão real): `/record` mostra **Relay conectado** + **Extensão conectada** (WS + handshake).

## 🔜 Próxima iteração

- Persistir/normalizar eventos no backend (`/api/driver/ingest`).
- Assert mode ponta a ponta; contador/pausa na pill; highlight do alvo.
- Indicador de seletor fraco + sugestão via IA. Empacotar/publicar (ID estável via `key`).
