import { pnpm } from '../project.mjs'

export const name = 'código duplicado'

/** Saída do `pnpm dup` quando ele acha duplicação; null quando passa. */
export function check() {
    return pnpm('dup')
}
