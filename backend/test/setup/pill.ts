function polyfillCssEscapeMissingInJsdom(): void {
    if (typeof globalThis.CSS !== 'undefined' && typeof globalThis.CSS.escape === 'function') return
    // @ts-expect-error o polyfill cobre só o `escape`, e não a interface CSS inteira
    globalThis.CSS = {
        escape(value: string) {
            return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
        },
    }
}

polyfillCssEscapeMissingInJsdom()
