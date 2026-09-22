import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** URL do bundle do Nitro dentro da raiz do pacote, no formato que o loader ESM aceita. */
export function serverEntryUrl(packageRoot) {
  return pathToFileURL(join(packageRoot, '.output/server/index.mjs')).href
}
