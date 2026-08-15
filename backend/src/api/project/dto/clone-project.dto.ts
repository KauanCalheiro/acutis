/**
 * Portado de `App\Data\V1\Project\CloneProjectData`.
 *
 * O nome é opcional: sem ele, sai do último segmento da URL do repositório. A colisão de projeto é
 * validada sobre o nome **derivado**, e não sobre o que veio no corpo — por isso a regra mora aqui,
 * onde o `url` e o `name` são vistos juntos.
 */
import {
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateIf,
    registerDecorator,
    type ValidationArguments,
    type ValidationOptions
} from 'class-validator'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { acutis } from '../../kernel/acutis.js'
import { slug as toSlug } from '../../kernel/slug.js'

export const CLONE_AUTH = ['public', 'token', 'ssh_key'] as const

/** O slug que o clone vai usar: o nome informado, ou o do repositório quando ele não veio. */
export function clonedSlug(url: string, name?: string | null): string {
    return toSlug(name || basename(url).replace(/\.git$/, ''))
}

function IsAvailableCloneTarget(options?: ValidationOptions) {
    return (object: object, propertyName: string): void => {
        registerDecorator({
            name: 'isAvailableCloneTarget',
            target: object.constructor,
            propertyName,
            options,
            validator: {
                validate: (value: unknown, args: ValidationArguments) => {
                    if (typeof value !== 'string') return false

                    const slug = clonedSlug(value, (args.object as CloneProjectDto).name)

                    if (slug === '') return false

                    return !existsSync(join(acutis().root, slug))
                },
                defaultMessage: (args: ValidationArguments) => {
                    const slug = clonedSlug(String(args.value), (args.object as CloneProjectDto).name)

                    return slug === ''
                        ? 'Não foi possível derivar um nome válido do repositório.'
                        : 'Já existe um projeto com este nome.'
                }
            }
        })
    }
}

export class CloneProjectDto {
    @IsString({ message: 'A URL do repositório é obrigatória.' })
    @IsNotEmpty({ message: 'A URL do repositório é obrigatória.' })
    @IsAvailableCloneTarget()
    url!: string

    @IsOptional()
    @IsString()
    name?: string

    @IsOptional()
    @IsString()
    branch?: string

    @IsOptional()
    @IsIn(CLONE_AUTH, { message: 'Método de autenticação inválido (use public, token ou ssh_key).' })
    auth?: (typeof CLONE_AUTH)[number]

    @ValidateIf((dto: CloneProjectDto) => dto.auth === 'token')
    @IsString({ message: 'O token é obrigatório para autenticação por token.' })
    @IsNotEmpty({ message: 'O token é obrigatório para autenticação por token.' })
    token?: string

    @ValidateIf((dto: CloneProjectDto) => dto.auth === 'ssh_key')
    @IsString({ message: 'A chave SSH é obrigatória para autenticação por chave.' })
    @IsNotEmpty({ message: 'A chave SSH é obrigatória para autenticação por chave.' })
    ssh_key?: string
}
