/** Portado de `App\Data\V1\Auth\UpdateAuthSetupData`. */
import { IsNotEmpty, IsString } from 'class-validator'

export class UpdateAuthSetupDto {
    @IsString({ message: 'O conteúdo do setup de autenticação é obrigatório.' })
    @IsNotEmpty({ message: 'O conteúdo do setup de autenticação é obrigatório.' })
    authSetup!: string
}
