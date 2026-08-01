<?php

namespace App\Action;

use App\Support\Git;
use App\Support\Project;
use App\Support\Scenario;
use App\Support\Scenario\Runs;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class PersistScenarioRun
{
    use AsAction;

    /** @param  list<array<string, mixed>>  $events */
    public function handle(string $path, string $spec, array $events, Carbon $startedAt): void
    {
        $scenario = Scenario::fromSpec(Project::at($path), $spec);
        $scenarioId = $scenario->id();
        $directory = $scenario->runs()->directory();
        $specFile = "{$path}/{$spec}";

        File::ensureDirectoryExists($directory);

        $video = $this->copyVideo($events, $directory);
        $file = $startedAt->clone()->utc()->format('Y-m-d\TH-i-s.u\Z').'-'.Str::lower(Str::random(4)).'.json';
        $git = Git::in($path);

        File::put("{$directory}/{$file}", json_encode([
            'started_at' => $startedAt->toIso8601String(),
            'duration_ms' => $this->durationMs($events),
            'passed' => $this->passed($events),
            'branch' => $git->branch(),
            'author' => $git->author(),
            'video' => $video,
            'steps' => $this->steps($events),
            'playwright' => File::exists($specFile) ? Scenario::sourceOf($specFile) : '',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

        $committed = ["runs/{$scenarioId}/{$file}"];

        if ($video) {
            $committed[] = 'runs/'.$scenarioId.'/'.Runs::VIDEO;
        }

        $git->commit("chore: registrar execução de {$scenarioId}", $committed)->push();
    }

    /** @param  list<array<string, mixed>>  $events */
    private function steps(array $events): array
    {
        $timeline = collect($events)
            ->firstWhere('event', 'run:started')['steps'] ?? [];

        $timeline = collect($timeline)->map(fn (string $title): array => [
            'title' => $title,
            'status' => 'waiting',
            'duration_ms' => 0,
            'error' => null,
        ]);

        foreach ($events as $event) {
            if ($event['event'] !== 'step' || $event['status'] === 'pending') {
                continue;
            }

            $ran = [
                'title' => $event['title'],
                'status' => $event['status'],
                'duration_ms' => $event['durationMs'] ?? 0,
                'error' => $event['error'] ?? null,
            ];

            $waiting = $timeline->search(
                fn (array $step): bool => $step['title'] === $event['title'] && $step['status'] === 'waiting'
            );

            $waiting === false
                ? $timeline->push($ran)
                : $timeline->put($waiting, $ran);
        }

        return $timeline->values()->all();
    }

    /** @param  list<array<string, mixed>>  $events */
    private function passed(array $events): bool
    {
        return collect($events)
            ->last(fn (array $event): bool => $event['event'] === 'run:finished')['passed'] ?? false;
    }

    /** @param  list<array<string, mixed>>  $events */
    private function durationMs(array $events): int
    {
        return collect($events)
            ->filter(fn (array $event): bool => $event['event'] === 'test' && $event['status'] !== 'pending')
            ->sum(fn (array $event): int => $event['durationMs'] ?? 0);
    }

    /** @param  list<array<string, mixed>>  $events */
    private function copyVideo(array $events, string $directory): bool
    {
        $source = collect($events)
            ->filter(fn (array $event): bool => $event['event'] === 'test' && filled($event['videoPath'] ?? null))
            ->value('videoPath');

        if (blank($source) || ! File::exists($source)) {
            return false;
        }

        File::copy($source, $directory.'/'.Runs::VIDEO);

        return true;
    }
}
