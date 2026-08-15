/**
 * A edição de um cenário pela interface.
 *
 * Os limites de título e caminho não são estéticos: os dois viram nome de arquivo, e o que passa
 * disso não cabe no sistema de arquivos de todo mundo.
 */
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { PATH_LIMIT, TITLE_LIMIT } from '../test-artifact.js'

export class UpdateScenarioDto {
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
