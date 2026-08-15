/**
 * Portado de `App\Data\V1\Auth\AuthCredentialsData`.
 *
 * A senha chega em claro e é gravada no ambiente como secreta: ela precisa existir para o login
 * rodar, mas nunca sai daqui para tela nem para arquivo versionado.
 */
import { IsNotEmpty, IsString } from 'class-validator'

export class AuthCredentialsDto {
    @IsString({ message: 'O usuário é obrigatório.' })
    @IsNotEmpty({ message: 'O usuário é obrigatório.' })
    username!: string

    @IsString({ message: 'A senha é obrigatória.' })
    @IsNotEmpty({ message: 'A senha é obrigatória.' })
    password!: string
}
