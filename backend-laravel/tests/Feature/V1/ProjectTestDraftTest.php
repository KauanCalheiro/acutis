<?php

use App\Ai\Agents\Scenario\GherkinWriter;
use App\Ai\Agents\Scenario\ScenarioFixer;
use App\Enums\EnvKey;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Ai\Responses\Data\Meta;
use Laravel\Ai\Responses\Data\Usage;
use Laravel\Ai\Responses\StructuredTextResponse;

use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function draftProject(string $name = 'Portal Sistema'): string
{
    postJson('/api/v1/projects/create/template', ['name' => $name])->assertCreated();

    return Str::slug($name);
}

function draftPayload(array $overrides = []): array
{
    return array_merge([
        'baseUrl' => 'http://127.0.0.1:52346',
        'events' => [
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'http://127.0.0.1:52346/', 'selectors' => null, 'label' => 'Home', 'value' => null],
            ['type' => 'click', 'timestamp' => 2, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['id' => 'go', 'cssStable' => '#go'], 'label' => 'Ir', 'value' => null],
        ],
    ], $overrides);
}

/** O spec limpo que o writer devolve quando nada precisa de correção. */
function draftSpec(): string
{
    return "import { test, expect } from '@playwright/test'\n"
        ."test.describe('Fluxo', { tag: ['@read'] }, () => {\n"
        ."    test('abre', async ({ page }) => {\n"
        .'        await page.goto(`${process.env.'.EnvKey::URL->value."}/entrar`)\n"
        ."    })\n"
        .'})';
}

/**
 * O caminho felizardo: cada execução passa, a não ser que o teste empurre resultados em $runs para
 * as primeiras voltas do loop.
 *
 * @param  list<array<string, mixed>>  $runs
 */
function fakeDraft(array $overrides = [], array $runs = []): void
{
    GherkinWriter::fake([['gherkin' => "Funcionalidade: Login do Usuário\n  Cenário: entra", 'domain' => 'login', ...$overrides]]);

    $sequence = Http::sequence();

    foreach ($runs as $run) {
        $sequence->push($run);
    }

    Http::fake(['*/runner/spec' => $sequence->whenEmpty(Http::response(['passed' => true, 'output' => 'ok']))]);
}

it('returns an editable draft with title, tags, domain and path without writing files', function () {
    fakeDraft();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJsonPath('title', 'Login do Usuário')
        ->assertJsonPath('tags', ['@read'])
        ->assertJsonPath('domain', 'login')
        ->assertJsonPath('path', 'login-do-usuario')
        ->assertJsonPath('gherkin', "@read\nFuncionalidade: Login do Usuário\n  Cenário: entra")
        ->assertJson(fn ($json) => $json->where('playwright', fn ($v) => str_contains($v, 'test.describe'))->etc());

    $dir = $this->projectsPath."/{$slug}";
    expect(File::exists($dir.'/tests/login-do-usuario.spec.ts'))->toBeFalse()
        ->and(File::exists($dir.'/features/login-do-usuario.feature'))->toBeFalse();
});

it('suggests a non-colliding path when a spec of the same name exists', function () {
    fakeDraft(overrides: ['gherkin' => 'Funcionalidade: Login']);
    $slug = draftProject();

    File::ensureDirectoryExists($this->projectsPath."/{$slug}/tests");
    File::put($this->projectsPath."/{$slug}/tests/login.spec.ts", 'existente');

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJsonPath('path', 'login-2');
});

it('tags the draft @write when the recording mutates data', function () {
    fakeDraft(overrides: ['gherkin' => "Funcionalidade: Cadastro\n  Cenário: cria", 'domain' => 'cadastro']);
    $slug = draftProject();

    $payload = draftPayload();
    $payload['events'][] = ['type' => 'fill', 'timestamp' => 3, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['id' => 'nome'], 'label' => 'Nome', 'value' => 'x'];

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)
        ->assertOk()
        ->assertJsonPath('tags', ['@write'])
        ->assertJson(fn ($json) => $json->where('gherkin', fn ($v) => str_starts_with($v, '@write'))->etc());
});

