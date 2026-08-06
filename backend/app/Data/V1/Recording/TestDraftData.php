<?php

namespace App\Data\V1\Recording;

use Spatie\LaravelData\Data;

class TestDraftData extends Data
{
    /**
     * @param  list<string>  $tags
     * @param  list<string>  $envVars
     * @param  list<string>  $warnings  o que só o usuário resolve, como variável declarada sem valor
     */
    public function __construct(
        public string $title,
        public array $tags,
        public string $domain,
        public string $path,
        public string $gherkin,
        public string $playwright,
        public array $envVars = [],
        public array $warnings = [],
    ) {}
}
