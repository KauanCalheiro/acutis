<?php

namespace App\Data\V1\Project;

use App\Support\TestArtifact;
use Spatie\LaravelData\Data;

class UpdateScenarioData extends Data
{
    /** @param list<string> $tags */
    public function __construct(
        public string $title,
        public string $path,
        public ?string $domain,
        public string $gherkin,
        public string $playwright,
        public array $tags = [],
    ) {}

    public static function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:'.TestArtifact::TITLE_LIMIT],
            'path' => ['required', 'string', 'max:'.TestArtifact::PATH_LIMIT],
            'domain' => ['nullable', 'string', 'max:'.TestArtifact::PATH_LIMIT],
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
            'gherkin.required' => 'O cenário Gherkin é obrigatório.',
            'playwright.required' => 'O teste Playwright é obrigatório.',
        ];
    }
}
