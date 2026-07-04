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

function project(string $name = 'Portal Sistema'): string
{
    postJson('/api/v1/projects/create/template', ['name' => $name])->assertCreated();

    return Str::slug($name);
}

function recordingPayload(array $overrides = []): array
{
    return array_merge([
        'baseUrl' => 'http://127.0.0.1:52346',
        'events' => [
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'http://127.0.0.1:52346/', 'selectors' => null, 'label' => 'Home', 'value' => null],
            ['type' => 'click', 'timestamp' => 2, 'url' => 'http://127.0.0.1:52346/', 'selectors' => ['id' => 'go'], 'label' => 'Ir', 'value' => null],
        ],
    ], $overrides);
}

it('writes the generated spec and feature into the project folder', function () {
    GherkinWriter::fake([['gherkin' => "Funcionalidade: Login do Usuário\n  Cenário: entra"]]);
    PlaywrightWriter::fake([['playwright' => "import { test } from '@playwright/test' // spec gerado"]]);
    Http::fake();
    $slug = project();

    $response = postJson("/api/v1/projects/{$slug}/tests", recordingPayload())
        ->assertOk()
        ->assertJsonPath('gherkin', "Funcionalidade: Login do Usuário\n  Cenário: entra")
        ->assertJsonPath('spec', 'tests/login-do-usuario.spec.ts')
        ->assertJsonPath('feature', 'features/login-do-usuario.feature');

    $dir = $this->projectsPath."/{$slug}";

    expect(File::get($dir.'/tests/login-do-usuario.spec.ts'))->toContain('spec gerado')
        ->and(File::get($dir.'/features/login-do-usuario.feature'))->toContain('Funcionalidade: Login do Usuário');
});

it('returns 404 for a project that does not exist', function () {
    GherkinWriter::fake();
    PlaywrightWriter::fake();
    Http::fake();

    postJson('/api/v1/projects/inexistente/tests', recordingPayload())->assertNotFound();
});

it('avoids overwriting an existing spec of the same name', function () {
    GherkinWriter::fake([
        ['gherkin' => 'Funcionalidade: Login'],
        ['gherkin' => 'Funcionalidade: Login'],
    ]);
    PlaywrightWriter::fake([
        ['playwright' => 'primeiro'],
        ['playwright' => 'segundo'],
    ]);
    Http::fake();
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", recordingPayload())
        ->assertOk()
        ->assertJsonPath('spec', 'tests/login.spec.ts');

    postJson("/api/v1/projects/{$slug}/tests", recordingPayload())
        ->assertOk()
        ->assertJsonPath('spec', 'tests/login-2.spec.ts');

    $dir = $this->projectsPath."/{$slug}";
    expect(File::get($dir.'/tests/login.spec.ts'))->toContain('primeiro')
        ->and(File::get($dir.'/tests/login-2.spec.ts'))->toContain('segundo');
});

it('annotates noticeable pauses so the generated spec waits for loading', function () {
    GherkinWriter::fake([['gherkin' => 'Funcionalidade: Fluxo']]);
    PlaywrightWriter::fake([['playwright' => 'spec']]);
    Http::fake();
    $slug = project();

    $payload = recordingPayload();
    $payload['events'][1]['timestamp'] = $payload['events'][0]['timestamp'] + 4700;

    postJson("/api/v1/projects/{$slug}/tests", $payload)->assertOk();

    PlaywrightWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'Pausas notáveis') && str_contains($prompt->prompt, '4.7s')
    );
});

it('parses structured output even when the model wraps it in code fences', function () {
    GherkinWriter::fake([new StructuredTextResponse([], "```json\n{\"gherkin\": \"Funcionalidade: Cercado\"}\n```", new Usage, new Meta('gemini', 'x'))]);
    PlaywrightWriter::fake([new StructuredTextResponse([], "{\"playwright\": \"spec limpo\"}\n```", new Usage, new Meta('gemini', 'x'))]);
    Http::fake();
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", recordingPayload())
        ->assertOk()
        ->assertJsonPath('gherkin', 'Funcionalidade: Cercado')
        ->assertJsonPath('playwright', 'spec limpo');
});

it('validates the recording payload', function () {
    GherkinWriter::fake();
    PlaywrightWriter::fake();
    Http::fake();
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", ['events' => []])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['baseUrl', 'events']);
});
