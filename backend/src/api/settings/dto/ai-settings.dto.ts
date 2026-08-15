/**
 * O formulário da tela de configurações de IA.
 *
 * A obrigatoriedade da chave não está aqui: ela depende do que já foi gravado para o provedor, e
 * quem sabe disso é o service. Ver `SettingsService.ensureHasKey`.
 */
import { Transform } from 'class-transformer'
import { IsIn, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator'
import { PROVIDER_NAMES } from '../ai-providers.js'

/** O campo vazio da tela chega como `''` ou como `null`; ambos querem dizer "sem IA". */
const AI_OFF = ''

export class AiSettingsDto {
    @Transform(({ value }) => value ?? AI_OFF)
    @IsIn([AI_OFF, ...PROVIDER_NAMES], { message: 'Provedor não suportado.' })
    provider!: string

    @IsOptional()
    @IsString()
    key?: string | null

    // Branco não é URL inválida, é campo não preenchido — e aí vale o padrão do provedor.
    @ValidateIf((dto: AiSettingsDto) => dto.url !== null && dto.url !== undefined && dto.url !== '')
    @IsUrl({ require_tld: false }, { message: 'A URL do provedor deve ser uma URL válida.' })
    url?: string | null

    @IsOptional()
    @IsString()
    modelCheapest?: string | null

    @IsOptional()
    @IsString()
    modelSmartest?: string | null
}
