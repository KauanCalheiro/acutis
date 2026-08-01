<?php

namespace App\Support;

use App\Support\Project\Auth;
use App\Support\Project\Env;
use App\Support\Project\Gitignore;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class Project
{
    private function __construct(private readonly string $path) {}

    /** Projeto pelo slug; 404 se não existir. */
    public static function make(string $slug): self
    {
        $path = acutis()->projectsPath."/{$slug}";

        if (! File::exists($path.'/acutis.json')) {
            throw new NotFoundHttpException('Projeto não encontrado.');
        }

        return new self($path);
    }

    /** Projeto a partir do caminho já resolvido, para quem não tem o slug em mãos. */
    public static function at(string $path): self
    {
        return new self($path);
    }

    /** Caminho do projeto no host, pra montar o link vscode://file/. */
    public static function hostPath(string $slug): string
    {
        return acutis()->projectsHostPath."/{$slug}";
    }

    public function path(): string
    {
        return $this->path;
    }

    /** Variáveis de ambiente do projeto — URL base, credenciais, valores mascarados dos cenários. */
    public function env(): Env
    {
        return new Env($this);
    }

    /** Autenticação do projeto — o setup, as credenciais e o config que o faz rodar. */
    public function auth(): Auth
    {
        return new Auth($this);
    }

    /** Cenário do projeto pelo id (spec sem "tests/" nem ".spec.ts"). */
    public function scenario(string $id): Scenario
    {
        return Scenario::make($this, $id);
    }

    /** O .gitignore do projeto — o que nunca deve ser versionado. */
    public function gitignore(): Gitignore
    {
        return new Gitignore($this);
    }
}
