import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { NotFound } from '../../../common/exceptions/errors.js'
import { REPORT_DIR } from '../../../common/playwright/report.js'

const INDEX = 'index.html'

export class ProjectReport {
  constructor(private readonly projectPath: string) {}

  exists(): boolean {
    return existsSync(resolve(this.projectPath, REPORT_DIR, INDEX))
  }

  file(requested: string = ''): string {
    const root = resolve(this.projectPath, REPORT_DIR)
    const file = resolve(root, requested === '' ? INDEX : requested)

    if (!file.startsWith(`${root}/`) && file !== root) throw new NotFound('Relatório não encontrado.')
    if (!existsSync(file) || statSync(file).isDirectory()) throw new NotFound('Relatório não encontrado.')

    return file
  }
}
