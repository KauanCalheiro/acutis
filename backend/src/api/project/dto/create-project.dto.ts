/**
 * Portado de `App\Data\V1\Project\CreateProjectData`.
 *
 * As duas regras de negócio do nome — virar um slug não vazio e não colidir com projeto existente —
 * moram aqui, e não no service, porque são validação de entrada: o usuário precisa recebê-las como
 * erro de campo, no formulário, e não como exceção.
 */
import { registerDecorator, IsNotEmpty, IsString, MaxLength, type ValidationOptions } from 'class-validator'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { acutis } from '../../kernel/acutis.js'
import { slug as toSlug } from '../../kernel/slug.js'

/** Nome só de pontuação vira slug vazio, e projeto sem diretório não existe. */
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

export class CreateProjectDto {
    @IsString({ message: 'O nome do projeto é obrigatório.' })
    @IsNotEmpty({ message: 'O nome do projeto é obrigatório.' })
    @MaxLength(255, { message: 'O nome do projeto é muito longo.' })
    @IsSluggable()
    @IsAvailableProjectName()
    name!: string
}
