<?php

namespace App\Action;

use App\Data\V1\Project\ProjectData;
use App\Data\V1\Project\ScenarioData;
use App\Enums\GitProvider;
use App\Support\Git;
use App\Support\Project;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class ShowProject
{
    use AsAction;

    /** @return array{project: ProjectData, branch: ?string, updated_at: string, scenarios: list<ScenarioData>, auth_status: string, vscode_url: string} */
    public function handle(string $slug): array
    {
        $path = Project::path($slug);
        $manifest = json_decode((string) File::get($path.'/acutis.json'), true) ?: [];
        $repository = Git::in($path)->remoteUrl();

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
            'branch' => Git::in($path)->branch(),
            'updated_at' => Carbon::createFromTimestamp(File::lastModified($path))->toIso8601String(),
            'scenarios' => ListProjectScenarios::run($path),
            'auth_status' => $this->authStatus($path, $manifest),
            'vscode_url' => 'vscode://file'.Project::hostPath($slug),
        ];
    }

    private function authStatus(string $path, array $manifest): string
    {
        if (File::exists("{$path}/tests/auth.setup.ts")) {
            return 'configured';
        }

        return ($manifest['auth_skipped'] ?? false) ? 'skipped' : 'unset';
    }
}
