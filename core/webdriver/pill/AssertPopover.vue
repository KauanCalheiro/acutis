<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { AssertType } from '@/common/types/recording'
import { useAssertMode } from './useAssertMode'
import PillIcon from './PillIcon.vue'
import type { PillIconName } from './pillIcon'

const {
  isPopoverVisible,
  pendingElement,
  popoverPosition,
  deactivateAssertMode,
  confirmAssert
} = useAssertMode()

interface AssertOption {
  type: AssertType
  label: string
  icon: PillIconName
  needsValue: boolean
  placeholder: string
  prefill?: () => string
}

const assertOptions: AssertOption[] = [
  {
    type: 'exists',
    label: 'Existe',
    icon: 'exists',
    needsValue: false,
    placeholder: ''
  },
  {
    type: 'visible',
    label: 'Visível',
    icon: 'visible',
    needsValue: false,
    placeholder: ''
  },
  {
    type: 'hidden',
    label: 'Oculto',
    icon: 'hidden',
    needsValue: false,
    placeholder: ''
  },
  {
    type: 'checked',
    label: 'Marcado',
    icon: 'checked',
    needsValue: false,
    placeholder: ''
  },
  {
    type: 'disabled',
    label: 'Desabilitado',
    icon: 'disabled',
    needsValue: false,
    placeholder: ''
  },
  {
    type: 'text',
    label: 'Texto igual a',
    icon: 'text',
    needsValue: true,
    placeholder: 'Texto esperado…',
    prefill: () =>
      (pendingElement.value as HTMLElement)?.innerText?.trim().slice(0, 200)
      ?? ''
  },
  {
    type: 'value',
    label: 'Valor igual a',
    icon: 'value',
    needsValue: true,
    placeholder: 'Valor esperado…',
    prefill: () => (pendingElement.value as HTMLInputElement)?.value ?? ''
  },
  {
    type: 'contains',
    label: 'Contém texto',
    icon: 'contains',
    needsValue: true,
    placeholder: 'Texto a conter…'
  }
]

const selectedType = ref<AssertType | null>(null)
const expectedValue = ref('')
const valueInputRef = ref<HTMLInputElement | null>(null)

const selectedOption = computed(() =>
  assertOptions.find(o => o.type === selectedType.value)
)
const canConfirm = computed(
  () =>
    selectedType.value !== null
    && (!selectedOption.value?.needsValue
      || expectedValue.value.trim().length > 0)
)

const positionStyle = computed(() => {
  const pos = popoverPosition.value
  return {
    left: pos.left + 'px',
    ...(pos.above
      ? { bottom: pos.vertical + 'px' }
      : { top: pos.vertical + 'px' })
  }
})

watch(selectedType, async (type) => {
  if (!type) return
  const option = assertOptions.find(o => o.type === type)
  expectedValue.value = option?.prefill ? option.prefill() : ''
  if (option?.needsValue) {
    await nextTick()
    valueInputRef.value?.focus()
  }
})

watch(isPopoverVisible, (visible) => {
  if (!visible) {
    selectedType.value = null
    expectedValue.value = ''
  }
})

const elementTag = computed(
  () => (pendingElement.value as Element | null)?.tagName?.toLowerCase() ?? ''
)
const elementLabel = computed(() => {
  const el = pendingElement.value as HTMLElement | null
  return (
    el?.getAttribute('aria-label') ?? el?.innerText?.trim().slice(0, 60) ?? ''
  )
})

function selectType(type: AssertType) {
  selectedType.value = selectedType.value === type ? null : type
}

function handleConfirm() {
  if (!canConfirm.value || !selectedType.value) return
  confirmAssert(
    selectedType.value,
    selectedOption.value?.needsValue ? expectedValue.value.trim() : null
  )
}
</script>

<template>
  <Transition name="popover">
    <div
      v-if="isPopoverVisible"
      class="surface assert-popover"
      :style="positionStyle"
      @click.stop
      @mousedown.stop
      @keydown.esc.stop.prevent="deactivateAssertMode"
      @keydown.enter.stop="handleConfirm"
    >
      <div
        class="popover-arrow"
        :class="popoverPosition.above ? 'place-above' : 'place-below'"
        :style="{ left: popoverPosition.arrowLeft + 'px' }"
      />

      <div class="popover-header">
        <span class="popover-element-tag">&lt;{{ elementTag }}&gt;</span>
        <span class="popover-element-label">{{ elementLabel }}</span>
        <button
          class="popover-close"
          tabindex="0"
          @click.stop.prevent="deactivateAssertMode"
        >
          ×
        </button>
      </div>

      <div
        class="popover-options"
        role="listbox"
        aria-label="Tipo de asserção"
      >
        <button
          v-for="option in assertOptions"
          :key="option.type"
          class="popover-option"
          :class="{ selected: selectedType === option.type }"
          role="option"
          :aria-selected="selectedType === option.type"
          @click.stop.prevent="selectType(option.type)"
          @mousedown.stop.prevent
        >
          <span
            class="popover-option-icon"
          >
            <PillIcon
              :name="option.icon"
              :size="16"
            />
          </span>
          <span>{{ option.label }}</span>
        </button>
      </div>

      <div
        class="popover-value-wrap"
        :class="{ visible: selectedOption?.needsValue }"
      >
        <input
          ref="valueInputRef"
          v-model="expectedValue"
          class="popover-value-input"
          type="text"
          :placeholder="selectedOption?.placeholder ?? ''"
          @keydown.esc.stop.prevent="deactivateAssertMode"
          @keydown.enter.stop.prevent="handleConfirm"
          @click.stop
          @mousedown.stop
        >
      </div>

      <div class="surface-actions popover-footer">
        <button
          class="surface-action"
          @click.stop.prevent="deactivateAssertMode"
          @mousedown.stop.prevent
        >
          Cancelar
        </button>
        <button
          class="surface-action surface-action-primary"
          :disabled="!canConfirm"
          @click.stop.prevent="handleConfirm"
          @mousedown.stop.prevent
        >
          Confirmar
        </button>
      </div>
    </div>
  </Transition>
</template>
