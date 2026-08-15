<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class ProjectSettingsData extends Data
{
    public function __construct(
        public string $baseUrl,
    ) {}

    public static function rules(): array
    {
        return [
            'baseUrl' => ['required', 'string', 'url'],
        ];
    }

    public static function messages(): array
    {
        return [
            'baseUrl.required' => 'A URL base do projeto é obrigatória.',
            'baseUrl.url' => 'A URL base deve ser uma URL válida.',
        ];
    }
}
