<?php

namespace App\Data\V1\Recording;

use Spatie\LaravelData\Data;

class GeneratedTestsData extends Data
{
    /** @param list<string> $envVars */
    public function __construct(
        public string $gherkin,
        public string $playwright,
        public string $domain,
        public array $envVars = [],
        public ?TestRunData $testRun = null,
    ) {}
}
