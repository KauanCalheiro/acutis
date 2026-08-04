<?php

namespace App\Support\Project;

use App\Data\V1\Project\EnvironmentVarData;
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

    public function get(EnvKey $key, ?string $default = null): ?string
    {
        return $this->all()[$key->value] ?? $default;
    }

    public function set(EnvKey $key, string $value): void
    {
        $this->merge([$key->value => $value]);
    }

    /** @return array<string, string> */
    public function all(): array
    {
        return $this->parse($this->file());
    }

    /** @return list<string> */
    public function exampleKeys(): array
    {
        return array_keys($this->parse($this->example()));
    }

    /** @param  list<string>  $keys */
    public function remove(array $keys): void
    {
        $this->removeFrom($this->file(), $keys);
        $this->removeFrom($this->example(), $keys);
    }

    /**
     * Chaves que a IA declarou para um cenário — nomes dinâmicos, sem enum possível.
     *
     * @param  array<string, string>  $values
     */
    public function merge(array $values): void
    {
        $this->mergeFile($this->file(), $values);
        $this->mergeFile($this->example(), array_fill_keys($this->withoutLocalState(array_keys($values)), ''));

        $this->project->gitignore()->ensure();
    }

    /**
     * @param  list<string>  $keys
     * @return list<string>
     */
    private function withoutLocalState(array $keys): array
    {
        return array_values(array_diff($keys, [EnvKey::ACTIVE_ENVIRONMENT->value]));
    }

    /** @param  list<string>  $keys */
    private function removeFrom(string $file, array $keys): void
    {
        if (! File::exists($file)) {
            return;
        }

        $lines = array_filter(
            explode("\n", rtrim(File::get($file), "\n")),
            fn (string $line): bool => ! in_array(EnvironmentVarData::fromLine($line)?->key, $keys, true),
        );

        File::put($file, blank($lines) ? '' : implode("\n", $lines)."\n");
    }

    /** @return array<string, string> */
    private function parse(string $file): array
    {
        if (! File::exists($file)) {
            return [];
        }

        $values = [];

        foreach (explode("\n", File::get($file)) as $line) {
            $var = EnvironmentVarData::fromLine($line);

            if ($var !== null) {
                $values[$var->key] = (string) $var->value;
            }
        }

        return $values;
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
            $index = $this->lineOf($lines, $key);
            $line = (new EnvironmentVarData($key, $value))->toLine();

            if ($index !== null) {
                $lines[$index] = $line;
            } else {
                $lines[] = $line;
            }
        }

        File::put($file, implode("\n", $lines)."\n");
    }

    /** @param  list<string>  $lines */
    private function lineOf(array $lines, string $key): ?int
    {
        foreach ($lines as $index => $line) {
            if (EnvironmentVarData::fromLine($line)?->key === $key) {
                return $index;
            }
        }

        return null;
    }
}
