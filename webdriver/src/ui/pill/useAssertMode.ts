import { ref, watch } from 'vue'
import type { AssertType, RecordingEvent } from '@/types/recording'
import { usePillState } from './usePillState'
import { useRecorderEvents } from './useRecorderEvents'

export interface PopoverPosition {
    left: number
    vertical: number
    above: boolean
    arrowLeft: number
}

const pendingElement = ref<Element | null>(null)
const isPopoverVisible = ref(false)
const popoverPosition = ref<PopoverPosition>({ left: 0, vertical: 0, above: true, arrowLeft: 0 })

export function useAssertMode() {
    const { setCaptureMode } = usePillState()
    const { dispatch, buildBaseEvent } = useRecorderEvents()

    function activateAssertMode() {
        setCaptureMode('assert')
    }

    function deactivateAssertMode() {
        setCaptureMode(null)
        pendingElement.value = null
        isPopoverVisible.value = false
    }

    function handleElementClick(element: Element) {
        pendingElement.value = element
        popoverPosition.value = calculatePosition(element)
        isPopoverVisible.value = true
    }

    function calculatePosition(element: Element): PopoverPosition {
        const rect = element.getBoundingClientRect()
        const popoverWidth = 320
        const gap = 12
        const arrowSize = 12

        let left = rect.left + rect.width / 2 - popoverWidth / 2
        left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, left))

        const arrowLeft = Math.max(16, Math.min(popoverWidth - 28, rect.left + rect.width / 2 - left - 6))

        const spaceAbove = rect.top - gap - arrowSize
        const spaceBelow = window.innerHeight - rect.bottom - gap - arrowSize
        const above = spaceAbove >= 200 || spaceAbove >= spaceBelow

        const vertical = above
            ? window.innerHeight - rect.top + gap + arrowSize
            : rect.bottom + gap + arrowSize

        return { left, vertical, above, arrowLeft }
    }

    function recalculatePosition() {
        if (pendingElement.value) {
            popoverPosition.value = calculatePosition(pendingElement.value)
        }
    }

    function confirmAssert(assertType: AssertType, expectedValue: string | null) {
        if (!pendingElement.value) return
        const event: RecordingEvent = {
            ...buildBaseEvent('assert', pendingElement.value),
            assert: { assertType, expectedValue },
        }
        dispatch(event, true)
        deactivateAssertMode()
    }

    watch(isPopoverVisible, (visible) => {
        if (visible) {
            window.addEventListener('resize', recalculatePosition)
        } else {
            window.removeEventListener('resize', recalculatePosition)
        }
    })

    return {
        pendingElement,
        isPopoverVisible,
        popoverPosition,
        activateAssertMode,
        deactivateAssertMode,
        handleElementClick,
        confirmAssert,
    }
}
