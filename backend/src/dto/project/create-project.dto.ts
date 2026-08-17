/** O formulário de criação de projeto: o nome vira slug e não pode colidir com um já existente. */
import { registerDecorator, IsNotEmpty, IsString, MaxLength, type ValidationOptions } from 'class-validator'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { acutis } from '../../common/utils/acutis.js'
import { slug as toSlug } from '../../common/utils/slug.js'
import type { CreateProjectRequest } from '@acutis/contracts/project'

/** Cobra que o nome tenha ao menos um caractere alfanumérico. */
function IsSluggable(options?: ValidationOptions) {
    return (object: object, propertyName: string): void => {
        registerDecorator({
            name: 'isSluggable',
            target: object.constructor,
            propertyName,
            options: { message: 'O nome deve conter ao menos um caractere alfanumérico.', ...options },
            validator: {
                validate: (value: unknown) => typeof value === 'string' && toSlug(value) !== ''
            }
        })
    }
}

/** Cobra que nenhum projeto ocupe ainda o slug do nome. */
function IsAvailableProjectName(options?: ValidationOptions) {
    return (object: object, propertyName: string): void => {
        registerDecorator({
            name: 'isAvailableProjectName',
            target: object.constructor,
            propertyName,
            options: { message: 'Já existe um projeto com este nome.', ...options },
            validator: {
                validate: (value: unknown) => {
                    if (typeof value !== 'string') return false

                    const slug = toSlug(value)

                    return slug === '' || !existsSync(join(acutis().root, slug))
                }
            }
        })
    }
}

// O class-validator avalia os decorators de baixo para cima: as regras básicas ficam embaixo.
export class CreateProjectDto implements CreateProjectRequest {
    @IsAvailableProjectName()
    @IsSluggable()
    @MaxLength(255, { message: 'O nome do projeto é muito longo.' })
    @IsNotEmpty({ message: 'O nome do projeto é obrigatório.' })
    @IsString({ message: 'O nome do projeto é obrigatório.' })
    name!: string
}
