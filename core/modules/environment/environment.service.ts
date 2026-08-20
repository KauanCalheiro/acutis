/** As operações de ambiente: listar, criar, editar, ativar e remover. */
import { NotFound, ValidationFailed } from '../../common/exceptions/errors.js'
import { slug as toSlug } from '../../common/utils/slug.js'
import { Dotenv } from '../project/providers/dotenv.js'
import type { ProjectService } from '../project/project.service.js'
import { environmentVar } from './providers/environment-var.js'
import { Environments, type Environment } from './providers/environments.js'
import type { EnvironmentList, EnvironmentRequest, EnvironmentVarRequest } from '#shared/contracts/environment'

export type { Environment } from './providers/environments.js'
export type { EnvironmentList } from '#shared/contracts/environment'

export class EnvironmentService {
  constructor(private readonly projects: ProjectService) {}

  /** O ambiente pedido, ou 404 — quem chama sempre precisa de um que exista. */
  private found(environments: Environments, slug: string): Environment {
    const environment = environments.find(slug)

    if (environment === null) throw new NotFound('Ambiente não encontrado.')

    return environment
  }

  list(slug: string): EnvironmentList {
    const path = this.projects.pathOf(slug)
    const environments = new Environments(path).ensure()
    const declared = environments.all().flatMap(environment => environment.vars.map(variable => variable.key))

    return {
      active: environments.activeSlug(),
      environments: environments.displayedAll(),
      // O `.env.example` entra junto: é onde o projeto anuncia as chaves que espera.
      known_keys: [...new Set([...new Dotenv(path).exampleKeys(), ...declared])]
    }
  }

  create(slug: string, name: string): Environment {
    const environments = this.projects.environmentsOf(slug).ensure()
    const environmentSlug = toSlug(name)

    if (environments.find(environmentSlug) !== null) {
      throw new ValidationFailed({ name: ['Já existe um ambiente com esse nome.'] })
    }

    environments.put(environmentSlug, name, environments.declaredKeys())

    return this.displayed(environments, environmentSlug)
  }

  /**
     * Gravar um ambiente altera todos: os nomes das variáveis são os mesmos em todos eles.
     */
  update(slug: string, environmentSlug: string, data: EnvironmentRequest): Environment {
    const environments = this.projects.environmentsOf(slug)

    this.found(environments, environmentSlug)

    const vars = (data.vars ?? []).map(
      (variable: EnvironmentVarRequest) => environmentVar(variable.key, variable.value ?? '', variable.secret ?? false)
    )

    const duplicated = vars.findIndex(
      (variable, index) => vars.findIndex(other => other.key === variable.key) !== index
    )

    if (duplicated !== -1) {
      throw new ValidationFailed({
        [`vars.${duplicated}.key`]: ['Esta chave já foi informada neste ambiente.']
      })
    }

    environments.put(environmentSlug, data.name, vars).ensure().alignTo(environmentSlug)

    return this.displayed(environments, environmentSlug)
  }

  activate(slug: string, environmentSlug: string): Environment {
    const environments = this.projects.environmentsOf(slug)

    this.found(environments, environmentSlug)
    environments.activate(environmentSlug)

    return this.displayed(environments, environmentSlug)
  }

  remove(slug: string, environmentSlug: string): void {
    const environments = this.projects.environmentsOf(slug)

    this.found(environments, environmentSlug)
    environments.forget(environmentSlug)
  }

  private displayed(environments: Environments, environmentSlug: string): Environment {
    const environment = environments.displayed(environmentSlug)

    if (environment === null) throw new NotFound('Ambiente não encontrado.')

    return environment
  }
}
