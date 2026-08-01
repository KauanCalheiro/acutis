<?php

namespace App\Support\Scenario;

use App\Support\Project;
use Illuminate\Support\Facades\File;

/** As execuções registradas de um cenário, em runs/<id>/. */
final class Runs
{
    public const VIDEO = 'last.webm';

    public const SHOWN = 6;

    public function __construct(
        private readonly Project $project,
        private readonly string $scenarioId,
    ) {}

    public function directory(): string
    {
        return $this->project->path()."/runs/{$this->scenarioId}";
    }

    public function video(): string
    {
        return $this->directory().'/'.self::VIDEO;
    }

    /** Resultado da execução mais recente registrada, ou null quando nunca rodou. */
    public function lastPassed(): ?bool
    {
        $files = $this->files();

        return $files === []
            ? null
            : json_decode((string) File::get($files[0]), true)['passed'] ?? null;
    }

    /** Arquivos de execução, do mais recente para o mais antigo. */
    public function files(): array
    {
        $files = File::glob($this->directory().'/*.json') ?: [];

        rsort($files);

        return $files;
    }
}
