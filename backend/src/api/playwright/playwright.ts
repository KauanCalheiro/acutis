/**
 * O conteúdo de um arquivo Playwright, de cenário ou de login.
 *
 * Guarda o que toda regra precisa perguntar sobre ele, para cada regra ficar só com o julgamento e
 * nenhuma repetir a mesma expressão regular.
 */
export class Playwright {
    constructor(public readonly value: string) {}

    lines(): string[] {
        return this.value.split('\n')
    }

    has(needle: string): boolean {
        return this.value.includes(needle)
    }

    matches(pattern: RegExp): boolean {
        return pattern.test(this.value)
    }

    /** O primeiro grupo de cada ocorrência do padrão, sem repetir. */
    capture(pattern: RegExp): string[] {
        const global = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`)

        return [...new Set([...this.value.matchAll(global)].map((match) => match[1]!))]
    }

    /** Os nomes de variável que o arquivo lê. */
    envKeys(): string[] {
        return this.capture(/process\.env\.([A-Z][A-Z0-9_]*)/g)
    }

    /** De onde o arquivo importa. */
    imports(): string[] {
        return this.capture(/^\s*import\s.+?\sfrom\s+['"]([^'"]+)['"]/gm)
    }

    toString(): string {
        return this.value
    }
}
