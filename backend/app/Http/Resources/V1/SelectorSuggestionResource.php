<?php

namespace App\Http\Resources\V1;

use App\Data\V1\Project\SelectorSuggestionData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SelectorSuggestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var SelectorSuggestionData $suggestion */
        $suggestion = $this->resource;

        return [
            'event' => $suggestion->event,
            'currentSelector' => $suggestion->currentSelector,
            'suggestedTestId' => $suggestion->suggestedTestId,
            'reason' => $suggestion->reason,
        ];
    }
}
