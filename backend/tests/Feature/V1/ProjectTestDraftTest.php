<?php

use App\Ai\Agents\GherkinWriter;
use App\Ai\Agents\PlaywrightWriter;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Ai\Responses\Data\Meta;
use Laravel\Ai\Responses\Data\Usage;
use Laravel\Ai\Responses\StructuredTextResponse;

use function Pest\Laravel\postJson;

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
            ['type' => 'click', 'timestamp' => 2, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['id' => 'go'], 'label' => 'Ir', 'value' => null],
        ],
    ], $overrides);
}

it('returns an editable draft with title, tags, domain and path without writing files', function () {
    GherkinWriter::fake([['gherkin' => "Funcionalidade: Login do Usuário\n  Cenário: entra", 'domain' => 'login']]);
    PlaywrightWriter::fake([['playwright' => "import { test } from '@playwright/test' // spec gerado"]]);
    Http::fake();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJsonPath('title', 'Login do Usuário')
        ->assertJsonPath('tags', ['@read'])
        ->assertJsonPath('domain', 'login')
        ->assertJsonPath('path', 'login-do-usuario')
        ->assertJsonPath('gherkin', "@read\nFuncionalidade: Login do Usuário\n  Cenário: entra")
        ->assertJson(fn ($json) => $json->where('playwright', fn ($v) => str_contains($v, 'spec gerado'))->etc());

    $dir = $this->projectsPath."/{$slug}";
    expect(File::exists($dir.'/tests/login-do-usuario.spec.ts'))->toBeFalse()
        ->and(File::exists($dir.'/features/login-do-usuario.feature'))->toBeFalse();
});

it('suggests a non-colliding path when a spec of the same name exists', function () {
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Login', 'domain' => 'login']]);
    PlaywrightWriter::fake([['playwright' => 'spec']]);
    Http::fake();
    $slug = draftProject();

    File::ensureDirectoryExists($this->projectsPath."/{$slug}/tests");
    File::put($this->projectsPath."/{$slug}/tests/login.spec.ts", 'existente');

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJsonPath('path', 'login-2');
});

it('tags the draft @write when the recording mutates data', function () {
    GherkinWriter::fake([['gherkin' => "Funcionalidade: Cadastro\n  Cenário: cria", 'domain' => 'cadastro']]);
    PlaywrightWriter::fake([['playwright' => 'spec']]);
    Http::fake();
    $slug = draftProject();

    $payload = draftPayload();
    $payload['events'][] = ['type' => 'fill', 'timestamp' => 3, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['id' => 'nome'], 'label' => 'Nome', 'value' => 'x'];

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)
        ->assertOk()
        ->assertJsonPath('tags', ['@write'])
        ->assertJson(fn ($json) => $json->where('gherkin', fn ($v) => str_starts_with($v, '@write'))->etc());
});

it('annotates noticeable pauses so the generated spec waits for loading', function () {
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Fluxo', 'domain' => 'fluxo']]);
    PlaywrightWriter::fake([['playwright' => 'spec']]);
    Http::fake();
    $slug = draftProject();

    $payload = draftPayload();
    $payload['events'][1]['timestamp'] = $payload['events'][0]['timestamp'] + 4700;

    postJson("/api/v1/projects/{$slug}/tests/draft", $payload)->assertOk();

    PlaywrightWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'Pausas notáveis') && str_contains($prompt->prompt, '4.7s')
    );
});

it('parses structured output even when the model wraps it in code fences', function () {
    GherkinWriter::fake([new StructuredTextResponse([], "```json\n{\"gherkin\": \"Funcionalidade: Cercado\", \"domain\": \"cercado\"}\n```", new Usage, new Meta('gemini', 'x'))]);
    PlaywrightWriter::fake([new StructuredTextResponse([], "{\"playwright\": \"spec limpo\"}\n```", new Usage, new Meta('gemini', 'x'))]);
    Http::fake();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", draftPayload())
        ->assertOk()
        ->assertJsonPath('gherkin', "@read\nFuncionalidade: Cercado")
        ->assertJsonPath('domain', 'cercado')
        ->assertJsonPath('playwright', 'spec limpo');
});

it('returns 404 when drafting for a project that does not exist', function () {
    GherkinWriter::fake();
    PlaywrightWriter::fake();
    Http::fake();

    postJson('/api/v1/projects/inexistente/tests/draft', draftPayload())->assertNotFound();
});

it('validates the recording payload before drafting', function () {
    GherkinWriter::fake();
    PlaywrightWriter::fake();
    Http::fake();
    $slug = draftProject();

    postJson("/api/v1/projects/{$slug}/tests/draft", ['events' => []])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['baseUrl', 'events']);
});
