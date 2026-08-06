<?php

use App\Ai\Agents\Auth\AuthFixer;
use App\Ai\Agents\Auth\AuthValidator;
use App\Ai\Agents\Auth\AuthWriter;
use App\Ai\Agents\Scenario\GherkinWriter;
use App\Enums\EnvKey;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    GherkinWriter::fake([['gherkin' => "@write\nFuncionalidade: Entrar no sistema", 'domain' => 'login']]);

    fakeCleanValidator(AuthValidator::class);
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

/** O setup limpo que o writer devolve quando nada precisa de correção. */
function authSetup(): string
{
    $url = EnvKey::URL->value;

    return "import { test as setup, expect } from '@playwright/test'\n"
        ."const base = process.env.{$url}\n"
        ."setup('autentica', async ({ page }) => {\n"
        ."    await page.goto(base)\n"
        ."    await page.getByTestId('pass').fill(process.env.".EnvKey::PASSWORD->value.")\n"
        ."    await expect(page.getByTestId('pass')).toBeHidden()\n"
        .'    await page.context().storageState({ path: process.env.'.EnvKey::STORAGE_STATE->value." || 'storage-state.json' })\n"
        .'})';
}

it('writes the generated auth setup from the recording into the project folder', function () {
    AuthWriter::fake([['authSetup' => str_replace("setup('autentica'", "setup('login gravado'", authSetup())]]);
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
    AuthWriter::fake([['authSetup' => authSetup()]]);
    Http::fake(['*/runner/spec' => Http::response(['passed' => true, 'output' => 'ok'])]);
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";
    $config = File::get($dir.'/playwright.config.ts');

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload([
        'executionUrl' => 'https://homolog.sistema.test',
    ]))->assertOk();

    expect(File::get($dir.'/.env'))->not->toContain('URL')
        ->and(File::get($dir.'/playwright.config.ts'))->toBe($config);
});

it('never executes anything when the recording says nowhere to run it', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    Http::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    Http::assertNothingSent();
});

it('runs the setup before answering when the recording says where to run it', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    Http::fake(['*/runner/spec' => Http::response(['passed' => true, 'output' => 'ok'])]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload([
        'executionUrl' => 'https://homolog.sistema.test',
    ]))->assertOk();

    Http::assertSent(fn ($request) => str_contains($request->url(), '/runner/spec')
        && $request['env'][EnvKey::URL->value] === 'https://homolog.sistema.test');
});

it('shows the recorded events to the writer with the credentials marked, never the real password', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthWriter::assertPrompted(function ($prompt) {
        $payload = promptPayload($prompt);

        return array_column($payload['events'], 'value') === [null, '{{'.EnvKey::USER->value.'}}', '{{'.EnvKey::PASSWORD->value.'}}', null]
            && ! str_contains($prompt->prompt, 'topsecret123')
            && str_contains($prompt->prompt, 'dataTestId');
    });
});

it('names the credential variables instead of leaving the writer to spot the fields', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthWriter::assertPrompted(fn ($prompt) => promptPayload($prompt)['credentials'] === [
        'user' => EnvKey::USER->value,
        'password' => EnvKey::PASSWORD->value,
    ]);
});

it('tells the writer which url the login landed on, so it never invents one', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload([
        'events' => array_merge(recordPayload()['events'], [
            ['type' => 'navigate', 'timestamp' => 5, 'url' => 'https://sistema.test/inicio', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
            ['type' => 'navigate', 'timestamp' => 6, 'url' => 'https://sistema.test/inicio/pedidos', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
        ]),
    ]))->assertOk();

    AuthWriter::assertPrompted(
        fn ($prompt) => promptPayload($prompt)['landing']['url'] === 'https://sistema.test/inicio'
    );
});

it('tells the writer there is no landing url when the recording never left the login', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthWriter::assertPrompted(fn ($prompt) => promptPayload($prompt)['landing'] === null);
});

it('keeps the real password out of the response body', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    $response = postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect($response->getContent())->not->toContain('topsecret123');
});

it('writes the recorded credentials into the environment', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
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
    AuthWriter::fake([['authSetup' => authSetup()]]);
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
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";
    File::put($dir.'/playwright.config.ts', '// configuração escrita pelo usuário');

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($dir.'/playwright.config.ts'))->toBe('// configuração escrita pelo usuário');
});

it('teaches an old config about the auth setup, keeping what the user wrote', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
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
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";
    $meu = "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ projects: [{ name: 'meu' }] })\n";
    File::put($dir.'/playwright.config.ts', $meu);

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($dir.'/playwright.config.ts'))->toBe($meu);
});

