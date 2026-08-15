/**
 * A URL do sistema sob teste.
 *
 * Existe para o host e o caminho serem lidos de um lugar só: eram dois parses espalhados, e o
 * caminho da base é justamente o que o spec não pode repetir ao concatenar.
 */
export class Url {
    private readonly parsed: URL

    constructor(public readonly value: string) {
        try {
            this.parsed = new URL(value)
        } catch {
            throw new Error(`URL inválida: ${value}`)
        }

        if (!this.parsed.protocol.startsWith('http')) {
            throw new Error(`URL inválida: ${value}`)
        }
    }

    host(): string {
        return this.parsed.hostname
    }

    /** O caminho que a URL já traz, sem a barra final. */
    path(): string {
        return this.parsed.pathname.replace(/\/+$/, '')
    }

    toString(): string {
        return this.value
    }
}
