<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class ProbeGitData extends Data
{
    public function __construct(
        public string $url,
    ) {}

    public static function rules(): array
    {
        return [
            'url' => ['required', 'string'],
        ];
    }

    public static function messages(): array
    {
        return [
            'url.required' => 'A URL do repositório é obrigatória.',
            'url.string' => 'A URL deve ser um texto.',
        ];
    }
}
