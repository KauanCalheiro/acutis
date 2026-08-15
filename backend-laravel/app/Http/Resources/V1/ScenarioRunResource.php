<?php

namespace App\Http\Resources\V1;

use App\Data\V1\Project\ScenarioRunData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScenarioRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var ScenarioRunData $run */
        $run = $this->resource;

        return [
            'started_at' => $run->startedAt,
            'duration_ms' => $run->durationMs,
            'passed' => $run->passed,
            'branch' => $run->branch,
            'author' => $run->author,
            'steps' => $run->steps,
            'playwright' => $run->playwright,
            'video_path' => $run->videoPath,
        ];
    }
}
