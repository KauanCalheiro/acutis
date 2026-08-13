/** Quanto tempo o mouse precisa ficar parado num elemento para contar como intenção de abrir algo. */
const DWELL_MS = 150

/** Quantos repousos guardar; o gatilho de um menu está sempre entre os últimos. */
const TRAIL_SIZE = 5

const trail: Element[] = []

let pending: number | null = null

/**
 * O elemento cujo hover revelou o que foi clicado. Menu que abre ao passar o mouse não gera evento
 * nenhum, então sem isto o teste gerado clica num item que ainda está fechado.
 *
 * Vale o último repouso, seja ele ancestral ou irmão: o :hover de um descendente sobe a árvore, e
 * é por isso que passar o mouse no rótulo do menu abre a lista que é irmã dele.
 *
 * ponytail: não confere se foi esse hover que revelou o alvo. Saber isso exigiria comparar o
 * estilo da página antes e depois de cada movimento do mouse.
 */
export function hoverTriggerFor(target: Element, resting: Element[]): Element | null {
    for (let position = resting.length - 1; position >= 0; position--) {
        const candidate = resting[position]

        if (candidate === target || target.contains(candidate)) continue
        if (candidate === document.body || candidate === document.documentElement) continue
        if (!reveals(candidate, target)) continue

        return candidate
    }

    return null
}

/**
 * O repouso só abriu o que foi clicado se o clicado nasceu ao lado dele — dentro do mesmo pai. O
 * mouse cruza meia página até chegar no alvo, e sem esta vizinhança todo carrossel e todo banner
 * que ficou no caminho virava passo de teste.
 */
function reveals(candidate: Element, target: Element): boolean {
    const parent = candidate.parentElement

    if (parent === null || parent === document.body || parent === document.documentElement) {
        return false
    }

    return parent.contains(target)
}

export function useHoverTrail() {
    function watch(el: Element): void {
        if (pending !== null) {
            window.clearTimeout(pending)
        }

        pending = window.setTimeout(() => {
            pending = null

            if (trail[trail.length - 1] === el) return

            trail.push(el)

            if (trail.length > TRAIL_SIZE) trail.shift()
        }, DWELL_MS)
    }

    function triggerFor(target: Element): Element | null {
        return hoverTriggerFor(target, trail)
    }

    function forget(): void {
        trail.length = 0
    }

    return { watch, triggerFor, forget }
}
