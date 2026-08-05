<?php

use App\Enums\EnvKey;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

use function Pest\Laravel\getJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    $this->dir = $this->projectsPath.'/minha-loja';
    File::ensureDirectoryExists($this->dir);
    File::put($this->dir.'/acutis.json', json_encode([
        'name' => 'Minha Loja',
        'slug' => 'minha-loja',
        'created_at' => '2026-01-01T00:00:00+00:00',
        'version' => 1,
    ]));
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function authRun(string $dir, string $file, bool $passed): void
{
    File::ensureDirectoryExists($dir.'/runs/auth');
    File::put($dir."/runs/auth/{$file}.json", json_encode([
        'started_at' => '2026-01-01T10:00:00+00:00',
        'duration_ms' => 1200,
        'passed' => $passed,
        'steps' => [],
        'playwright' => '',
    ]));
}

it('shows the session file of the active environment, which is what the recorder loads', function () {
    File::ensureDirectoryExists($this->dir.'/environments');
    File::put($this->dir.'/environments/homolog.json', json_encode(['name' => 'Homolog', 'vars' => []]));
    File::put($this->dir.'/.env', EnvKey::ACTIVE_ENVIRONMENT->value."=homolog\n");

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('storage_state', $this->dir.'/storage-state.homolog.json');
});

it('falls back to the plain session file while the project has no environment', function () {
    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('storage_state', $this->dir.'/storage-state.json');
});

it('shows the project details', function () {
    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('name', 'Minha Loja')
        ->assertJsonPath('slug', 'minha-loja')
        ->assertJsonPath('path', $this->dir)
        ->assertJsonPath('repository', null)
        ->assertJsonPath('provider', null)
        ->assertJsonPath('branch', null)
        ->assertJsonPath('scenarios', [])
        ->assertJsonPath('auth_status', 'unset')
        ->assertJsonStructure(['created_at', 'updated_at']);
});

it('shows the auth status as configured when auth.setup.ts exists and was never run', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/auth.setup.ts', 'import { test as setup } from "@playwright/test"');

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('auth_status', 'configured');
});

it('shows the auth status as failing when the last recorded run did not pass', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/auth.setup.ts', 'import { test as setup } from "@playwright/test"');
    authRun($this->dir, '2026-01-01T10-00-00.000000Z-aaaa', passed: true);
    authRun($this->dir, '2026-01-02T10-00-00.000000Z-bbbb', passed: false);

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('auth_status', 'failing');
});

it('goes back to configured once a newer run passes', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/auth.setup.ts', 'import { test as setup } from "@playwright/test"');
    authRun($this->dir, '2026-01-01T10-00-00.000000Z-aaaa', passed: false);
    authRun($this->dir, '2026-01-02T10-00-00.000000Z-bbbb', passed: true);

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('auth_status', 'configured');
});

it('shows the auth status as skipped when dismissed in the manifest', function () {
    File::put($this->dir.'/acutis.json', json_encode([
        'name' => 'Minha Loja',
        'slug' => 'minha-loja',
        'created_at' => '2026-01-01T00:00:00+00:00',
        'version' => 1,
        'auth_skipped' => true,
    ]));

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('auth_status', 'skipped');
});

it('prefers configured over skipped when both are true', function () {
    File::put($this->dir.'/acutis.json', json_encode([
        'name' => 'Minha Loja',
        'slug' => 'minha-loja',
        'created_at' => '2026-01-01T00:00:00+00:00',
        'version' => 1,
        'auth_skipped' => true,
    ]));
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/auth.setup.ts', 'import { test as setup } from "@playwright/test"');

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('auth_status', 'configured');
});

it('shows the git branch when the project is a repository', function () {
    (new Process(['git', 'init', '-q', '-b', 'trunk'], $this->dir))->mustRun();
    (new Process([
        'git', '-c', 'user.email=t@t.dev', '-c', 'user.name=Test',
        'commit', '--allow-empty', '-qm', 'init',
    ], $this->dir))->mustRun();

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('branch', 'trunk');
});

it('lists the scenarios with title and tags from the spec', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::ensureDirectoryExists($this->dir.'/features');

    File::put($this->dir.'/tests/login-do-cliente.spec.ts', <<<'TS'
    import { test, expect } from '@playwright/test'

    test.describe('Login do cliente', { tag: ['@read', '@login'] }, () => {
        test('entra com credenciais válidas', async ({ page }) => {})
    })
    TS);

    File::put($this->dir.'/features/login-do-cliente.feature', <<<'GHERKIN'
    Funcionalidade: Login do cliente
      Cenário: entra com credenciais válidas
    GHERKIN);

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonCount(1, 'scenarios')
        ->assertJsonPath('scenarios.0.title', 'Login do cliente')
        ->assertJsonPath('scenarios.0.spec', 'tests/login-do-cliente.spec.ts')
        ->assertJsonPath('scenarios.0.feature', 'features/login-do-cliente.feature')
        ->assertJsonPath('scenarios.0.tags', ['@read', '@login']);
});

it('ignores the auth setup spec in the scenarios', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/auth.setup.ts', 'import { test as setup } from "@playwright/test"');

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('scenarios', []);
});

it('falls back to the file name when there is no describe title', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/fluxo-solto.spec.ts', <<<'TS'
    import { test } from '@playwright/test'
    test('caso único', async ({ page }) => {})
    TS);

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('scenarios.0.title', 'fluxo-solto')
        ->assertJsonPath('scenarios.0.feature', null)
        ->assertJsonPath('scenarios.0.tags', []);
});

it('returns 404 for an unknown project', function () {
    getJson('/api/v1/projects/nao-existe')->assertNotFound();
});

it('builds the vscode url from the configured host path', function () {
    config()->set('acutis.projects.host_path', '/Users/dev/code/.acutis');

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('vscode_url', 'vscode://file/Users/dev/code/.acutis/minha-loja');
});

it('falls back to the projects path when no host path is configured', function () {
    config()->set('acutis.projects.host_path', null);

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('vscode_url', 'vscode://file'.$this->dir);
});
