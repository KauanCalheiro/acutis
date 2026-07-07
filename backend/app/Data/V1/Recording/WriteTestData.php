<?php

namespace App\Data\V1\Recording;

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
    ) {}

    public static function rules(): array
    {
        return [
            'title' => ['required', 'string'],
            'path' => ['required', 'string'],
            'domain' => ['required', 'string'],
            'gherkin' => ['required', 'string'],
            'playwright' => ['required', 'string'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string'],
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