it('gives the wait a longer deadline where the recording shows the user waited for loading', function () {
    fakeDraft();
    $slug = draftProject();

    $payload = draftPayload();
    $payload['events'][1]['timestamp'] = $payload['events'][0]['timestamp'] + 4700;

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)
        ->assertOk()
        ->assertJson(fn ($json) => $json->where(
            'playwright',
            fn ($v) => str_contains($v, 'toBeVisible({ timeout: 15000 })'),
        )->etc());
});

it('reads a typed value that the environment already holds from the variable', function () {
    fakeDraft();
    $slug = draftProject();

    putJson("/api/v1/projects/{$slug}/environments/ambiente", [
        'name' => 'Ambiente',
        'vars' => [['key' => 'CUPOM_VALIDO', 'value' => 'ABC123']],
    ])->assertOk();

    $payload = draftPayload();
    $payload['events'][] = ['type' => 'fill', 'timestamp' => 3, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['cssStable' => '#cupom'], 'label' => 'Cupom', 'value' => 'ABC123'];

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('playwright', fn ($v) => str_contains($v, 'fill(process.env.CUPOM_VALIDO)')
            && ! str_contains($v, 'ABC123'))->etc());
});

it('never sends the value of a hidden variable to the model', function () {
    fakeDraft();
    $slug = draftProject();

    putJson("/api/v1/projects/{$slug}/environments/ambiente", [
        'name' => 'Ambiente',
        'vars' => [['key' => EnvKey::PASSWORD->value, 'value' => 'nunca-mande-isso', 'secret' => true]],
    ])->assertOk();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())->assertOk();

    GherkinWriter::assertPrompted(fn ($prompt) => ! str_contains($prompt->prompt, 'nunca-mande-isso'));
});

it('builds every url from the environment key of the base url instead of writing the host down', function () {
    fakeDraft();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('playwright', fn ($v) => str_contains($v, 'const base = process.env.'.EnvKey::URL->value)
            && ! str_contains($v, '127.0.0.1'))->etc());
});

it('never repeats a segment that the base url already carries', function () {
    $slug = draftProject();

    putJson("/api/v1/projects/{$slug}/environments/ambiente", [
        'name' => 'Ambiente',
        'vars' => [['key' => EnvKey::URL->value, 'value' => 'https://sistema.test/intranet']],
    ])->assertOk();

    fakeDraft();
    ScenarioFixer::fake();

    $payload = draftPayload(['baseUrl' => 'https://sistema.test/intranet']);
    $payload['events'][0]['url'] = 'https://sistema.test/intranet/produtos';

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('playwright', fn ($v) => str_contains($v, '${base}/produtos')
            && ! str_contains($v, '/intranet/produtos'))->etc());

    ScenarioFixer::assertNeverPrompted();
});

it('asserts the url by pattern of the segment, never by exact equality', function () {
    fakeDraft();
    ScenarioFixer::fake();
    $slug = draftProject();

    $payload = draftPayload();
    $payload['events'][] = [
        'type' => 'assert',
        'timestamp' => 3,
        'url' => 'http://127.0.0.1:52346/entrar',
        'selectors' => ['cssStable' => '#titulo'],
        'label' => 'Entrar',
        'value' => null,
        'assert' => ['assertType' => 'url', 'expectedValue' => 'http://127.0.0.1:52346/entrar'],
    ];

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('playwright', fn ($v) => str_contains($v, 'toHaveURL(/entrar/)'))->etc());

    ScenarioFixer::assertNeverPrompted();
});

it('fills the base url variable the project declared empty with the url of the recording', function () {
    $slug = draftProject();

    putJson("/api/v1/projects/{$slug}/environments/ambiente", [
        'name' => 'Ambiente',
        'vars' => [['key' => EnvKey::URL->value, 'value' => '']],
    ])->assertOk();

    fakeDraft();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('warnings', fn ($v) => collect($v)->isEmpty())->etc());
});

it('never calls the fixer when the generated spec breaks no rule', function () {
    fakeDraft();
    ScenarioFixer::fake();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())->assertOk();

    ScenarioFixer::assertNeverPrompted();
});

