/** A renomeação de um projeto; a colisão de nome é conferida no service, que conhece o slug atual. */
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import type { UpdateProjectRequest } from '@acutis/contracts/project'

export class UpdateProjectDto implements UpdateProjectRequest {
    @IsString({ message: 'O nome do projeto é obrigatório.' })
    @IsNotEmpty({ message: 'O nome do projeto é obrigatório.' })
    @MaxLength(255, { message: 'O nome do projeto é muito longo.' })
    name!: string
}
