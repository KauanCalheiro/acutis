/** Portado de `App\Data\V1\Project\ProjectSettingsData`. */
import { IsNotEmpty, IsString, IsUrl } from 'class-validator'

export class ProjectSettingsDto {
    @IsString({ message: 'A URL base do projeto é obrigatória.' })
    @IsNotEmpty({ message: 'A URL base do projeto é obrigatória.' })
    /**
     * Exige o esquema, como a regra `url` do Laravel: sem ele, `nao-e-url` passaria por nome de
     * host. E dispensa TLD, porque ambiente interno costuma ser `app.local` ou `sistema.test`.
     */
    @IsUrl(
        { require_tld: false, require_protocol: true },
        { message: 'A URL base deve ser uma URL válida.' }
    )
    baseUrl!: string
}
