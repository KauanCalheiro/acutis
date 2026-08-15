<?php

namespace App\Http\Resources\V1;

use App\Data\V1\Project\ProjectData;
use App\Data\V1\Project\ScenarioData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectShowResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var ProjectData $project */
        $project = $this->resource['project'];

        return [
            'name' => $project->name,
            'slug' => $project->slug,
            'path' => $project->path,
            'repository' => $project->repository,
            'provider' => $project->provider?->value,
            'branch' => $this->resource['branch'],
            'created_at' => $project->created_at,
            'updated_at' => $this->resource['updated_at'],
            'scenarios' => array_map(
                fn (ScenarioData $scenario): array => $scenario->toArray(),
                $this->resource['scenarios'],
            ),
            'auth_status' => $this->resource['auth_status'],
            'base_url' => $this->resource['base_url'],
            'storage_state' => $this->resource['storage_state'],
            'requires_url' => $this->resource['requires_url'],
            'vscode_url' => $this->resource['vscode_url'],
        ];
    }
}
