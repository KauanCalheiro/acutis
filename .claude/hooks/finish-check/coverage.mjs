import { pnpm } from '../project.mjs'

export const name = 'suíte com cobertura'

/** Saída do `pnpm test:coverage` quando ele reprova; null quando passa. */
export function check() {
    // ponytail: a suíte tem estado compartilhado entre arquivos e falha fora de ordem, então só
    // reprova o que falha duas vezes; o conserto de verdade é isolar as fixtures.
    return pnpm('test:coverage') && pnpm('test:coverage')
}
