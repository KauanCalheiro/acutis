<?php

use App\Ai\Agents\AuthRecordingWriter;
use App\Ai\Agents\GherkinWriter;
use App\Enums\EnvKey;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    GherkinWriter::fake([['gherkin' => "@write\nFuncionalidade: Entrar no sistema", 'domain' => 'login']]);
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

    expect(File::get($dir.'/.env'))->not->toContain('URL')
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

it('tells the writer which url the login landed on, so it never invents one', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload([
        'events' => array_merge(recordPayload()['events'], [
            ['type' => 'navigate', 'timestamp' => 5, 'url' => 'https://sistema.test/inicio', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
            ['type' => 'navigate', 'timestamp' => 6, 'url' => 'https://sistema.test/inicio/pedidos', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
        ]),
    ]))->assertOk();

    AuthRecordingWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'URL pós-login: https://sistema.test/inicio')
    );
});

it('tells the writer there is no landing url when the recording never left the login', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthRecordingWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'URL pós-login: nenhuma navegação após o submit foi gravada')
            && ! str_contains($prompt->prompt, 'URL pós-login: https')
    );
});

it('keeps the real password out of the response body', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    $response = postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect($response->getContent())->not->toContain('topsecret123');
});

it('writes the recorded credentials into the environment', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    $dir = $this->projectsPath."/{$slug}";
    $environment = json_decode(File::get($dir.'/environments/ambiente.json'), true);

    expect($environment['vars'])->toContain(
        ['key' => EnvKey::USER->value, 'value' => 'user1', 'secret' => false],
        ['key' => EnvKey::PASSWORD->value, 'value' => 'topsecret123', 'secret' => true],
    )->and(File::get($dir.'/.gitignore'))->toContain('environments');
});

it('replaces the credentials the environment already had', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";

    postJson("/api/v1/projects/{$slug}/auth/credentials", [
        'username' => 'antigo',
        'password' => 'antiga',
    ])->assertNoContent();
    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    $environment = json_decode(File::get($dir.'/environments/ambiente.json'), true);

    expect($environment['vars'])->toContain(['key' => EnvKey::USER->value, 'value' => 'user1', 'secret' => false])
        ->and(json_encode($environment))->not->toContain('antigo');
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

    $environment = json_decode(File::get($dir.'/environments/ambiente.json'), true);

    expect(File::exists($dir.'/tests/auth.setup.ts'))->toBeTrue()
        ->and(collect($environment['vars'])->firstWhere('key', EnvKey::USER->value)['value'])->toBe('');
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

it('writes the gherkin of the login next to the setup', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($this->projectsPath."/{$slug}/features/auth.feature"))
        ->toContain('Funcionalidade: Entrar no sistema');
});

it('keeps the auth feature in its fixed path, whatever domain the writer suggests', function () {
    AuthRecordingWriter::fake();
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Entrar', 'domain' => 'acesso-restrito']]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    $dir = $this->projectsPath."/{$slug}";

    expect(File::exists($dir.'/features/auth.feature'))->toBeTrue()
        ->and(File::exists($dir.'/features/acesso-restrito/auth.feature'))->toBeFalse();
});

it('shows the gherkin writer the same redacted events, never the real password', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    GherkinWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, '••••')
            && ! str_contains($prompt->prompt, 'topsecret123')
    );
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
    File::put($dir.'/.env', EnvKey::URL->value."=https://escolhida-pelo-usuario.test\n");

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($dir.'/.env'))
        ->toContain(EnvKey::URL->value.'=https://escolhida-pelo-usuario.test')
        ->not->toContain('sistema.test/login');
});

it('has the setup build its urls from the environment variable, not from the recorded host', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    $env = 'process.env.'.EnvKey::URL->value;

    expect(app(AuthRecordingWriter::class)->instructions())->toContain($env);
    AuthRecordingWriter::assertPrompted(fn ($prompt) => str_contains($prompt->prompt, $env));
});

it('hands the post-login path ready-made, so the agent never remounts it from the base', function () {
    AuthRecordingWriter::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload([
        'baseUrl' => 'https://sistema.test/intranet',
        'events' => [
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'https://sistema.test/intranet/login', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
            ['type' => 'fill', 'timestamp' => 2, 'url' => 'https://sistema.test/intranet/login', 'selectors' => ['dataTestId' => 'user'], 'label' => 'Usuário', 'value' => 'user1', 'inputType' => 'text'],
            ['type' => 'fill', 'timestamp' => 3, 'url' => 'https://sistema.test/intranet/login', 'selectors' => ['dataTestId' => 'pass'], 'label' => 'Senha', 'value' => 'topsecret123', 'inputType' => 'password'],
            ['type' => 'submit', 'timestamp' => 4, 'url' => 'https://sistema.test/intranet/login', 'selectors' => ['dataTestId' => 'entrar'], 'label' => 'Entrar', 'value' => null, 'inputType' => null],
            ['type' => 'navigate', 'timestamp' => 5, 'url' => 'https://sistema.test/intranet/', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
        ],
    ]))->assertOk();

    AuthRecordingWriter::assertPrompted(fn ($prompt) => str_contains($prompt->prompt, 'Caminho pós-login')
        && str_contains($prompt->prompt, ': /intranet/'));
});

it('has the setup check the url by pattern, never by exact equality', function () {
    expect(app(AuthRecordingWriter::class)->instructions())
        ->toContain('nunca repita segmento')
        ->toContain("waitForURL('**/")
        ->toContain('toHaveURL(/')
        ->not->toContain('toHaveURL(`');
});
