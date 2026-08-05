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

    private const DEFAULT_SLUG = 'ambiente';

    private const DEFAULT_NAME = 'Ambiente';

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

        $this->project->gitignore()->ensure();

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
    public function displayed(string $slug): ?array
    {
        $environment = $this->find($slug);

        if (blank($environment)) {
            return null;
        }

        $environment['vars'] = array_map(
            fn (EnvironmentVarData $var): EnvironmentVarData => $var->displayed(),
            $environment['vars'],
        );

        return $environment;
    }

    /** @return list<Environment> */
    public function displayedAll(): array
    {
        return array_map(fn (array $environment): array => $this->displayed($environment['slug']), $this->all());
    }

    /**
     * A chave é estrutura compartilhada: existe em todos os ambientes, com o mesmo flag de
     * segredo. Só o valor muda de um para o outro. Quem acabou de ser salvo manda no conjunto,
     * senão remover uma variável num ambiente nunca a removeria dos demais.
     */
    public function alignTo(string $slug): self
    {
        $reference = $this->find($slug);

        if (blank($reference)) {
            return $this;
        }

        foreach ($this->all() as $environment) {
            if ($environment['slug'] === $slug) {
                continue;
            }

            $vars = array_map(
                fn (EnvironmentVarData $var): EnvironmentVarData => new EnvironmentVarData(
                    key: $var->key,
                    value: EnvironmentVarData::keyed($environment['vars'], $var->key)?->value ?? '',
                    secret: $var->secret,
                ),
                $reference['vars'],
            );

            $this->put($environment['slug'], $environment['name'], $vars);
        }

        return $this;
    }

    /**
     * Um projeto sempre tem ambiente, e todo ambiente sempre tem as chaves que o acutis precisa
     * para rodar: a URL do sistema, mais usuário e senha quando existe autenticação gravada.
     */
    public function ensure(): self
    {
        if (blank($this->all())) {
            $this->put(self::DEFAULT_SLUG, self::DEFAULT_NAME, $this->seededFromDotenv())
                ->activate(self::DEFAULT_SLUG);
        }

        foreach ($this->all() as $environment) {
            $vars = $environment['vars'];
            $before = count($vars);

            foreach ($this->requiredKeys() as $key) {
                if (EnvironmentVarData::keyed($vars, $key->value) === null) {
                    $vars[] = new EnvironmentVarData($key->value, '', $key === EnvKey::PASSWORD);
                }
            }

            if (count($vars) !== $before) {
                $this->put($environment['slug'], $environment['name'], $vars);
            }
        }

        return $this;
    }

    /** @return list<EnvKey> */
    private function requiredKeys(): array
    {
        return $this->project->auth()->exists()
            ? [EnvKey::URL, EnvKey::USER, EnvKey::PASSWORD]
            : [EnvKey::URL];
    }

    /** @return list<EnvironmentVarData> */
    private function seededFromDotenv(): array
    {
        $dotenv = $this->project->env()->all();
        $vars = [];

        foreach ([EnvKey::URL, EnvKey::USER, EnvKey::PASSWORD] as $key) {
            if (filled($dotenv[$key->value] ?? null)) {
                $vars[] = new EnvironmentVarData($key->value, $dotenv[$key->value], $key === EnvKey::PASSWORD);
            }
        }

        return $vars;
    }

    /** @return list<EnvironmentVarData> */
    public function activeVars(): array
    {
        $slug = $this->activeSlug();
        $environment = filled($slug) ? $this->find($slug) : null;

        return $environment['vars'] ?? [];
    }

    /** @return list<EnvironmentVarData> */
    public function declaredKeys(): array
    {
        $environment = $this->all()[0] ?? null;

        if (blank($environment)) {
            return [];
        }

        return array_map(
            fn (EnvironmentVarData $var): EnvironmentVarData => new EnvironmentVarData($var->key, '', $var->secret),
            $environment['vars'],
        );
    }

    public function value(EnvKey $key, ?string $default = null): ?string
    {
        $var = $this->activeVar($key);

        if ($var === null || blank($var->value)) {
            return $this->project->env()->get($key, $default);
        }

        return $var->value;
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
        $index = array_search($stored, $vars, true);
        $var = new EnvironmentVarData($key->value, $value, $secret);

        $index === false ? $vars[] = $var : $vars[$index] = $var;

        return $this->put($slug, $environment['name'], $vars);
    }

    /** @param  array<string, string>  $values */
    public function merge(array $values): self
    {
        $slug = $this->activeSlug();
        $environment = filled($slug) ? $this->find($slug) : null;

        if (blank($environment)) {
            $this->project->env()->merge($values);

            return $this;
        }

        $vars = $environment['vars'];

        foreach ($values as $key => $value) {
            $stored = EnvironmentVarData::keyed($vars, $key);
            $index = array_search($stored, $vars, true);
            $var = new EnvironmentVarData($key, $value, $stored?->secret ?? false);

            $index === false ? $vars[] = $var : $vars[$index] = $var;
        }

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

        $values = $this->project->env()->all();

        foreach ($environment['vars'] as $var) {
            $values[$var->key] = (string) $var->value;
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
