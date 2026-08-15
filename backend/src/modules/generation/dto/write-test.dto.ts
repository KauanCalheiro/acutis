import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import type { RecordedEvent } from '../../recording/events.js'
import { PATH_LIMIT, TITLE_LIMIT } from '../../scenario/providers/test-artifact.js'

export class WriteTestDto {
    /** O título vira nome de arquivo e cabeçalho da feature. */
    @IsString({ message: 'O título do cenário é obrigatório.' })
    @IsNotEmpty({ message: 'O título do cenário é obrigatório.' })
    @MaxLength(TITLE_LIMIT, { message: 'O título do cenário é muito longo.' })
    title!: string

    @IsString({ message: 'O caminho do arquivo é obrigatório.' })
    @IsNotEmpty({ message: 'O caminho do arquivo é obrigatório.' })
    @MaxLength(PATH_LIMIT, { message: 'O caminho do arquivo é muito longo.' })
    path!: string

    @IsString({ message: 'O domínio do cenário é obrigatório.' })
    @IsNotEmpty({ message: 'O domínio do cenário é obrigatório.' })
    @MaxLength(PATH_LIMIT, { message: 'O domínio do cenário é muito longo.' })
    domain!: string

    /** Opcional: sem provedor de IA o rascunho chega sem Gherkin, e aí não há `.feature`. */
    @IsOptional()
    @IsString()
    gherkin?: string | null

    @IsString({ message: 'O teste Playwright é obrigatório.' })
    @IsNotEmpty({ message: 'O teste Playwright é obrigatório.' })
    playwright!: string

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[]

    /** A gravação que originou o cenário, guardada ao lado do spec quando vem junto. */
    @IsOptional()
    @IsArray()
    events?: RecordedEvent[] | null

    /** Os nomes de variável escolhidos para os valores sensíveis, na ordem dos marcadores. */
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    envVars?: string[]
}
