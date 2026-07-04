<?php

namespace App\Data\V1\Auth;

use Spatie\LaravelData\Data;

class AuthSetupData extends Data
{
    public function __construct(
        public string $loginUrl,
        public string $username,
        public string $password,
        public ?string $executionUrl = null,
    ) {}

    public static function rules(): array
    {
        return [
            'loginUrl' => ['required', 'string', 'url'],
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'executionUrl' => ['nullable', 'string', 'url'],
        ];
    }

    public static function messages(): array
    {
        return [
            'loginUrl.required' => 'A URL de login é obrigatória.',
            'loginUrl.url' => 'A URL de login deve ser uma URL válida.',
            'username.required' => 'O usuário é obrigatório.',
            'password.required' => 'A senha é obrigatória.',
            'executionUrl.url' => 'A URL de execução deve ser uma URL válida.',
        ];
    }
}
