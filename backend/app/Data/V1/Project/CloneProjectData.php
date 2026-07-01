<?php

namespace App\Data\V1\Project;

use Closure;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Spatie\LaravelData\Data;
use Spatie\LaravelData\Support\Validation\ValidationContext;

class CloneProjectData extends Data
{
    public function __construct(
        public string $url,
        public ?string $name = null,
        public ?string $branch = null,
        public string $auth = 'public',
        public ?string $token = null,
        public ?string $ssh_key = null,
    ) {}

    public static function rules(ValidationContext $context): array
    {
        return [
            'url' => [
                'required', 'string',
                function (string $attribute, mixed $value, Closure $fail) use ($context): void {
                    $name = $context->fullPayload['name'] ?? null;
                    $slug = Str::slug($name ?: preg_replace('/\.git$/', '', basename((string) $value)));

                    if ($slug === '') {
                        $fail('Não foi possível derivar um nome válido do repositório.');

                        return;
                    }

                    if (File::exists(acutis()->projectsPath.'/'.$slug)) {
                        $fail('Já existe um projeto com este nome.');
                    }
                },
            ],
            'name' => ['nullable', 'string', 'max:255'],
            'branch' => ['nullable', 'string', 'max:255'],
            'auth' => ['nullable', 'string', 'in:public,token,ssh_key'],
            'token' => ['nullable', 'string', 'required_if:auth,token'],
            'ssh_key' => ['nullable', 'string', 'required_if:auth,ssh_key'],
        ];
    }

    public static function messages(): array
    {
        return [
            'url.required' => 'A URL do repositório é obrigatória.',
            'auth.in' => 'Método de autenticação inválido (use public, token ou ssh_key).',
            'token.required_if' => 'O token é obrigatório para autenticação por token.',
            'ssh_key.required_if' => 'A chave SSH é obrigatória para autenticação por chave.',
        ];
    }
}
