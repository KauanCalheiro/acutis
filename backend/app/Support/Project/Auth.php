<?php

namespace App\Support\Project;

use App\Support\Project;
use App\Support\Scenario;
use Illuminate\Support\Facades\File;

/**
 * A autenticação do projeto: o tests/auth.setup.ts e o playwright.config.ts que faz o Playwright
 * encontrá-lo. As credenciais que ele usa são só duas chaves do .env. Ver EnvKey e Project::env().
 */
final class Auth
{
    public function __construct(private readonly Project $project) {}

    public function exists(): bool
    {
        return File::exists($this->project->path().'/'.Scenario::AUTH_SPEC);
    }

    /**
     * O playwright.config.ts é do usuário: o stub só entra quando o projeto ainda não tem um
     * (clone sem config). Mesclar TypeScript exigiria um parser e sobrescrever apagaria o
     * trabalho dele. A URL base não é definida aqui. Ela vem só das configurações do projeto.
     */
    public function ensureConfig(): void
    {
        $root = $this->project->path();
        File::ensureDirectoryExists("{$root}/tests");
        $file = "{$root}/playwright.config.ts";

        if (! File::exists($file)) {
            File::copy(base_path('stubs/playwright-ts/playwright.config.ts'), $file);
        } else {
            File::put($file, $this->withProjects(File::get($file)));
        }

        $this->project->gitignore()->ensure();
    }

    /**
     * Sem o project "setup" o Playwright nunca acha o auth.setup.ts, porque o testMatch padrão só pega
     * *.spec.ts, e a execução morre com "No tests found" antes de qualquer passo. Projetos criados
     * antes disso existir ficariam com a autenticação escrita e inexecutável, então o bloco entra
     * sozinho. Só quando dá para fazer isso com segurança: config que já declara os próprios
     * projects é decisão do usuário, e config que não dá para localizar o defineConfig fica intacto.
     */
    private function withProjects(string $config): string
    {
        if (str_contains($config, 'projects:') || ! str_contains($config, 'defineConfig({')) {
            return $config;
        }

        $block = <<<'TS'

            projects: [
                { name: 'setup', testMatch: /auth\.setup\.ts/ },
                { name: 'publicos', testMatch: /.*\.spec\.ts/, grep: /@publico/ },
                {
                    name: 'autenticados',
                    testMatch: /.*\.spec\.ts/,
                    grepInvert: /@publico/,
                    dependencies: ['setup'],
                    use: { storageState: process.env.STORAGE_STATE || 'storage-state.json' },
                },
            ],
        TS;

        return str_replace('defineConfig({', 'defineConfig({'.$block, $config);
    }
}
