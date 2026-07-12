<?php

namespace App\Data\V1\Auth;

use Spatie\LaravelData\Data;

class AuthRecordingData extends Data
{
    public function __construct(
        public string $baseUrl,
        public array $events,
        public ?string $executionUrl = null,
    ) {}

    public static function rules(): array
    {
        return [
            'baseUrl' => ['required', 'string', 'url'],
            'events' => ['required', 'array', 'min:1'],
            'events.*.type' => ['required', 'string'],
            'events.*.url' => ['required', 'string'],
            'executionUrl' => ['nullable', 'string', 'url'],
        ];
    }

    public static function messages(): array
    {
        return [
            'baseUrl.required' => 'A URL base da gravação é obrigatória.',
            'baseUrl.url' => 'A URL base deve ser uma URL válida.',
            'events.required' => 'A gravação precisa conter ao menos um evento.',
            'events.min' => 'A gravação precisa conter ao menos um evento.',
            'events.*.type.required' => 'Todo evento precisa de um tipo.',
            'events.*.url.required' => 'Todo evento precisa da URL em que ocorreu.',
            'executionUrl.url' => 'A URL de execução deve ser uma URL válida.',
        ];
    }
}
