import { pnpm } from '../project.mjs'

export const name = 'typecheck'

/** Saída do `pnpm typecheck` quando ele reprova; null quando passa. */
export function check() {
    return pnpm('typecheck')
}
