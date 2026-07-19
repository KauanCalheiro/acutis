<?php

use App\Ai\Agents\SelectorSuggestionWriter;
use Illuminate\Support\Facades\File;

use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    $this->dir = $this->projectsPath.'/minha-loja';
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/acutis.json', json_encode([
        'name' => 'Minha Loja',
        'slug' => 'minha-loja',
        'created_at' => '2026-01-01T00:00:00+00:00',
        'version' => 1,
    ]));
    File::put($this->dir.'/tests/login.spec.ts', "test.describe('Login', () => {})");
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

it('suggests a test id for an event without one', function () {
    File::put($this->dir.'/tests/login.events.json', json_encode([
        ['type' => 'click', 'label' => 'Entrar', 'selectors' => ['cssStable' => '.btn-primary']],
    ]));

    SelectorSuggestionWriter::fake([[
        'suggestions' => [[
            'event' => 'Entrar',
            'currentSelector' => '.btn-primary',
            'suggestedTestId' => 'login-entrar',
            'reason' => 'Seletor de classe CSS pode mudar com estilização.',
        ]],
    ]]);

    postJson('/api/v1/projects/minha-loja/scenarios/login/suggestions')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.suggestedTestId', 'login-entrar');
});

it('does not send events that already have a test id to the ai', function () {
    File::put($this->dir.'/tests/login.events.json', json_encode([
        ['type' => 'click', 'label' => 'Já tem testid', 'selectors' => ['dataTestId' => 'login-entrar']],
        ['type' => 'fill', 'label' => 'Usuário', 'selectors' => ['cssStable' => '#user']],
    ]));

    SelectorSuggestionWriter::fake([[
        'suggestions' => [[
            'event' => 'Usuário',
            'currentSelector' => '#user',
            'suggestedTestId' => 'login-usuario',
            'reason' => 'Seletor de id pode não ser estável.',
        ]],
    ]]);

    postJson('/api/v1/projects/minha-loja/scenarios/login/suggestions')->assertOk()->assertJsonCount(1);

    SelectorSuggestionWriter::assertPrompted(fn ($prompt) => ! str_contains($prompt->prompt, 'Já tem testid'));
});

it('returns an empty list without calling the ai when every event already has a test id', function () {
    File::put($this->dir.'/tests/login.events.json', json_encode([
        ['type' => 'click', 'label' => 'Entrar', 'selectors' => ['dataTestId' => 'login-entrar']],
    ]));

    postJson('/api/v1/projects/minha-loja/scenarios/login/suggestions')
        ->assertOk()
        ->assertJsonCount(0);

    SelectorSuggestionWriter::assertNeverPrompted();
});

it('returns 404 for an unknown scenario', function () {
    postJson('/api/v1/projects/minha-loja/scenarios/nao-existe/suggestions')->assertNotFound();
});

it('returns 404 for an unknown project', function () {
    postJson('/api/v1/projects/nao-existe/scenarios/login/suggestions')->assertNotFound();
});
