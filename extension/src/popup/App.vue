<template>
  <div class="popup">
    <div class="head">
      <span class="name">Acutis Recorder</span>
      <span class="version">v{{ version }}</span>
    </div>

    <label class="label" for="url">URL do frontend</label>
    <input
      id="url"
      v-model="url"
      class="input"
      placeholder="http://localhost:3000"
      spellcheck="false"
      @keyup.enter="connect"
    >

    <div class="row">
      <button
        class="btn"
        :disabled="saving"
        @click="connect"
      >
        {{ saving ? "Conectando…" : "Connect" }}
      </button>
      <button
        class="btn ghost"
        :disabled="!connected"
        @click="disconnect"
      >
        Disconnect
      </button>
    </div>

    <div
      class="status"
      :class="connected ? 'connected' : 'disconnected'"
    >
      {{ connected ? "● Conectado" : "○ Desconectado" }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue"

const version = __APP_VERSION__
const connected = ref(false)
const saving = ref(false)
const url = ref("http://localhost:3000")

let poll: number | undefined

function refresh() {
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
    connected.value = res?.connected ?? false
    if (res?.url && !saving.value) url.value = res.url
  })
}

function connect() {
  saving.value = true
  chrome.runtime.sendMessage({ type: "SET_FRONTEND_URL", url: url.value }, () => {
    setTimeout(() => {
      saving.value = false
      refresh()
    }, 500)
  })
}

function disconnect() {
  chrome.runtime.sendMessage({ type: "DISCONNECT" }, () => {
    connected.value = false
    setTimeout(refresh, 200)
  })
}

onMounted(() => {
  refresh()
  poll = window.setInterval(refresh, 1000)
})

onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
})
</script>

<style scoped>
.popup {
  width: 260px;
  padding: 14px;
  font-family: system-ui, sans-serif;
  color: #e5e7eb;
  background: #111827;
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}
.name { font-weight: 700; }
.version { font-size: 11px; opacity: .6; }
.label {
  display: block;
  font-size: 11px;
  opacity: .7;
  margin-bottom: 4px;
}
.input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  margin-bottom: 10px;
  border: 1px solid #374151;
  border-radius: 8px;
  background: #0b0f19;
  color: #e5e7eb;
  font-size: 13px;
}
.row {
  display: flex;
  gap: 8px;
}
.btn {
  flex: 1;
  padding: 9px;
  border: 0;
  border-radius: 8px;
  background: #6366f1;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.btn.ghost {
  background: transparent;
  border: 1px solid #374151;
  color: #e5e7eb;
}
.btn:disabled { opacity: .5; cursor: default; }
.status {
  margin-top: 10px;
  font-size: 12px;
  text-align: center;
}
.status.connected { color: #22c55e; }
.status.disconnected { color: #9ca3af; }
</style>
