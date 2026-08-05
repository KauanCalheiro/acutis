<?php

namespace App\Support\Project;

use App\Support\Project;
use Illuminate\Support\Facades\File;

/**
 * O .gitignore do projeto. Segredo escrito sem estar ignorado é segredo versionado, então toda
 * escrita que possa criar .env ou storage-state.json garante isto por dentro, e nenhuma delas
 * depende de alguém lembrar de chamar depois.
 */
final class Gitignore
{
    private const ENTRIES = [
        'node_modules',
        'storage-state.json',
        'storage-state.*.json',
        '.env',
        'environments',
        'results',
        'playwright-report',
        'test-results',
    ];

    public function __construct(private readonly Project $project) {}

    public function exists(): bool
    {
        return File::exists($this->file());
    }

    /** Acrescenta o que falta e preserva o que já estava lá, porque o arquivo é do usuário. */
    public function ensure(): void
    {
        $existing = $this->exists() ? File::get($this->file()) : '';

        $missing = array_filter(
            self::ENTRIES,
            fn (string $entry): bool => ! str_contains($existing, $entry),
        );

        if ($missing === []) {
            return;
        }

        File::put($this->file(), rtrim($existing."\n".implode("\n", $missing), "\n")."\n");
    }

    private function file(): string
    {
        return $this->project->path().'/.gitignore';
    }
}
