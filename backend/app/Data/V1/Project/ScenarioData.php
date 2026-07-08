<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class ScenarioData extends Data
{
    /** @param  list<string>  $tags */
    public function __construct(
        public string $title,
        public string $spec,
        public ?string $feature,
        public array $tags,
        public ?string $domain,
    ) {}
}
