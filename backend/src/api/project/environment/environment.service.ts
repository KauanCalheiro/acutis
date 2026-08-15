/**
 * As operações de ambiente. É para cá que vieram as Actions do Laravel — `ListProjectEnvironments`,
 * `CreateProjectEnvironment`, `UpdateProjectEnvironment`, `ActivateProjectEnvironment` e
 * `DeleteProjectEnvironment` — agrupadas por domínio em vez de uma classe por operação.
 */
import { Injectable } from '@nestjs/common'
import { NotFound, ValidationFailed } from '../../kernel/errors.js'
import { slug as toSlug } from '../../kernel/slug.js'
import { Dotenv } from '../dotenv.js'
import { ProjectService } from '../project.service.js'
import { environmentVar } from './environment-var.js'
import type { EnvironmentDto, EnvironmentVarDto } from './dto/environment.dto.js'
import { Environments, type Environment } from './environments.js'

export interface EnvironmentList {
    active: string | null
    environments: Environment[]
    known_keys: string[]
}

@Injectable()
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
        const declared = environments.all().flatMap((environment) => environment.vars.map((variable) => variable.key))

        return {
            active: environments.activeSlug(),
            environments: environments.displayedAll(),
            // O `.env.example` entra junto porque é onde o projeto anuncia as chaves que espera,
            // mesmo as que nenhum ambiente declarou ainda.
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
     * Gravar um ambiente altera todos: os nomes das variáveis são os mesmos em todo lugar, e só os
     * valores mudam de um para o outro.
     */
    update(slug: string, environmentSlug: string, data: EnvironmentDto): Environment {
        const environments = this.projects.environmentsOf(slug)

        this.found(environments, environmentSlug)

        const vars = (data.vars ?? []).map(
            (variable: EnvironmentVarDto) => environmentVar(variable.key, variable.value ?? '', variable.secret ?? false)
        )

        const duplicated = vars.findIndex(
            (variable, index) => vars.findIndex((other) => other.key === variable.key) !== index
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
