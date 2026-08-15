<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class SelectorSuggestionData extends Data
{
    public function __construct(
        public string $event,
        public string $currentSelector,
        public string $suggestedTestId,
        public string $reason,
    ) {}
}
