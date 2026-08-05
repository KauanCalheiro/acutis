<?php

namespace App\Support;

use App\Action\ListProjectScenarios;
use App\Data\V1\Project\ScenarioData;
use App\Support\Scenario\Runs;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class Scenario
{
    private const RUNNER_WRAPPER_IMPORT = '/(from\s+[\'"])(?:\.\.?\/)+acutis-run([\'"])/';

    /** O setup de autenticação é infraestrutura do projeto, não um cenário listado, mas usa as mesmas peças. */
    public const AUTH_ID = 'auth';

    public const AUTH_SPEC = 'tests/auth.setup.ts';

    private function __construct(
        private readonly Project $project,
        private readonly string $id,
    ) {}

    public static function make(Project $project, string $id): self
    {
        return new self($project, $id);
    }

    /** Cenário a partir do caminho do spec, quando é ele que se tem em mãos. */
    public static function fromSpec(Project $project, string $spec): self
    {
        return new self($project, self::idFor($spec));
    }

    /** Id do cenário a partir do spec: "tests/x/y.spec.ts" vira "x/y". */
    public static function idFor(string $spec): string
    {
        return preg_replace('/\.(spec|setup)\.ts$/', '', Str::after($spec, 'tests/'));
    }

    public function id(): string
    {
        return $this->id;
    }

    public function isAuth(): bool
    {
        return $this->id === self::AUTH_ID;
    }

    /** Spec relativo: o do setup de autenticação ou o do cenário; 404 se não existir. */
    public function spec(): string
    {
        if (! $this->isAuth()) {
            return $this->data()->spec;
        }

        if (! File::exists($this->project->path().'/'.self::AUTH_SPEC)) {
            throw new NotFoundHttpException('Autenticação não configurada.');
        }

        return self::AUTH_SPEC;
    }

    public function file(): string
    {
        return $this->project->path().'/'.$this->spec();
    }

    /** Conteúdo do spec como o usuário escreveu, sem o wrapper que o runner injeta. */
    public function source(): string
    {
        return self::sourceOf($this->file());
    }

    /** Mesma leitura para um arquivo qualquer, quando não há cenário resolvido em volta. */
    public static function sourceOf(string $file): string
    {
        return preg_replace(self::RUNNER_WRAPPER_IMPORT, '${1}@playwright/test${2}', File::get($file));
    }

    /** Eventos gravados que originaram o spec, no arquivo irmão dele. */
    public function eventsFile(): string
    {
        return $this->project->path().'/'.self::eventsPathOf($this->spec());
    }

    public static function eventsPathOf(string $spec): string
    {
        return preg_replace('/\.(spec|setup)\.ts$/', '.events.json', $spec);
    }

    /** @return list<array<string, mixed>> */
    public function events(): array
    {
        $file = $this->eventsFile();

        return File::exists($file) ? (json_decode(File::get($file), true) ?? []) : [];
    }

    public function runs(): Runs
    {
        return new Runs($this->project, $this->id);
    }

    /** Cenário do projeto pelo id (spec sem "tests/" nem ".spec.ts"); 404 se não existir. */
    public function data(): ScenarioData
    {
        $specRelative = "tests/{$this->id}.spec.ts";

        $scenario = collect(ListProjectScenarios::run($this->project->path()))
            ->first(fn (ScenarioData $candidate): bool => $candidate->spec === $specRelative);

        if (! $scenario) {
            throw new NotFoundHttpException('Cenário não encontrado.');
        }

        return $scenario;
    }
}