it('stops fixing at the limit instead of looping forever', function () {
    $url = EnvKey::URL->value;
    $broken = "await page.waitForTimeout(3000)\nawait page.goto(`\${process.env.{$url}}/entrar`)";

    $calls = 0;

    fakeDraft(runs: [['passed' => false, 'output' => 'erro']]);
    ScenarioFixer::fake(function () use (&$calls, $broken): array {
        $calls++;

        return ['playwright' => $broken, 'summary' => 'não resolvi'];
    });
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload(['executionUrl' => 'https://homolog.sistema.test']))
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('warnings', fn ($v) => collect($v)->contains(
            fn (string $w) => str_contains($w, 'espera-fixa'),
        ))->etc());

    expect($calls)->toBe(2);
});

it('warns the user about a declared key with no value instead of sending it to the fixer', function () {
    $slug = draftProject();

    putJson("/api/v1/projects/{$slug}/environments/ambiente", [
        'name' => 'Ambiente',
        'vars' => [
            ['key' => EnvKey::URL->value, 'value' => 'http://127.0.0.1:52346'],
            ['key' => 'BASE_AUTH', 'value' => ''],
        ],
    ])->assertOk();

    $calls = 0;

    fakeDraft(runs: [['passed' => false, 'output' => 'erro']]);
    ScenarioFixer::fake(function () use (&$calls): array {
        $calls++;

        return ['playwright' => "await page.goto(process.env.BASE_AUTH + '/entrar')", 'summary' => 'usei outra base'];
    });

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload(['executionUrl' => 'http://127.0.0.1:52346']))
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('warnings', fn ($v) => collect($v)->contains(
            fn (string $w) => str_contains($w, 'BASE_AUTH'),
        ))->etc());

    expect($calls)->toBe(1);
});

it('runs the generated spec with the execution url in the variable the spec reads', function () {
    fakeDraft();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload([
        'executionUrl' => 'https://homolog.sistema.test',
    ]))->assertOk();

    Http::assertSent(fn ($request) => str_contains($request->url(), '/runner/spec')
        && $request['env'][EnvKey::URL->value] === 'https://homolog.sistema.test');
});

it('sends a spec that failed the execution back to the fixer, with the error and the broken page', function () {
    fakeDraft(runs: [[
        'passed' => false,
        'output' => "locator('#go') resolved to hidden",
        'html' => '<button data-testid="ir">Ir</button>',
    ]]);
    ScenarioFixer::fake([['playwright' => draftSpec(), 'summary' => 'Troquei o id pelo data-testid.']]);
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload([
        'executionUrl' => 'https://homolog.sistema.test',
    ]))->assertOk();

    ScenarioFixer::assertPrompted(function ($prompt) {
        $payload = promptPayload($prompt);

        return str_contains($payload['run']['error'], "locator('#go') resolved to hidden")
            && str_contains($payload['html'], 'data-testid="ir"');
    });
});

it('never runs anything when the recording says nowhere to run the spec', function () {
    fakeDraft();
    ScenarioFixer::fake();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())->assertOk();

    Http::assertNothingSent();
});

it('stops re-running at the limit when the execution never goes green', function () {
    $calls = 0;

    fakeDraft(runs: [
        ['passed' => false, 'output' => 'erro'],
        ['passed' => false, 'output' => 'erro'],
        ['passed' => false, 'output' => 'erro ainda'],
        ['passed' => false, 'output' => 'nunca deveria rodar uma quarta vez'],
    ]);
    ScenarioFixer::fake(function () use (&$calls): array {
        $calls++;

        return [
            'playwright' => str_replace("test('abre'", "test('abre na tentativa {$calls}'", draftSpec()),
            'summary' => 'não resolvi',
        ];
    });
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload([
        'executionUrl' => 'https://homolog.sistema.test',
    ]))->assertOk();

    Http::assertSentCount(3);
    expect($calls)->toBe(2);
});

it('parses structured output even when the model wraps it in code fences', function () {
    GherkinWriter::fake([new StructuredTextResponse([], "```json\n{\"gherkin\": \"Funcionalidade: Cercado\", \"domain\": \"cercado\"}\n```", new Usage, new Meta('gemini', 'x'))]);
    Http::fake();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJsonPath('gherkin', "@read\nFuncionalidade: Cercado")
        ->assertJsonPath('domain', 'cercado')
        ->assertJson(fn ($json) => $json->where('playwright', fn ($v) => str_contains($v, "test.describe('Cercado'"))->etc());
});

