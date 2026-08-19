/**
 * Os ambientes de um projeto: cada um é um arquivo JSON em `environments/`, e qual deles está ativo
 * é estado local, guardado no `.env` do projeto.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { authExists } from '../../auth/providers/auth.js'
import { ensureGitignore } from '../../project/providers/gitignore.js'
import { Dotenv } from '../../project/providers/dotenv.js'
import { EnvKey } from './env-key.js'
import { environmentVar, keyed, type EnvironmentVar } from './environment-var.js'

const DIRECTORY = 'environments'
const DEFAULT_SLUG = 'ambiente'
const DEFAULT_NAME = 'Ambiente'

export interface Environment {
  slug: string
  name: string
  vars: EnvironmentVar[]
}

export class Environments {
  constructor(private readonly path: string) {}

  private env(): Dotenv {
    return new Dotenv(this.path)
  }

  private directory(): string {
    return join(this.path, DIRECTORY)
  }

  private fileOf(slug: string): string {
    return join(this.directory(), `${slug}.json`)
  }

  private read(file: string): Environment | null {
    if (!existsSync(file)) return null

    let content: unknown

    try {
      content = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      return null
    }

    if (typeof content !== 'object' || content === null) return null

    const data = content as { name?: string, vars?: { key: string, value?: string, secret?: boolean }[] }
    const slug = basename(file).replace(/\.json$/, '')

    return {
      slug,
      name: data.name ?? slug,
      vars: (data.vars ?? []).map(variable => environmentVar(
        variable.key,
        String(variable.value ?? ''),
        Boolean(variable.secret)
      ))
    }
  }

  all(): Environment[] {
    if (!existsSync(this.directory())) return []

    return readdirSync(this.directory())
      .filter(file => file.endsWith('.json'))
      .sort()
      .map(file => this.read(join(this.directory(), file)))
      .filter((environment): environment is Environment => environment !== null)
  }

  find(slug: string): Environment | null {
    return this.read(this.fileOf(slug))
  }

  put(slug: string, name: string, vars: EnvironmentVar[]): this {
    mkdirSync(this.directory(), { recursive: true })

    const body = {
      name,
      vars: vars.map(variable => ({
        key: variable.key,
        value: variable.value,
        secret: variable.secret
      }))
    }

    writeFileSync(this.fileOf(slug), `${JSON.stringify(body, null, 4)}\n`)
    ensureGitignore(this.path)

    return this
  }

  forget(slug: string): this {
    rmSync(this.fileOf(slug), { force: true })

    if (this.env().get(EnvKey.ACTIVE_ENVIRONMENT) === slug) {
      this.env().set(EnvKey.ACTIVE_ENVIRONMENT, '')
    }

    return this
  }

  activate(slug: string): this {
    this.env().set(EnvKey.ACTIVE_ENVIRONMENT, slug)

    return this
  }

  activeSlug(): string | null {
    const chosen = this.env().get(EnvKey.ACTIVE_ENVIRONMENT)

    if (chosen && existsSync(this.fileOf(chosen))) return chosen

    return this.all()[0]?.slug ?? null
  }

  private active(): Environment | null {
    const slug = this.activeSlug()

    return slug ? this.find(slug) : null
  }

  /** O que a tela mostra: o segredo sem valor vira "pendente", para o usuário saber que falta. */
  displayed(slug: string): Environment | null {
    const environment = this.find(slug)

    if (environment === null) return null

    return {
      ...environment,
      vars: environment.vars.map(variable => ({ ...variable, pending: !variable.value }))
    }
  }

  displayedAll(): Environment[] {
    return this.all()
      .map(environment => this.displayed(environment.slug))
      .filter((environment): environment is Environment => environment !== null)
  }

  /** Faz todos os ambientes declararem as mesmas chaves do ambiente de referência. */
  alignTo(slug: string): this {
    const reference = this.find(slug)

    if (reference === null) return this

    for (const environment of this.all()) {
      if (environment.slug === slug) continue

      const vars = reference.vars.map(variable => environmentVar(
        variable.key,
        keyed(environment.vars, variable.key)?.value ?? '',
        variable.secret
      ))

      this.put(environment.slug, environment.name, vars)
    }

    return this
  }

  /** As chaves que todo ambiente precisa ter, que dependem de o projeto ter login ou não. */
  private requiredKeys(): { key: string, secret: boolean }[] {
    return authExists(this.path)
      ? [
          { key: EnvKey.URL, secret: false },
          { key: EnvKey.USER, secret: false },
          { key: EnvKey.PASSWORD, secret: true }
        ]
      : [{ key: EnvKey.URL, secret: false }]
  }

  /** O primeiro ambiente nasce com o que o `.env` do projeto já tiver. */
  private seededFromDotenv(): EnvironmentVar[] {
    const dotenv = this.env().all()

    return [EnvKey.URL, EnvKey.USER, EnvKey.PASSWORD]
      .filter(key => Boolean(dotenv[key]))
      .map(key => environmentVar(key, dotenv[key]!, key === EnvKey.PASSWORD))
  }

  ensure(): this {
    if (this.all().length === 0) {
      this.put(DEFAULT_SLUG, DEFAULT_NAME, this.seededFromDotenv()).activate(DEFAULT_SLUG)
    }

    for (const environment of this.all()) {
      const vars = [...environment.vars]
      const before = vars.length

      for (const { key, secret } of this.requiredKeys()) {
        if (keyed(vars, key) === null) vars.push(environmentVar(key, '', secret))
      }

      if (vars.length !== before) this.put(environment.slug, environment.name, vars)
    }

    return this
  }

  activeVars(): EnvironmentVar[] {
    return this.active()?.vars ?? []
  }

  /** As chaves que os ambientes declaram, sem valor: é o formulário que a tela monta. */
  declaredKeys(): EnvironmentVar[] {
    const environment = this.all()[0]

    if (!environment) return []

    return environment.vars.map(variable => environmentVar(variable.key, '', variable.secret))
  }

  value(key: string, fallback: string | null = null): string | null {
    const variable = keyed(this.activeVars(), key)

    if (variable === null || !variable.value) return this.env().get(key, fallback)

    return variable.value
  }

  set(key: string, value: string, secret = false): this {
    const environment = this.active()

    if (environment === null) {
      this.env().set(key, value)

      return this
    }

    const vars = [...environment.vars]
    const index = vars.findIndex(variable => variable.key === key)
    const updated = environmentVar(key, value, secret)

    if (index === -1) {
      vars.push(updated)
    } else {
      vars[index] = updated
    }

    return this.put(environment.slug, environment.name, vars)
  }

  merge(values: Record<string, string>): this {
    const environment = this.active()

    if (environment === null) {
      this.env().merge(values)

      return this
    }

    const vars = [...environment.vars]

    for (const [key, value] of Object.entries(values)) {
      const index = vars.findIndex(variable => variable.key === key)
      const secret = index === -1 ? false : vars[index]!.secret

      const updated = environmentVar(key, value, secret)

      if (index === -1) {
        vars.push(updated)
      } else {
        vars[index] = updated
      }
    }

    return this.put(environment.slug, environment.name, vars)
  }

  /** Tudo que a execução precisa no ambiente do processo: o `.env` com o ambiente ativo por cima. */
  resolve(): Record<string, string> {
    const environment = this.active()

    if (environment === null) return {}

    const values = this.env().all()

    for (const variable of environment.vars) {
      values[variable.key] = variable.value ?? ''
    }

    Reflect.deleteProperty(values, EnvKey.ACTIVE_ENVIRONMENT)
    values[EnvKey.STORAGE_STATE] = this.storageState()

    return values
  }

  /** Um arquivo de sessão por ambiente: trocar de ambiente não reusa a sessão do anterior. */
  storageState(): string {
    const slug = this.activeSlug()

    return slug ? `storage-state.${slug}.json` : 'storage-state.json'
  }
}
