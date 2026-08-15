/**
 * Portado de `App\Data\V1\Project\UpdateProjectData`.
 *
 * Diferente do DTO de criação, aqui não se valida colisão de nome: renomear para o próprio nome é
 * legítimo, e quem sabe comparar o slug novo com o atual é o service, que conhece o slug de origem.
 */
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class UpdateProjectDto {
    @IsString({ message: 'O nome do projeto é obrigatório.' })
    @IsNotEmpty({ message: 'O nome do projeto é obrigatório.' })
    @MaxLength(255, { message: 'O nome do projeto é muito longo.' })
    name!: string
}
