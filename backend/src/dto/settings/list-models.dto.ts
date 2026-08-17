/**
 * O que a tela manda para perguntar ao provedor quais modelos ele tem. Campo em branco cai no que
 * já está cadastrado, e depois no padrão do provedor.
 */
import { Transform } from 'class-transformer'
import { IsIn, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator'
import { PROVIDER_NAMES } from '../../modules/settings/providers/ai-providers.js'
import type { ListModelsRequest } from '@acutis/contracts/settings'

export class ListModelsDto implements ListModelsRequest {
    @Transform(({ value }) => value ?? '')
    @IsIn(PROVIDER_NAMES, { message: 'Provedor não suportado.' })
    provider!: string

    @IsOptional()
    @IsString()
    key?: string | null

    @ValidateIf((dto: ListModelsDto) => dto.url !== null && dto.url !== undefined && dto.url !== '')
    @IsUrl({ require_tld: false }, { message: 'A URL do provedor deve ser uma URL válida.' })
    url?: string | null
}
