<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue"
import type { AssertType } from "@/common/types/recording"
import { useAssertMode } from "./useAssertMode"

const {
  isPopoverVisible,
  pendingElement,
  popoverPosition,
  deactivateAssertMode,
  confirmAssert,
} = useAssertMode()

interface AssertOption {
  type: AssertType
  label: string
  icon: string
  needsValue: boolean
  placeholder: string
  prefill?: () => string
}

const ASSERT_ICONS: Record<AssertType, string> = {
  exists: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="8" rx="6" ry="4.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>`,
  visible: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8C2 8 4.5 3.5 8 3.5C11.5 3.5 14 8 14 8C14 8 11.5 12.5 8 12.5C4.5 12.5 2 8 2 8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>`,
  hidden: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6.5 4.2C7 4.07 7.5 4 8 4C11.5 4 14 8 14 8C13.4 9 12.6 9.9 11.7 10.6M9.5 11.7C9 11.9 8.5 12 8 12C4.5 12 2 8 2 8C2.5 7 3.3 6.1 4.2 5.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  checked: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 8L7 10.5L11 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  disabled: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="7" width="7" height="6.5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M7 7V5.5C7 4.4 7.9 3.5 9 3.5V3.5C10.1 3.5 11 4.4 11 5.5V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/></svg>`,
  text: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4.5H14M2 8H10M2 11.5H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  value: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10.5 2.5L13.5 5.5L5.5 13.5H2.5V10.5L10.5 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.5 4.5L11.5 7.5" stroke="currentColor" stroke-width="1.5"/></svg>`,
  contains: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L13.5 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 7H9M7 5V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  url: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5C7.3 10.3 8.8 10.6 9.9 9.5L11.9 7.5C13 6.4 13 4.6 11.9 3.5C10.8 2.4 9 2.4 7.9 3.5L7 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9.5 6.5C8.7 5.7 7.2 5.4 6.1 6.5L4.1 8.5C3 9.6 3 11.4 4.1 12.5C5.2 13.6 7 13.6 8.1 12.5L9 11.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
}

const assertOptions: AssertOption[] = [
  {
    type: "exists",
    label: "Existe",
    icon: ASSERT_ICONS.exists,
    needsValue: false,
    placeholder: "",
  },
  {
    type: "visible",
    label: "Visível",
    icon: ASSERT_ICONS.visible,
    needsValue: false,
    placeholder: "",
  },
  {
    type: "hidden",
    label: "Oculto",
    icon: ASSERT_ICONS.hidden,
    needsValue: false,
    placeholder: "",
  },
  {
    type: "checked",
    label: "Marcado",
    icon: ASSERT_ICONS.checked,
    needsValue: false,
    placeholder: "",
  },
  {
    type: "disabled",
    label: "Desabilitado",
    icon: ASSERT_ICONS.disabled,
    needsValue: false,
    placeholder: "",
  },
  {
    type: "text",
    label: "Texto igual a",
    icon: ASSERT_ICONS.text,
    needsValue: true,
    placeholder: "Texto esperado…",
    prefill: () =>
      (pendingElement.value as HTMLElement)?.innerText?.trim().slice(0, 200) ??
      "",
  },
  {
    type: "value",
    label: "Valor igual a",
    icon: ASSERT_ICONS.value,
    needsValue: true,
    placeholder: "Valor esperado…",
    prefill: () => (pendingElement.value as HTMLInputElement)?.value ?? "",
  },
  {
    type: "contains",
    label: "Contém texto",
    icon: ASSERT_ICONS.contains,
    needsValue: true,
    placeholder: "Texto a conter…",
  },
  {
    type: "url",
    label: "URL atual é",
    icon: ASSERT_ICONS.url,
    needsValue: true,
    placeholder: "URL esperada…",
    prefill: () => window.location.href,
  },
]

const selectedType = ref<AssertType | null>(null)
const expectedValue = ref("")
const valueInputRef = ref<HTMLInputElement | null>(null)

const selectedOption = computed(() =>
  assertOptions.find((o) => o.type === selectedType.value),
)
const canConfirm = computed(
  () =>
    selectedType.value !== null &&
    (!selectedOption.value?.needsValue ||
      expectedValue.value.trim().length > 0),
)

const positionStyle = computed(() => {
  const pos = popoverPosition.value
  return {
    left: pos.left + "px",
    ...(pos.above
      ? { bottom: pos.vertical + "px" }
      : { top: pos.vertical + "px" }),
  }
})

watch(selectedType, async (type) => {
  if (!type) return
  const option = assertOptions.find((o) => o.type === type)
  expectedValue.value = option?.prefill ? option.prefill() : ""
  if (option?.needsValue) {
    await nextTick()
    valueInputRef.value?.focus()
  }
})

watch(isPopoverVisible, (visible) => {
  if (!visible) {
    selectedType.value = null
    expectedValue.value = ""
  }
})

const elementTag = computed(
  () => (pendingElement.value as Element | null)?.tagName?.toLowerCase() ?? "",
)
const elementLabel = computed(() => {
  const el = pendingElement.value as HTMLElement | null
  return (
    el?.getAttribute("aria-label") ?? el?.innerText?.trim().slice(0, 60) ?? ""
  )
})

function selectType(type: AssertType) {
  selectedType.value = selectedType.value === type ? null : type
}

function handleConfirm() {
  if (!canConfirm.value || !selectedType.value) return
  confirmAssert(
    selectedType.value,
    selectedOption.value?.needsValue ? expectedValue.value.trim() : null,
  )
}
</script>

<template>
  <Transition name="popover">
    <div
      v-if="isPopoverVisible"
      class="assert-popover"
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
          @click.stop.prevent="deactivateAssertMode"
          tabindex="0"
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
            v-html="option.icon"
          />
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
        />
      </div>

      <div class="popover-footer">
        <button
          class="popover-footer-btn popover-btn-cancel"
          @click.stop.prevent="deactivateAssertMode"
          @mousedown.stop.prevent
        >
          Cancelar
        </button>
        <button
          class="popover-footer-btn popover-btn-confirm"
          :disabled="!canConfirm"
          @click.stop.prevent="handleConfirm"
          @mousedown.stop.prevent
        >
          Confirmar Assert
        </button>
      </div>
    </div>
  </Transition>
</template>
