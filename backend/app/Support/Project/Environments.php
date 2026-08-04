<?php

namespace App\Support\Project;

use App\Data\V1\Project\EnvironmentVarData;
use App\Enums\EnvKey;
use App\Support\Project;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * @phpstan-type Environment array{slug: string, name: string, vars: list<EnvironmentVarData>}
 */
final class Environments
{
    private const DIRECTORY = 'environments';

    public function __construct(private readonly Project $project) {}

    /** @return list<Environment> */
    public function all(): array
    {
        $files = File::glob($this->directory().'/*.json') ?: [];
        sort($files);

        return array_values(array_filter(array_map(
            fn (string $file): ?array => $this->read($file),
            $files,
        )));
    }

    /** @return ?Environment */
    public function find(string $slug): ?array
    {
        return $this->read($this->fileOf($slug));
    }

    /** @param  list<EnvironmentVarData>  $vars */
    public function put(string $slug, string $name, array $vars): self
    {
        File::ensureDirectoryExists($this->directory());
        File::put($this->fileOf($slug), json_encode(
            [
                'name' => $name,
                'vars' => array_map(fn (EnvironmentVarData $var): array => [
                    'key' => $var->key,
                    'value' => $var->value,
                    'secret' => $var->secret,
                ], array_values($vars)),
            ],
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
        )."\n");

        return $this;
    }

    public function forget(string $slug): self
    {
        File::delete($this->fileOf($slug));

        if ($this->project->env()->get(EnvKey::ACTIVE_ENVIRONMENT) === $slug) {
            $this->project->env()->set(EnvKey::ACTIVE_ENVIRONMENT, '');
        }

        return $this;
    }

    public function activate(string $slug): self
    {
        $this->project->env()->set(EnvKey::ACTIVE_ENVIRONMENT, $slug);

        return $this;
    }

    public function activeSlug(): ?string
    {
        $chosen = $this->project->env()->get(EnvKey::ACTIVE_ENVIRONMENT);

        if (filled($chosen) && File::exists($this->fileOf($chosen))) {
            return $chosen;
        }

        return $this->all()[0]['slug'] ?? null;
    }

    /** @return ?Environment */
    public function masked(string $slug): ?array
    {
        $environment = $this->find($slug);

        if (blank($environment)) {
            return null;
        }

        $dotenv = $this->project->env()->all();

        $environment['vars'] = array_map(
            fn (EnvironmentVarData $var): EnvironmentVarData => $var->masked($dotenv),
            $environment['vars'],
        );

        return $environment;
    }

    /** @return list<Environment> */
    public function maskedAll(): array
    {
        return array_map(fn (array $environment): array => $this->masked($environment['slug']), $this->all());
    }

    /** @return list<string> */
    public function secretKeys(): array
    {
        $keys = [];

        foreach ($this->all() as $environment) {
            foreach ($environment['vars'] as $var) {
                if ($var->secret && filled($var->pointerKey())) {
                    $keys[] = $var->pointerKey();
                }
            }
        }

        return array_values(array_unique($keys));
    }

    public function secured(string $slug, EnvironmentVarData $var, ?EnvironmentVarData $stored = null): EnvironmentVarData
    {
        $pointed = $var->pointedTo($slug, $stored);

        if (filled($var->value) && ! $var->isPointer()) {
            $this->project->env()->merge([$pointed->pointerKey() => $var->value]);
        }

        return $pointed;
    }

    public function value(EnvKey $key, ?string $default = null): ?string
    {
        $var = $this->activeVar($key);

        if ($var === null) {
            return $this->project->env()->get($key, $default);
        }

        $value = $var->resolve($this->project->env()->all());

        return blank($value) ? $default : $value;
    }

    public function set(EnvKey $key, string $value, bool $secret = false): self
    {
        $slug = $this->activeSlug();
        $environment = filled($slug) ? $this->find($slug) : null;

        if (blank($environment)) {
            $this->project->env()->set($key, $value);

            return $this;
        }

        $vars = $environment['vars'];
        $stored = EnvironmentVarData::keyed($vars, $key->value);
        $var = new EnvironmentVarData($key->value, $value, $secret);

        if ($secret) {
            $var = $this->secured($slug, $var, $stored);
        }

        $index = array_search($stored, $vars, true);
        $index === false ? $vars[] = $var : $vars[$index] = $var;

        return $this->put($slug, $environment['name'], $vars);
    }

    /** @return array<string, string> */
    public function resolve(): array
    {
        $slug = $this->activeSlug();
        $environment = filled($slug) ? $this->find($slug) : null;

        if (blank($environment)) {
            return [];
        }

        $dotenv = $this->project->env()->all();
        $values = $dotenv;

        foreach ($environment['vars'] as $var) {
            $values[$var->key] = $var->resolve($dotenv);
        }

        unset($values[EnvKey::ACTIVE_ENVIRONMENT->value]);
        $values['STORAGE_STATE'] = "storage-state.{$slug}.json";

        return $values;
    }

    private function activeVar(EnvKey $key): ?EnvironmentVarData
    {
        $slug = $this->activeSlug();
        $environment = filled($slug) ? $this->find($slug) : null;

        return blank($environment) ? null : EnvironmentVarData::keyed($environment['vars'], $key->value);
    }

    /** @return ?Environment */
    private function read(string $file): ?array
    {
        if (! File::exists($file)) {
            return null;
        }

        $content = json_decode(File::get($file), true);

        if (! is_array($content)) {
            return null;
        }

        $slug = Str::beforeLast(basename($file), '.json');

        return [
            'slug' => $slug,
            'name' => $content['name'] ?? $slug,
            'vars' => array_map(fn (array $var): EnvironmentVarData => new EnvironmentVarData(
                key: $var['key'],
                value: (string) ($var['value'] ?? ''),
                secret: (bool) ($var['secret'] ?? false),
            ), $content['vars'] ?? []),
        ];
    }

    private function directory(): string
    {
        return $this->project->path().'/'.self::DIRECTORY;
    }

    private function fileOf(string $slug): string
    {
        return $this->directory()."/{$slug}.json";
    }
}