it('names an env var after the field label of each sensitive value, ordered by the marker number', function () {
    fakeDraft();
    $slug = draftProject();

    $payload = draftPayload();
    $payload['events'][] = ['type' => 'fill', 'timestamp' => 3, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['cssStable' => '#senha'], 'label' => 'Senha do portal', 'value' => 'topsecret123', 'sensitive' => true];
    $payload['events'][] = ['type' => 'fill', 'timestamp' => 4, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['cssStable' => '#token'], 'label' => 'Token', 'value' => 'abc123token', 'sensitive' => true];

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)
        ->assertOk()
        ->assertJsonPath('envVars', ['SENHA_DO_PORTAL', 'TOKEN'])
        ->assertJson(fn ($json) => $json->where('playwright', fn ($v) => str_contains($v, 'fill(process.env.SENHA_DO_PORTAL)')
            && str_contains($v, 'fill(process.env.TOKEN)'))->etc());
});

it('keeps a sensitive value out of the model and out of the generated file', function () {
    fakeDraft();
    $slug = draftProject();

    $payload = draftPayload();
    $payload['events'][] = ['type' => 'fill', 'timestamp' => 3, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['cssStable' => '#senha'], 'label' => 'Senha', 'value' => 'topsecret123', 'sensitive' => true];

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('playwright', fn ($v) => ! str_contains($v, 'topsecret123'))->etc());

    GherkinWriter::assertPrompted(fn ($prompt) => ! str_contains($prompt->prompt, 'topsecret123')
        && str_contains($prompt->prompt, '{{SENSIVEL_1}}'));
});

it('returns 404 when drafting for a project that does not exist', function () {
    fakeDraft();

    postJson('/api/v1/projects/inexistente/tests/draft', draftPayload())->assertNotFound();
});

it('validates the recording payload before drafting', function () {
    fakeDraft();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", ['events' => []])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['baseUrl', 'events']);
});

it('marks the scenario as public when it was recorded without a session', function () {
    fakeDraft(overrides: ['gherkin' => "Funcionalidade: Ver a landing\n  Cenário: abre", 'domain' => 'institucional']);
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload(['publico' => true]))
        ->assertOk()
        ->assertJsonPath('tags', ['@read', '@publico'])
        ->assertJson(fn ($json) => $json
            ->where('gherkin', fn ($v) => str_contains($v, '@publico'))
            ->where('playwright', fn ($v) => str_contains($v, '@publico'))
            ->etc());
});

it('leaves the scenario authenticated by default, without the public tag', function () {
    fakeDraft(overrides: ['gherkin' => "Funcionalidade: Ver o painel\n  Cenário: abre", 'domain' => 'painel']);
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJsonPath('tags', ['@read'])
        ->assertJson(fn ($json) => $json
            ->where('gherkin', fn ($v) => ! str_contains($v, '@publico'))
            ->etc());
});

/**
 * Sem provedor ativo o spec continua saindo da gravação, que é quem o escreve desde o emissor.
 * Gherkin e domínio ficam em branco para o usuário preencher na revisão, se quiser.
 */
it('drafts the spec with no gherkin when no ai provider is active', function () {
    config()->set('ai.default', '');
    Http::fake(['*/runner/spec' => Http::response(['passed' => true, 'output' => 'ok'])]);
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJsonPath('gherkin', '')
        ->assertJsonPath('domain', '')
        ->assertJsonPath('tags', [])
        ->assertJson(fn ($json) => $json
            ->where('playwright', fn ($v) => str_contains($v, 'test.describe'))
            ->etc());
});

/** Sem provedor, a tag @publico só tem onde ser carimbada no spec: não há feature para receber. */
it('marks the public scenario on the spec alone when there is no ai', function () {
    config()->set('ai.default', '');
    Http::fake(['*/runner/spec' => Http::response(['passed' => true, 'output' => 'ok'])]);
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload(['publico' => true]))
        ->assertOk()
        ->assertJsonPath('gherkin', '')
        ->assertJson(fn ($json) => $json
            ->where('playwright', fn ($v) => str_contains($v, '@publico'))
            ->etc());
});
