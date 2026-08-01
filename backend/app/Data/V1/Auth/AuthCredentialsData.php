<?php

namespace App\Data\V1\Auth;

use Spatie\LaravelData\Data;

class AuthCredentialsData extends Data
{
    public function __construct(
        public string $username,
        public string $password,
    ) {}

    public static function rules(): array
    {
        return [
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ];
    }

    public static function messages(): array
    {
        return [
            'username.required' => 'O usuário é obrigatório.',
            'password.required' => 'A senha é obrigatória.',
        ];
    }
}
