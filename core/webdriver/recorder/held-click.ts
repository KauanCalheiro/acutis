import type { RecordingEvent } from '../../common/types/recording'

/** Keeps the click the page holds for the double click and delivers it when the page leaves first. */
export class HeldClickGuard {
  private held: RecordingEvent | null = null

  constructor(private readonly emit: (event: RecordingEvent) => void) { }

  hold(click: RecordingEvent): void {
    this.held = click
  }

  report(event: RecordingEvent): void {
    const held = this.held

    this.held = null
    if (held && !takesHeldPlace(held, event)) this.emit(held)
    this.emit(event)
  }

  flush(): void {
    if (this.held) this.emit(this.held)

    this.held = null
  }
}

function takesHeldPlace(held: RecordingEvent, event: RecordingEvent): boolean {
  return event.type === 'dblclick' || (event.type === 'click' && event.timestamp === held.timestamp)
}
