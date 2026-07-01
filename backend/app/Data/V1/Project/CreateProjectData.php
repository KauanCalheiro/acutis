<?php

namespace App\Data\V1\Project;

use Closure;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Spatie\LaravelData\Data;

class CreateProjectData extends Data
{
    public function __construct(
        public string $name,
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
        ];
    }

    public static function messages(): array
    {
        return [
            'name.required' => 'O nome é obrigatório.',
            'name.string' => 'O nome deve ser um texto.',
            'name.max' => 'O nome não pode ter mais de 255 caracteres.',
        ];
    }
}
