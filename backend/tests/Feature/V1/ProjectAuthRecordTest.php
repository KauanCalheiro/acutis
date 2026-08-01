<?php

use App\Ai\Agents\AuthRecordingWriter;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function recordProject(string $name = 'Portal Sistema'): string
{
    postJson('/api/v1/projects/create/template', ['name' => $name])->assertCreated();

    return Str::slug($name);
}

function recordPayload(array $overrides = []): array
{
    return array_merge([
        'baseUrl' => 'https://sistema.test/login',
        'events' => [
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'https://sistema.test/login', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
            ['type' => 'fill', 'timestamp' => 2, 'url' => 'https://sistema.test/login', 'selectors' => ['dataTestId' => 'user'], 'label' => 'Usuário', 'value' => 'user1', 'inputType' => 'text'],
            ['type' => 'fill', 'timestamp' => 3, 'url' => 'https://sistema.test/login', 'selectors' => ['dataTestId' => 'pass'], 'label' => 'Senha', 'value' => 'topsecret123', 'inputType' => 'password'],
            ['type' => 'submit', 'timestamp' => 4, 'url' => 'https://sistema.test/login', 'selectors' => ['dataTestId' => 'entrar'], 'label' => 'Entrar', 'value' => null, 'inputType' => null],
        ],
    ], $overrides);
}

it('writes the generated auth setup from the recording into the project folder', function () {
    AuthRecordingWriter::fake([['authSetup' => "import { test as setup } from '@playwright/test' // login gravado"]]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())
        ->assertOk()
        ->assertJsonPath('authSetup', fn ($v) => str_contains($v, 'login gravado'))
        ->assertJsonPath('credentialsNeeded', false);

    $dir = $this->projectsPath."/{$slug}";

    expect(File::get($dir.'/tests/auth.setup.ts'))->toContain('login gravado')
        ->and(File::exists($dir.'/.gitignore'))->toBeTrue();
});

it('never sets the base url — that comes from the project settings only', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";
    $config = File::get($dir.'/playwright.config.ts');

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload([
        'executionUrl' => 'https://homolog.sistema.test',
    ]))->assertOk();

    expect(File::get($dir.'/.env'))->not->toContain('BASE_URL')
        ->and(File::get($dir.'/playwright.config.ts'))->toBe($config);
});

it('never executes anything — running the setup is the caller\'s job', function () {
    AuthRecordingWriter::fake();
    Http::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    Http::assertNothingSent();
});

it('shows the recorded events to the writer, redacting the real password first', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthRecordingWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'https://sistema.test/login')
            && str_contains($prompt->prompt, '••••')
            && ! str_contains($prompt->prompt, 'topsecret123')
            && str_contains($prompt->prompt, 'dataTestId')
    );
});

it('keeps the real password out of the response body', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    $response = postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect($response->getContent())->not->toContain('topsecret123');
});

it('writes the recorded credentials into .env and a placeholder .env.example', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    $dir = $this->projectsPath."/{$slug}";

    expect(File::get($dir.'/.env'))
        ->toContain('AUTH_USER=user1')
        ->toContain('AUTH_PASSWORD=topsecret123')
        ->and(File::get($dir.'/.env.example'))
        ->toContain('AUTH_USER=')
        ->toContain('AUTH_PASSWORD=')
        ->not->toContain('topsecret123')
        ->and(File::get($dir.'/.gitignore'))->toContain('.env');
});

it('preserves env keys the project already had', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";
    File::put($dir.'/.env', "CHECKOUT_CARD=4111111111111111\nAUTH_USER=antigo\n");

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($dir.'/.env'))
        ->toContain('CHECKOUT_CARD=4111111111111111')
        ->toContain('AUTH_USER=user1')
        ->not->toContain('AUTH_USER=antigo');
});

it('leaves a config it cannot parse untouched', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";
    File::put($dir.'/playwright.config.ts', '// configuração escrita pelo usuário');

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($dir.'/playwright.config.ts'))->toBe('// configuração escrita pelo usuário');
});

it('teaches an old config about the auth setup, keeping what the user wrote', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";
    File::put($dir.'/playwright.config.ts', <<<'TS'
    import { defineConfig } from '@playwright/test'

    export default defineConfig({
        testDir: './tests',
        use: {
            launchOptions: { slowMo: 300 },
            baseURL: 'http://localhost:3000',
        },
    })
    TS);

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($dir.'/playwright.config.ts'))
        ->toContain("name: 'setup'")
        ->toContain('auth\\.setup\\.ts')
        ->toContain("name: 'publicos'")
        ->toContain("name: 'autenticados'")
        ->toContain('slowMo: 300')
        ->toContain("baseURL: 'http://localhost:3000'");
});

it('does not touch a config that already declares its own projects', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";
    $meu = "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ projects: [{ name: 'meu' }] })\n";
    File::put($dir.'/playwright.config.ts', $meu);

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($dir.'/playwright.config.ts'))->toBe($meu);
});

it('asks for credentials when it cannot extract them from the recording', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload([
        'events' => [
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'https://sso.test/entrar', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
            ['type' => 'click', 'timestamp' => 2, 'url' => 'https://sso.test/entrar', 'selectors' => ['dataTestId' => 'sso'], 'label' => 'Entrar com SSO', 'value' => null, 'inputType' => null],
        ],
    ]))
        ->assertOk()
        ->assertJsonPath('credentialsNeeded', true);

    $dir = $this->projectsPath."/{$slug}";

    expect(File::exists($dir.'/tests/auth.setup.ts'))->toBeTrue()
        ->and(File::exists($dir.'/.env'))->toBeFalse();
});

it('persists the recorded events so the fixer can read them later, with the password redacted', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    $events = json_decode(File::get($this->projectsPath."/{$slug}/tests/auth.events.json"), true);

    expect($events)->toHaveCount(4)
        ->and($events[2]['value'])->toBe('••••')
        ->and($events[1]['value'])->toBe('user1');
});

it('returns 404 for a project that does not exist', function () {
    AuthRecordingWriter::fake();

    postJson('/api/v1/projects/inexistente/auth/record', recordPayload())->assertNotFound();
});

it('validates the recording payload', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", ['events' => []])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['baseUrl', 'events']);
});

it('leaves a base url the user configured untouched', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";
    File::put($dir.'/.env', "BASE_URL=https://escolhida-pelo-usuario.test\n");

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($dir.'/.env'))
        ->toContain('BASE_URL=https://escolhida-pelo-usuario.test')
        ->not->toContain('sistema.test/login');
});
