import { IsNotEmpty, IsString, IsUrl } from 'class-validator'
import type { ProjectSettingsRequest } from '@acutis/contracts/project'

export class ProjectSettingsDto implements ProjectSettingsRequest {
    @IsUrl(
        { require_tld: false, require_protocol: true },
        { message: 'A URL base deve ser uma URL válida.' }
    )
    @IsNotEmpty({ message: 'A URL base do projeto é obrigatória.' })
    @IsString({ message: 'A URL base do projeto é obrigatória.' })
    baseUrl!: string
}
