<?php

namespace App\Action;

use App\Data\V1\Project\ScenarioRunData;
use App\Support\ScenarioRuns;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class ListScenarioRuns
{
    use AsAction;

    /** @return list<ScenarioRunData> */
    public function handle(string $path, string $scenarioId): array
    {
        $directory = ScenarioRuns::directory($path, $scenarioId);
        $video = $directory.'/'.ScenarioRuns::VIDEO;
        $files = File::glob($directory.'/*.json') ?: [];

        rsort($files);

        $runs = collect($files)
            ->take(ScenarioRuns::SHOWN)
            ->map(fn (string $file): array => json_decode((string) File::get($file), true));

        $recorded = File::exists($video)
            ? $runs->search(fn (array $run): bool => (bool) ($run['video'] ?? false))
            : false;

        return $runs
            ->map(fn (array $run, int $index): ScenarioRunData => new ScenarioRunData(
                startedAt: $run['started_at'],
                durationMs: $run['duration_ms'],
                passed: $run['passed'],
                branch: $run['branch'] ?? null,
                author: $run['author'] ?? null,
                steps: $run['steps'] ?? [],
                playwright: $run['playwright'] ?? '',
                videoPath: $index === $recorded ? $video : null,
            ))
            ->values()
            ->all();
    }
}
