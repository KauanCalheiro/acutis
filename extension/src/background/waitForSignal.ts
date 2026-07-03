export function waitForSignal<TMessage>(
    onMessage: (listener: (msg: TMessage) => void) => void,
    offMessage: (listener: (msg: TMessage) => void) => void,
    matches: (msg: TMessage) => boolean,
    timeoutMs: number,
): Promise<void> {
    return new Promise((resolve) => {
        let done = false

        function finish(): void {
            if (done) return
            done = true
            offMessage(listener)
            resolve()
        }

        function listener(msg: TMessage): void {
            if (matches(msg)) finish()
        }

        onMessage(listener)
        setTimeout(finish, timeoutMs)
    })
}
