import { IsNotEmpty, IsString } from 'class-validator'
import type { UpdateAuthSetupRequest } from '@acutis/contracts/auth'

export class UpdateAuthSetupDto implements UpdateAuthSetupRequest {
    @IsString({ message: 'O conteúdo do setup de autenticação é obrigatório.' })
    @IsNotEmpty({ message: 'O conteúdo do setup de autenticação é obrigatório.' })
    authSetup!: string
}
