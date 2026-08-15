<?php

namespace App\Data\V1\Recording;

use Spatie\LaravelData\Data;

class GeneratedTestsData extends Data
{
    /**
     * @param  list<string>  $envVars
     * @param  list<string>  $warnings  o que o Fixer não resolve, como variável declarada sem valor
     */
    public function __construct(
        public string $gherkin,
        public string $playwright,
        public string $domain,
        public array $envVars = [],
        public ?TestRunData $testRun = null,
        public array $warnings = [],
    ) {}
}
