<?php

use App\Ai\Agents\Selector\SelectorWriter;
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

    SelectorWriter::fake([[
        'suggestions' => [['index' => 0, 'suggestedTestId' => 'login-entrar', 'reason' => 'Seletor de classe CSS pode mudar com estilização.']],
    ]]);

    postJson('/api/v1/projects/minha-loja/scenarios/login/suggestions')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.suggestedTestId', 'login-entrar');
});

it('fills the event and the current selector from the recording, not from the model', function () {
    File::put($this->dir.'/tests/login.events.json', json_encode([
        ['type' => 'click', 'label' => 'Entrar', 'selectors' => ['cssStable' => '.btn-primary']],
    ]));

    SelectorWriter::fake([[
        'suggestions' => [['index' => 0, 'suggestedTestId' => 'login-entrar', 'reason' => 'classe CSS muda com estilização']],
    ]]);

    postJson('/api/v1/projects/minha-loja/scenarios/login/suggestions')
        ->assertOk()
        ->assertJsonPath('0.currentSelector', '.btn-primary')
        ->assertJsonPath('0.event', 'Entrar');
});

it('does not send events that already have a test id to the ai', function () {
    File::put($this->dir.'/tests/login.events.json', json_encode([
        ['type' => 'click', 'label' => 'Já tem testid', 'selectors' => ['dataTestId' => 'login-entrar']],
        ['type' => 'fill', 'label' => 'Usuário', 'selectors' => ['cssStable' => '#user']],
    ]));

    SelectorWriter::fake([[
        'suggestions' => [['index' => 1, 'suggestedTestId' => 'login-usuario', 'reason' => 'Seletor de id pode não ser estável.']],
    ]]);

    postJson('/api/v1/projects/minha-loja/scenarios/login/suggestions')->assertOk()->assertJsonCount(1);

    SelectorWriter::assertPrompted(fn ($prompt) => ! str_contains($prompt->prompt, 'Já tem testid'));
});

it('drops a suggestion whose test id breaks the naming rule', function () {
    File::put($this->dir.'/tests/login.events.json', json_encode([
        ['type' => 'click', 'label' => 'Entrar', 'selectors' => ['cssStable' => '.btn-primary']],
        ['type' => 'click', 'label' => 'Sair', 'selectors' => ['cssStable' => '.btn-ghost']],
    ]));

    SelectorWriter::fake([[
        'suggestions' => [
            ['index' => 0, 'suggestedTestId' => 'login-entrar', 'reason' => 'ok'],
            ['index' => 1, 'suggestedTestId' => 'loginSair', 'reason' => 'ok'],
        ],
    ]]);

    postJson('/api/v1/projects/minha-loja/scenarios/login/suggestions')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.suggestedTestId', 'login-entrar');
});

it('returns an empty list without calling the ai when every event already has a test id', function () {
    File::put($this->dir.'/tests/login.events.json', json_encode([
        ['type' => 'click', 'label' => 'Entrar', 'selectors' => ['dataTestId' => 'login-entrar']],
    ]));

    postJson('/api/v1/projects/minha-loja/scenarios/login/suggestions')
        ->assertOk()
        ->assertJsonCount(0);

    SelectorWriter::assertNeverPrompted();
});

it('returns 404 for an unknown scenario', function () {
    postJson('/api/v1/projects/minha-loja/scenarios/nao-existe/suggestions')->assertNotFound();
});

it('returns 404 for an unknown project', function () {
    postJson('/api/v1/projects/nao-existe/scenarios/login/suggestions')->assertNotFound();
});
