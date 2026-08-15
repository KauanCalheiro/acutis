<?php

namespace App\Support\Scenario;

use App\Support\Project;
use Illuminate\Support\Facades\File;

/** As execuções registradas de um cenário, uma por linha em runs/<id>/history.ndjson. */
final class Runs
{
    public const VIDEO = 'last.webm';

    public const HISTORY = 'history.ndjson';

    /** Execuções guardadas no arquivo; as mais antigas caem fora. */
    public const KEPT = 20;

    private const FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    public function __construct(
        private readonly Project $project,
        private readonly string $scenarioId,
    ) {}

    public function directory(): string
    {
        return $this->project->path()."/runs/{$this->scenarioId}";
    }

    public function file(): string
    {
        return $this->directory().'/'.self::HISTORY;
    }

    public function video(): string
    {
        return $this->directory().'/'.self::VIDEO;
    }

    /** Resultado da execução mais recente registrada, ou null quando nunca rodou. */
    public function lastPassed(): ?bool
    {
        return $this->all()[0]['passed'] ?? null;
    }

    /** Execuções registradas, da mais recente para a mais antiga. */
    public function all(): array
    {
        return collect($this->lines())
            ->reverse()
            ->map(fn (string $line): array => json_decode($line, true))
            ->values()
            ->all();
    }

    /** Acrescenta a execução ao fim do arquivo, mantendo só as KEPT mais recentes. */
    public function append(array $run): void
    {
        File::ensureDirectoryExists($this->directory());
        File::append($this->file(), json_encode($run, self::FLAGS)."\n");

        $lines = $this->lines();

        if (count($lines) > self::KEPT) {
            File::put($this->file(), implode("\n", array_slice($lines, -self::KEPT))."\n");
        }
    }

    /** @return list<string> */
    private function lines(): array
    {
        if (! File::exists($this->file())) {
            return [];
        }

        return collect(explode("\n", File::get($this->file())))
            ->filter(fn (string $line): bool => filled(trim($line)))
            ->values()
            ->all();
    }
}
