/**
 * O formulário da tela de configurações de IA. A obrigatoriedade da chave é cobrada no
 * `SettingsService.ensureHasKey`, que enxerga o que já está gravado.
 */
import { Transform } from 'class-transformer'
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator'
import { PROVIDER_NAMES } from '../providers/ai-providers.js'

/** O campo vazio da tela chega como `''` ou como `null`; ambos querem dizer "sem IA". */
const AI_OFF = ''

export class AiSettingsDto {
    @Transform(({ value }) => value ?? AI_OFF)
    @IsIn([AI_OFF, ...PROVIDER_NAMES], { message: 'Provedor não suportado.' })
    provider!: string

    @IsOptional()
    @IsString()
    key?: string | null

    // Branco é campo não preenchido, e aí vale o padrão do provedor.
    @ValidateIf((dto: AiSettingsDto) => dto.url !== null && dto.url !== undefined && dto.url !== '')
    @IsUrl({ require_tld: false }, { message: 'A URL do provedor deve ser uma URL válida.' })
    url?: string | null

    /** Obrigatório quando há provedor. */
    @ValidateIf((dto: AiSettingsDto) => dto.provider !== AI_OFF)
    @IsString({ message: 'Escolha um modelo do provedor.' })
    @IsNotEmpty({ message: 'Escolha um modelo do provedor.' })
    model?: string | null
}
