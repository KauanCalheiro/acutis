/** A edição de um cenário pela interface; título e caminho viram nome de arquivo. */
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { PATH_LIMIT, TITLE_LIMIT } from '../../modules/scenario/providers/test-artifact.js'
import type { UpdateScenarioRequest } from '@acutis/contracts/scenario'

export class UpdateScenarioDto implements UpdateScenarioRequest {
    @IsString()
    @IsNotEmpty({ message: 'O título do cenário é obrigatório.' })
    @MaxLength(TITLE_LIMIT)
    title!: string

    @IsString()
    @IsNotEmpty({ message: 'O caminho do arquivo é obrigatório.' })
    @MaxLength(PATH_LIMIT)
    path!: string

    @IsOptional()
    @IsString()
    @MaxLength(PATH_LIMIT)
    domain?: string | null

    @IsOptional()
    @IsString()
    gherkin?: string | null

    @IsString()
    @IsNotEmpty({ message: 'O teste Playwright é obrigatório.' })
    playwright!: string

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[]
}