it('asks for credentials when it cannot extract them from the recording', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
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

it('persists the recorded events so the fixer can read them later, with the credentials marked', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    $events = json_decode(File::get($this->projectsPath."/{$slug}/tests/auth.events.json"), true);

    expect($events)->toHaveCount(4)
        ->and($events[2]['value'])->toBe('{{'.EnvKey::PASSWORD->value.'}}')
        ->and($events[1]['value'])->toBe('{{'.EnvKey::USER->value.'}}');
});

it('writes the captured html of the login to its own file, out of the events', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    $events = recordPayload()['events'];
    $events[1]['html'] = '<form><input name="user"><input name="pass"></form>';

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload(['events' => $events]))->assertOk();

    $dir = $this->projectsPath."/{$slug}/tests";

    expect(File::get($dir.'/auth.events.json'))->not->toContain('<form')
        ->and(json_decode(File::get($dir.'/auth.dom.json'), true))
        ->toBe([1 => '<form><input name="user"><input name="pass"></form>']);
});

it('writes the gherkin of the login next to the setup', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($this->projectsPath."/{$slug}/features/auth.feature"))
        ->toContain('Funcionalidade: Entrar no sistema');
});

it('keeps the auth feature in its fixed path, whatever domain the writer suggests', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Entrar', 'domain' => 'acesso-restrito']]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    $dir = $this->projectsPath."/{$slug}";

    expect(File::exists($dir.'/features/auth.feature'))->toBeTrue()
        ->and(File::exists($dir.'/features/acesso-restrito/auth.feature'))->toBeFalse();
});

it('shows the gherkin writer the same marked events, never the real password', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    GherkinWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, '{{'.EnvKey::PASSWORD->value.'}}')
            && ! str_contains($prompt->prompt, 'topsecret123')
    );
});

it('returns 404 for a project that does not exist', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);

    postJson('/api/v1/projects/inexistente/auth/record', recordPayload())->assertNotFound();
});

it('validates the recording payload', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", ['events' => []])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['baseUrl', 'events']);
});

it('leaves a base url the user configured untouched', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();
    $dir = $this->projectsPath."/{$slug}";
    File::put($dir.'/.env', EnvKey::URL->value."=https://escolhida-pelo-usuario.test\n");

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    expect(File::get($dir.'/.env'))
        ->toContain(EnvKey::URL->value.'=https://escolhida-pelo-usuario.test')
        ->not->toContain('sistema.test/login');
});

it('names the environment key of the base url instead of leaving the writer to coin one', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthWriter::assertPrompted(fn ($prompt) => promptPayload($prompt)['baseUrl'] === [
        'value' => 'https://sistema.test/login',
        'env' => EnvKey::URL->value,
    ]);
});

it('hands the post-login path ready-made, so the agent never remounts it from the base', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
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

    AuthWriter::assertPrompted(fn ($prompt) => promptPayload($prompt)['landing']['path'] === '/intranet/');
});

it('sends a setup that never saves the session back to the fixer', function () {
    AuthWriter::fake([['authSetup' => "import { test as setup } from '@playwright/test'\nsetup('autentica', async () => {})"]]);
    AuthFixer::fake([['playwright' => authSetup(), 'summary' => 'Passei a salvar o storage state.']]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthFixer::assertPrompted(
        fn ($prompt) => collect(promptPayload($prompt)['violations'])->contains('rule', 'storage-state-ausente')
    );
});

it('sends a setup that checks the url by exact equality back to the fixer', function () {
    $broken = str_replace(
        "await expect(page.getByTestId('pass')).toBeHidden()",
        'await expect(page).toHaveURL(`${base}/inicio`)',
        authSetup(),
    );

    AuthWriter::fake([['authSetup' => $broken]]);
    AuthFixer::fake([['playwright' => authSetup(), 'summary' => 'Troquei a igualdade exata por padrão.']]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthFixer::assertPrompted(
        fn ($prompt) => collect(promptPayload($prompt)['violations'])->contains('rule', 'url-exata')
    );
});

it('never calls the fixer when the generated setup breaks no rule', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    AuthFixer::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthFixer::assertNeverPrompted();
});

it('counts the credentials this very recording carries as filled, so the setup is not flagged', function () {
    AuthWriter::fake([['authSetup' => authSetup()]]);
    AuthFixer::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('warnings', fn ($v) => blank($v))->etc());
});
