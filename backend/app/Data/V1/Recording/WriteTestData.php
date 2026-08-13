<?php

namespace App\Data\V1\Recording;

use App\Support\TestArtifact;
use Spatie\LaravelData\Data;

class WriteTestData extends Data
{
    /** @param list<string> $tags */
    public function __construct(
        public string $title,
        public string $path,
        public string $domain,
        public string $gherkin,
        public string $playwright,
        public array $tags = [],
        public ?array $events = null,
        public array $envVars = [],
    ) {}

    public static function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:'.TestArtifact::TITLE_LIMIT],
            'path' => ['required', 'string', 'max:'.TestArtifact::PATH_LIMIT],
            'domain' => ['required', 'string', 'max:'.TestArtifact::PATH_LIMIT],
            'gherkin' => ['required', 'string'],
            'playwright' => ['required', 'string'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string'],
            'events' => ['nullable', 'array'],
            'events.*.type' => ['required', 'string'],
            'events.*.sensitive' => ['sometimes', 'boolean'],
            'envVars' => ['nullable', 'array'],
            'envVars.*' => ['string'],
        ];
    }

    public static function messages(): array
    {
        return [
            'title.required' => 'O título do cenário é obrigatório.',
            'path.required' => 'O caminho do arquivo é obrigatório.',
            'domain.required' => 'O domínio do cenário é obrigatório.',
            'gherkin.required' => 'O cenário Gherkin é obrigatório.',
            'playwright.required' => 'O teste Playwright é obrigatório.',
        ];
    }
}
