<?php

namespace App\Data\V1\Recording;

use Spatie\LaravelData\Data;

class TestDraftData extends Data
{
    /** @param list<string> $tags */
    public function __construct(
        public string $title,
        public array $tags,
        public string $domain,
        public string $path,
        public string $gherkin,
        public string $playwright,
    ) {}
}
