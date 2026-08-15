/** Portado de `App\Data\V1\Project\EnvironmentData`. */
import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator'
import { ENV_KEY } from '../environment-var.js'

export class EnvironmentVarDto {
    /**
     * A chave vira variável do processo na hora de rodar, então precisa ser um nome que o shell
     * aceite — espaço ou acento aqui quebraria a execução, não este formulário.
     */
    @Matches(new RegExp(`^${ENV_KEY}$`), { message: 'A chave da variável é inválida.' })
    key!: string

    @IsOptional()
    @IsString({ message: 'O valor da variável deve ser um texto.' })
    value?: string | null

    @IsOptional()
    @IsBoolean({ message: 'O campo secreto deve ser verdadeiro ou falso.' })
    secret?: boolean
}

export class EnvironmentDto {
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
