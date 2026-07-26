<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class ScenarioShowData extends Data
{
    /**
     * @param  list<string>  $tags
     * @param  list<array<string, mixed>>  $events
     * @param  list<ScenarioRunData>  $runs
     */
    public function __construct(
        public string $title,
        public string $spec,
        public ?string $feature,
        public array $tags,
        public ?string $domain,
        public string $playwright,
        public ?string $gherkin,
        public array $events,
        public string $updatedAt,
        public array $runs,
    ) {}
}
