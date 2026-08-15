<?php

namespace App\Support;

final class AcutisConfig
{
    public function __construct(
        public readonly string $projectsPath,
        public readonly string $projectsHostPath,
        public readonly string $webdriverUrl,
    ) {}

    /** Constrói a partir da config atual (lê a cada chamada, respeitando overrides em runtime/testes). */
    public static function resolve(): self
    {
        $projectsPath = self::toAbsolutePath((string) config('acutis.projects.path'));

        return new self(
            projectsPath: $projectsPath,
            projectsHostPath: (string) (config('acutis.projects.host_path') ?: $projectsPath),
            webdriverUrl: (string) config('acutis.webdriver.url'),
        );
    }

    /**
     * O caminho atravessa a fronteira HTTP até o webdriver, que resolve relativo ao cwd dele:
     * um caminho relativo aponta pra lugar nenhum do outro lado.
     */
    private static function toAbsolutePath(string $path): string
    {
        return str_starts_with($path, '/') ? $path : base_path($path);
    }
}
