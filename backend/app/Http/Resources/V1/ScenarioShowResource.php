<?php

namespace App\Http\Resources\V1;

use App\Data\V1\Project\ScenarioShowData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScenarioShowResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var ScenarioShowData $scenario */
        $scenario = $this->resource;

        return [
            'title' => $scenario->title,
            'spec' => $scenario->spec,
            'feature' => $scenario->feature,
            'tags' => $scenario->tags,
            'domain' => $scenario->domain,
            'playwright' => $scenario->playwright,
            'gherkin' => $scenario->gherkin,
            'events' => $scenario->events,
            'updated_at' => $scenario->updatedAt,
            'runs' => ScenarioRunResource::collection($scenario->runs),
        ];
    }
}
