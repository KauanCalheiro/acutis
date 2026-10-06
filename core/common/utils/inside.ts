/** Se `path` fica dentro de `root`, sem ser a própria raiz, com o separador do sistema. */
import nodePath from 'node:path'

export function isInside(root: string, path: string, paths: typeof nodePath = nodePath): boolean {
  const relative = paths.relative(root, path)

  return relative !== ''
    && relative !== '..'
    && !relative.startsWith(`..${paths.sep}`)
    && !paths.isAbsolute(relative)
}
