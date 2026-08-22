<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useReplay } from './useReplay'

defineOptions({ name: 'ReplayCurtain' })

const { state, watch, decide, stopWatching } = useReplay()

onMounted(() => void watch())
onUnmounted(() => stopWatching())
</script>

<template>
  <!-- A cortina é o que segura o usuário: enquanto ela está no ar, o clique dele não chega na
       página, e por isso não se perde. A ferramenta age por baixo, sem passar pelo ponteiro. -->
  <div
    v-if="state.status !== 'idle'"
    class="curtain"
    :class="{ 'curtain-failed': state.status === 'failed' }"
  >
    <div class="curtain-card">
      <template v-if="state.status === 'running'">
        <span class="curtain-spinner" />
        <p class="curtain-title">
          Refazendo seus passos
        </p>
        <p class="curtain-step">
          {{ state.step }}
        </p>
        <p class="curtain-hint">
          Aguarde — a gravação é sua quando isto sair da frente.
        </p>
      </template>

      <template v-else>
        <p class="curtain-title">
          Não consegui refazer um passo
        </p>
        <p class="curtain-step">
          {{ state.step }}
        </p>
        <p class="curtain-hint">
          A página pode não estar onde o teste esperava.
        </p>
        <div class="curtain-actions">
          <button
            class="curtain-action"
            data-acutis="retomada-assumir"
            @click="decide('resume')"
          >
            Assumir daqui
          </button>
          <button
            class="curtain-action curtain-action-ghost"
            data-acutis="retomada-cancelar"
            @click="decide('cancel')"
          >
            Cancelar
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
