<?php

namespace App\Support;

final class AcutisConfig
{
    public function __construct(
        public readonly string $projectsPath,
        public readonly string $projectsHostPath,
        public readonly string $webdriverUrl,
    ) {}

    /** Constrói a partir da config atual (lê a cada chamada — respeita overrides em runtime/testes). */
    public static function resolve(): self
    {
        return new self(
            projectsPath: (string) config('acutis.projects.path'),
            projectsHostPath: (string) (config('acutis.projects.host_path') ?: config('acutis.projects.path')),
            webdriverUrl: (string) config('acutis.webdriver.url'),
        );
    }
}
