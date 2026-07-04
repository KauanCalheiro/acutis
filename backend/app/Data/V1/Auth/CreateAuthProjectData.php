<?php

namespace App\Data\V1\Auth;

use Closure;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Spatie\LaravelData\Data;

class CreateAuthProjectData extends Data
{
    public function __construct(
        public string $name,
        public string $loginUrl,
        public string $username,
        public string $password,
        public ?string $executionUrl = null,
    ) {}

    public static function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:255',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $slug = Str::slug((string) $value);

                    if ($slug === '') {
                        $fail('O nome deve conter ao menos um caractere alfanumérico.');

                        return;
                    }

                    if (File::exists(acutis()->projectsPath.'/'.$slug)) {
                        $fail('Já existe um projeto com este nome.');
                    }
                },
            ],
            'loginUrl' => ['required', 'string', 'url'],
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'executionUrl' => ['nullable', 'string', 'url'],
        ];
    }

    public static function messages(): array
    {
        return [
            'name.required' => 'O nome é obrigatório.',
            'name.max' => 'O nome não pode ter mais de 255 caracteres.',
            'loginUrl.required' => 'A URL de login é obrigatória.',
            'loginUrl.url' => 'A URL de login deve ser uma URL válida.',
            'username.required' => 'O usuário é obrigatório.',
            'password.required' => 'A senha é obrigatória.',
            'executionUrl.url' => 'A URL de execução deve ser uma URL válida.',
        ];
    }
}
