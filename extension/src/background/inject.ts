type ContentScriptEntry = chrome.runtime.ManifestV3['content_scripts'] extends (infer T)[] | undefined ? T : never

function getJs(index: number): string[] {
    const manifest = chrome.runtime.getManifest() as chrome.runtime.ManifestV3
    const entry = manifest.content_scripts?.[index] as ContentScriptEntry | undefined
    return entry?.js ?? []
}

export async function injectRecorder(tabId: number): Promise<void> {
    const js = getJs(0)
    if (js.length === 0) return
    await chrome.scripting.executeScript({ target: { tabId }, files: js }).catch(() => { })
}
