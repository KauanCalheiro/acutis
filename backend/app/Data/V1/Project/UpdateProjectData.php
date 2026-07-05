<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class UpdateProjectData extends Data
{
    public function __construct(
        public string $name,
    ) {}

    public static function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
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
