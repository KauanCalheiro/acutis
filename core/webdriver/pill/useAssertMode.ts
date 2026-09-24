import { ref, watch } from 'vue'
import type { AssertType, RecordingEvent } from '@/common/types/recording'
import { usePillState } from './usePillState'
import { useRecorderEvents } from './useRecorderEvents'

export interface PopoverPosition {
  left: number
  vertical: number
  above: boolean
  arrowLeft: number
  maxHeight: number
}

const POPOVER_WIDTH = 320
const ESTIMATED_HEIGHT = 200
const MARGIN = 16
const GAP = 12
const ARROW_SIZE = 12
/** A faixa do rodapé que a pill ocupa: 24px de distância, 44px de altura e 12px de respiro. */
const PILL_CLEARANCE = 80
/** Abaixo disso o balão espremido ao lado do elemento não serve, e ele usa a tela inteira. */
const MIN_SHRUNK_HEIGHT = 120

const pendingElement = ref<Element | null>(null)
const isPopoverVisible = ref(false)
const popoverHeight = ref<number | null>(null)
const popoverPosition = ref<PopoverPosition>({ left: 0, vertical: 0, above: true, arrowLeft: 0, maxHeight: 0 })

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function useAssertMode() {
  const { setCaptureMode, confirmAction } = usePillState()
  const { dispatch, buildBaseEvent, buildNavigateEvent } = useRecorderEvents()

  function activateAssertMode() {
    setCaptureMode('assert')
  }

  function deactivateAssertMode() {
    setCaptureMode(null)
    pendingElement.value = null
    popoverHeight.value = null
    isPopoverVisible.value = false
  }

  function handleElementClick(element: Element) {
    pendingElement.value = element
    popoverPosition.value = calculatePosition(element)
    isPopoverVisible.value = true
  }

  /** Onde o balão cabe inteiro junto ao elemento, sem sair da janela por nenhum lado. */
  function calculatePosition(element: Element): PopoverPosition {
    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const floor = viewportHeight - PILL_CLEARANCE
    const screenHeight = floor - MARGIN
    const measured = popoverHeight.value ?? ESTIMATED_HEIGHT

    const left = clamp(rect.left + rect.width / 2 - POPOVER_WIDTH / 2, MARGIN, window.innerWidth - POPOVER_WIDTH - MARGIN)
    const arrowLeft = clamp(rect.left + rect.width / 2 - left - 6, MARGIN, POPOVER_WIDTH - 28)

    const anchorTop = clamp(rect.top, 0, viewportHeight)
    const anchorBottom = clamp(rect.bottom, 0, viewportHeight)
    const spaceAbove = anchorTop - GAP - ARROW_SIZE
    const spaceBelow = floor - anchorBottom - GAP - ARROW_SIZE
    const fitsAbove = spaceAbove - MARGIN >= Math.min(measured, screenHeight)
    const fitsBelow = spaceBelow >= Math.min(measured, screenHeight)
    const above = fitsAbove || (!fitsBelow && spaceAbove >= spaceBelow)

    const room = above ? spaceAbove - MARGIN : spaceBelow
    const shrinks = !fitsAbove && !fitsBelow && room >= MIN_SHRUNK_HEIGHT
    const maxHeight = shrinks ? room : screenHeight
    const height = Math.min(measured, maxHeight)

    const preferredTop = above ? anchorTop - GAP - ARROW_SIZE - height : anchorBottom + GAP + ARROW_SIZE
    const top = clamp(preferredTop, MARGIN, floor - height)
    const vertical = above ? viewportHeight - top - height : top

    return { left, vertical, above, arrowLeft, maxHeight }
  }

  function recalculatePosition() {
    if (pendingElement.value) {
      popoverPosition.value = calculatePosition(pendingElement.value)
    }
  }

  /** A altura que o balão renderizou, para o cálculo parar de supor. */
  function setPopoverHeight(height: number) {
    popoverHeight.value = height
    recalculatePosition()
  }

  function confirmAssert(assertType: AssertType, expectedValue: string | null) {
    if (!pendingElement.value) return
    const event: RecordingEvent = {
      ...buildBaseEvent('assert', pendingElement.value),
      assert: { assertType, expectedValue }
    }
    dispatch(event, true)
    confirmAction('assert')
    deactivateAssertMode()
  }

  /** Grava o assert da URL atual, sem elemento envolvido. */
  function assertUrl() {
    const url = window.location.href
    const event: RecordingEvent = {
      ...buildNavigateEvent(),
      type: 'assert',
      label: null,
      assert: { assertType: 'url', expectedValue: url }
    }
    dispatch(event, true)
    confirmAction('url')
  }

  watch(isPopoverVisible, (visible) => {
    if (visible) {
      window.addEventListener('resize', recalculatePosition)
      window.addEventListener('scroll', recalculatePosition, true)
    } else {
      window.removeEventListener('resize', recalculatePosition)
      window.removeEventListener('scroll', recalculatePosition, true)
    }
  })

  return {
    pendingElement,
    isPopoverVisible,
    popoverPosition,
    activateAssertMode,
    deactivateAssertMode,
    handleElementClick,
    setPopoverHeight,
    confirmAssert,
    assertUrl
  }
}
