/** As credenciais do login; a senha chega em claro e é gravada no ambiente como secreta. */
import { IsNotEmpty, IsString } from 'class-validator'

export class AuthCredentialsDto {
    @IsString({ message: 'O usuário é obrigatório.' })
    @IsNotEmpty({ message: 'O usuário é obrigatório.' })
    username!: string

    @IsString({ message: 'A senha é obrigatória.' })
    @IsNotEmpty({ message: 'A senha é obrigatória.' })
    password!: string
}
