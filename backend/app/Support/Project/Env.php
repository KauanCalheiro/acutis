<?php

namespace App\Support\Project;

use App\Enums\EnvKey;
use App\Support\Project;
use Illuminate\Support\Facades\File;

/**
 * O .env do projeto: URL base, credenciais do login e os valores mascarados que os cenários usam.
 * Nunca reescreve o arquivo inteiro — o que está lá é do usuário e pode ter chaves que não são
 * nossas. Cada escrita espelha as chaves (sem valor) no .env.example e garante o .gitignore.
 */
final class Env
{
    public function __construct(private readonly Project $project) {}

    public function get(EnvKey $key): ?string
    {
        $file = $this->file();

        if (! File::exists($file)) {
            return null;
        }

        $lines = explode("\n", File::get($file));
        $index = $this->findLineIndex($lines, $key->value);

        return $index === null ? null : (trim(substr($lines[$index], strlen($key->value) + 1)) ?: null);
    }

    public function set(EnvKey $key, string $value): void
    {
        $this->merge([$key->value => $value]);
    }

    /**
     * Chaves que a IA declarou para um cenário — nomes dinâmicos, sem enum possível.
     *
     * @param  array<string, string>  $values
     */
    public function merge(array $values): void
    {
        $this->mergeFile($this->file(), $values);
        $this->mergeFile($this->example(), array_fill_keys(array_keys($values), ''));

        $this->project->gitignore()->ensure();
    }

    private function file(): string
    {
        return $this->project->path().'/.env';
    }

    private function example(): string
    {
        return $this->project->path().'/.env.example';
    }

    /** @param  array<string, string>  $values */
    private function mergeFile(string $file, array $values): void
    {
        $existing = File::exists($file) ? File::get($file) : '';
        $lines = $existing === '' ? [] : explode("\n", rtrim($existing, "\n"));

        foreach ($values as $key => $value) {
            $index = $this->findLineIndex($lines, $key);

            if ($index !== null) {
                $lines[$index] = "{$key}={$value}";
            } else {
                $lines[] = "{$key}={$value}";
            }
        }

        File::put($file, implode("\n", $lines)."\n");
    }

    /** @param  list<string>  $lines */
    private function findLineIndex(array $lines, string $key): ?int
    {
        foreach ($lines as $index => $line) {
            if (str_starts_with($line, "{$key}=")) {
                return $index;
            }
        }

        return null;
    }
}
