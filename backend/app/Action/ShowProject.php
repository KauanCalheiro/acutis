<?php

namespace App\Action;

use App\Data\V1\Project\ProjectData;
use App\Enums\GitProvider;
use App\Support\Git;
use App\Support\Project;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class ShowProject
{
    use AsAction;

    /** @return array{project: ProjectData, branch: ?string, updated_at: string, scenarios: list<\App\Data\V1\Project\ScenarioData>} */
    public function handle(string $slug): array
    {
        $path = Project::path($slug);
        $manifest = json_decode((string) File::get($path.'/acutis.json'), true) ?: [];
        $repository = Git::remoteUrl($path);

        $project = new ProjectData(
            name: $manifest['name'] ?? $slug,
            slug: $manifest['slug'] ?? $slug,
            path: $path,
            repository: $repository,
            provider: GitProvider::fromUrl($repository),
            created_at: $manifest['created_at'] ?? null,
        );

        return [
            'project' => $project,
            'branch' => Git::branch($path),
            'updated_at' => Carbon::createFromTimestamp(File::lastModified($path))->toIso8601String(),
            'scenarios' => ListProjectScenarios::run($path),
        ];
    }
}
