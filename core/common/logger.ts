export class Logger {
  constructor(private readonly context?: string) {}

  warn(message: unknown): void {
    console.warn(this.context ? `[${this.context}] ${String(message)}` : message)
  }
}
