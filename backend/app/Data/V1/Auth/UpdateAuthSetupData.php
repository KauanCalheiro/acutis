<?php

namespace App\Data\V1\Auth;

use Spatie\LaravelData\Data;

class UpdateAuthSetupData extends Data
{
    public function __construct(
        public string $authSetup,
    ) {}

    public static function rules(): array
    {
        return [
            'authSetup' => ['required', 'string'],
        ];
    }

    public static function messages(): array
    {
        return [
            'authSetup.required' => 'O conteúdo do setup de autenticação é obrigatório.',
        ];
    }
}
