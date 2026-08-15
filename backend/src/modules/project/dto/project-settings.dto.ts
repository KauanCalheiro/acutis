import { IsNotEmpty, IsString, IsUrl } from 'class-validator'

export class ProjectSettingsDto {
    @IsUrl(
        { require_tld: false, require_protocol: true },
        { message: 'A URL base deve ser uma URL válida.' }
    )
    @IsNotEmpty({ message: 'A URL base do projeto é obrigatória.' })
    @IsString({ message: 'A URL base do projeto é obrigatória.' })
    baseUrl!: string
}
