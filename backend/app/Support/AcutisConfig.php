<?php

namespace App\Support;

final class AcutisConfig
{
    public function __construct(
        public readonly string $projectsPath,
    ) {}

    /** Constrói a partir da config atual (lê a cada chamada — respeita overrides em runtime/testes). */
    public static function resolve(): self
    {
        return new self(
            projectsPath: (string) config('acutis.projects.path'),
        );
    }
}
