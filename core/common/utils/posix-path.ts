/** O caminho com barra normal no lugar do separador do sistema. */
import nodePath from 'node:path'

export function toPosixPath(path: string, paths: typeof nodePath = nodePath): string {
  return path.split(paths.sep).join('/')
}
