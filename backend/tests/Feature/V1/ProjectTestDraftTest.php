<?php

use App\Ai\Agents\Scenario\GherkinWriter;
use App\Ai\Agents\Scenario\ScenarioFixer;
use App\Ai\Agents\Scenario\ScenarioValidator;
use App\Ai\Agents\Scenario\ScenarioWriter;
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

beforeEach(function () {
    fakeCleanValidator(ScenarioValidator::class);
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
            ['type' => 'click', 'timestamp' => 2, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['id' => 'go'], 'label' => 'Ir', 'value' => null],
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
function fakeDraft(?string $playwright = null, array $overrides = [], array $runs = []): void
{
    GherkinWriter::fake([['gherkin' => "Funcionalidade: Login do Usuário\n  Cenário: entra", 'domain' => 'login', ...$overrides]]);
    ScenarioWriter::fake([['playwright' => $playwright ?? draftSpec()]]);

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

it('annotates noticeable pauses so the generated spec waits for loading', function () {
    fakeDraft();
    $slug = draftProject();

    $payload = draftPayload();
    $payload['events'][1]['timestamp'] = $payload['events'][0]['timestamp'] + 4700;

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)->assertOk();

    ScenarioWriter::assertPrompted(
        fn ($prompt) => promptPayload($prompt)['pauses'] === [
            ['beforeEvent' => 1, 'seconds' => 4.7, 'type' => 'click', 'target' => 'Ir'],
        ]
    );
});

it('tells the model which variables the environment declares', function () {
    fakeDraft();
    $slug = draftProject();

    putJson("/api/v1/projects/{$slug}/environments/ambiente", [
        'name' => 'Ambiente',
        'vars' => [['key' => 'CUPOM_VALIDO', 'value' => 'ABC123']],
    ])->assertOk();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())->assertOk();

    ScenarioWriter::assertPrompted(
        fn ($prompt) => collect(promptPayload($prompt)['environment'])
            ->contains(['key' => 'CUPOM_VALIDO', 'value' => 'ABC123'])
    );
});

it('never sends the value of a hidden variable to the model', function () {
    fakeDraft();
    $slug = draftProject();

    putJson("/api/v1/projects/{$slug}/environments/ambiente", [
        'name' => 'Ambiente',
        'vars' => [['key' => EnvKey::PASSWORD->value, 'value' => 'nunca-mande-isso', 'secret' => true]],
    ])->assertOk();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())->assertOk();

    ScenarioWriter::assertPrompted(
        fn ($prompt) => collect(promptPayload($prompt)['environment'])
            ->contains(['key' => EnvKey::PASSWORD->value, 'secret' => true])
            && ! str_contains($prompt->prompt, 'nunca-mande-isso')
    );
});

it('lists a variable the project declared but nobody filled yet', function () {
    fakeDraft();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())->assertOk();

    ScenarioWriter::assertPrompted(
        fn ($prompt) => collect(promptPayload($prompt)['environment'])
            ->contains('key', EnvKey::URL->value)
    );
});

it('names the environment key of the base url instead of leaving the model to coin one', function () {
    fakeDraft();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())->assertOk();

    ScenarioWriter::assertPrompted(
        fn ($prompt) => promptPayload($prompt)['baseUrl'] === [
            'value' => 'http://127.0.0.1:52346',
            'env' => EnvKey::URL->value,
        ]
    );
});

it('sends a spec that repeats a segment the base url already carries back to the fixer', function () {
    $slug = draftProject();

    putJson("/api/v1/projects/{$slug}/environments/ambiente", [
        'name' => 'Ambiente',
        'vars' => [['key' => EnvKey::URL->value, 'value' => 'https://sistema.test/intranet']],
    ])->assertOk();

    $url = EnvKey::URL->value;
    fakeDraft("await page.goto(`\${process.env.{$url}}/intranet/produtos`)");
    ScenarioFixer::fake([['playwright' => "await page.goto(`\${process.env.{$url}}/produtos`)", 'summary' => 'Tirei o segmento repetido.']]);

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload(['baseUrl' => 'https://sistema.test/intranet']))
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('playwright', fn ($v) => ! str_contains($v, '/intranet/produtos'))->etc());

    ScenarioFixer::assertPrompted(
        fn ($prompt) => collect(promptPayload($prompt)['violations'])->contains('rule', 'segmento-repetido')
    );
});

it('sends a spec that asserts the url by exact equality back to the fixer', function () {
    $url = EnvKey::URL->value;
    fakeDraft("await expect(page).toHaveURL(`\${process.env.{$url}}/entrar`)");
    ScenarioFixer::fake([['playwright' => 'await expect(page).toHaveURL(/\/entrar/)', 'summary' => 'Troquei a igualdade exata por padrão.']]);
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())->assertOk();

    ScenarioFixer::assertPrompted(
        fn ($prompt) => collect(promptPayload($prompt)['violations'])->contains('rule', 'url-exata')
    );
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

    fakeDraft($broken);
    ScenarioFixer::fake(function () use (&$calls, $broken): array {
        $calls++;

        return ['playwright' => $broken, 'summary' => 'não resolvi'];
    });
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
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

    fakeDraft("await page.goto(process.env.BASE_AUTH + '/entrar')");
    ScenarioFixer::fake();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJson(fn ($json) => $json->where('warnings', fn ($v) => collect($v)->contains(
            fn (string $w) => str_contains($w, 'BASE_AUTH'),
        ))->etc());

    ScenarioFixer::assertNeverPrompted();
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
    ScenarioWriter::fake([new StructuredTextResponse([], "{\"playwright\": \"spec limpo\"}\n```", new Usage, new Meta('gemini', 'x'))]);
    Http::fake();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJsonPath('gherkin', "@read\nFuncionalidade: Cercado")
        ->assertJsonPath('domain', 'cercado')
        ->assertJsonPath('playwright', 'spec limpo');
});

it('returns the env var the writer named for each marker, ordered by the marker number', function () {
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Login', 'domain' => 'login']]);
    ScenarioWriter::fake([[
        'playwright' => 'process.env.SENHA_UNIVATES',
        'envVars' => [
            ['marker' => 'SENSIVEL_2', 'name' => 'TOKEN_UNIVATES'],
            ['marker' => 'SENSIVEL_1', 'name' => 'SENHA_UNIVATES'],
        ],
    ]]);
    Http::fake();
    $slug = draftProject();

    $payload = draftPayload();
    $payload['events'][] = ['type' => 'fill', 'timestamp' => 3, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['id' => 'senha'], 'label' => 'Senha', 'value' => 'topsecret123', 'sensitive' => true];
    $payload['events'][] = ['type' => 'fill', 'timestamp' => 4, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['id' => 'token'], 'label' => 'Token', 'value' => 'abc123token', 'sensitive' => true];

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)
        ->assertOk()
        ->assertJsonPath('envVars', ['SENHA_UNIVATES', 'TOKEN_UNIVATES']);
});

it('marks a sensitive event value before showing it to the writers', function () {
    fakeDraft();
    $slug = draftProject();

    $payload = draftPayload();
    $payload['events'][] = ['type' => 'fill', 'timestamp' => 3, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['id' => 'senha'], 'label' => 'Senha', 'value' => 'topsecret123', 'sensitive' => true];

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)->assertOk();

    GherkinWriter::assertPrompted(fn ($prompt) => ! str_contains($prompt->prompt, 'topsecret123'));
    ScenarioWriter::assertPrompted(fn ($prompt) => ! str_contains($prompt->prompt, 'topsecret123')
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
