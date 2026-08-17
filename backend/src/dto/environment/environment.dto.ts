import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator'
import { ENV_KEY } from '../../modules/environment/providers/environment-var.js'
import type { EnvironmentRequest, EnvironmentVarRequest } from '@acutis/contracts/environment'

export class EnvironmentVarDto implements EnvironmentVarRequest {
    @Matches(new RegExp(`^${ENV_KEY}$`), { message: 'A chave da variável é inválida.' })
    key!: string

    @IsOptional()
    @IsString({ message: 'O valor da variável deve ser um texto.' })
    value?: string | null

    @IsOptional()
    @IsBoolean({ message: 'O campo secreto deve ser verdadeiro ou falso.' })
    secret?: boolean
}

export class EnvironmentDto implements EnvironmentRequest {
    @IsString({ message: 'O nome do ambiente é obrigatório.' })
    @IsNotEmpty({ message: 'O nome do ambiente é obrigatório.' })
    @MaxLength(60, { message: 'O nome do ambiente é muito longo.' })
    name!: string

    @IsOptional()
    @IsArray({ message: 'As variáveis devem vir em uma lista.' })
    @ValidateNested({ each: true })
    @Type(() => EnvironmentVarDto)
    vars: EnvironmentVarDto[] = []
}
