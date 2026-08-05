<?php

namespace App\Action;

use App\Data\V1\Project\ProjectData;
use App\Data\V1\Project\ScenarioData;
use App\Enums\EnvKey;
use App\Enums\GitProvider;
use App\Support\Git;
use App\Support\Project;
use App\Support\Scenario;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class ShowProject
{
    use AsAction;

    /** @return array{project: ProjectData, branch: ?string, updated_at: string, scenarios: list<ScenarioData>, auth_status: string, base_url: ?string, storage_state: string, vscode_url: string} */
    public function handle(string $slug): array
    {
        $folder = Project::make($slug);
        $path = $folder->path();
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

        $baseUrl = $folder->environments()->value(EnvKey::URL);

        return [
            'project' => $project,
            'branch' => Git::in($path)->branch(),
            'updated_at' => Carbon::createFromTimestamp(File::lastModified($path))->toIso8601String(),
            'scenarios' => ListProjectScenarios::run($path),
            'auth_status' => $this->authStatus($folder, $manifest),
            'base_url' => $baseUrl,
            'storage_state' => $path.'/'.$folder->environments()->storageState(),
            'requires_url' => blank($baseUrl) && ! ($manifest['url_skipped'] ?? false),
            'vscode_url' => 'vscode://file'.Project::hostPath($slug),
        ];
    }

    /**
     * Status vem da última execução registrada, não da existência do arquivo. Um setup que
     * falhou não conta como configurado. Sem execução nenhuma (projeto clonado, script escrito
     * à mão) não dá pra afirmar que falha, então vale o benefício da dúvida.
     */
    private function authStatus(Project $folder, array $manifest): string
    {
        if (! $folder->auth()->exists()) {
            return ($manifest['auth_skipped'] ?? false) ? 'skipped' : 'unset';
        }

        return $folder->scenario(Scenario::AUTH_ID)->runs()->lastPassed() === false ? 'failing' : 'configured';
    }
}
