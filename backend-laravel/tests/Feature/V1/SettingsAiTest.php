<?php

use App\Enums\SettingKey;
use App\Models\AiSetting;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

use function Pest\Laravel\getJson;
use function Pest\Laravel\putJson;

uses(RefreshDatabase::class);

it('offers every provider the package supports, with nothing configured yet', function () {
    getJson('/api/v1/settings/ai')
        ->assertOk()
        ->assertJsonPath('provider', 'gemini')
        ->assertJsonCount(count(config('ai.providers')), 'providers');
});

/** A migration cria a linha de cada provedor, então a tela nunca encontra provedor sem cadastro. */
it('starts with a row for every provider, all of them empty', function () {
    expect(AiSetting::count())->toBe(count(config('ai.providers')))
        ->and(AiSetting::find('ollama')->key)->toBeNull()
        ->and(AiSetting::find('ollama')->url)->toBeNull();
});

it('gives every credential back, so switching provider fills the form with what it has', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])->assertOk();

    putJson('/api/v1/settings/ai', [
        'provider' => 'ollama',
        'url' => 'http://192.168.0.124:11434',
        'modelCheapest' => 'qwen3-coder:30b',
        'modelSmartest' => 'gemma4:31b',
    ])->assertOk();

    getJson('/api/v1/settings/ai')
        ->assertOk()
        ->assertJsonPath('provider', 'ollama')
        ->assertJsonPath('credentials.openai.key', 'sk-secreta')
        ->assertJsonPath('credentials.ollama.key', null)
        ->assertJsonPath('credentials.ollama.url', 'http://192.168.0.124:11434')
        ->assertJsonPath('credentials.ollama.model_cheapest', 'qwen3-coder:30b')
        ->assertJsonPath('credentials.ollama.model_smartest', 'gemma4:31b');
});

/** Trocar de provedor e voltar não pode perder a chave do primeiro. */
it('keeps the credential of a provider that stopped being the active one', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-da-openai'])->assertOk();
    putJson('/api/v1/settings/ai', ['provider' => 'anthropic', 'key' => 'sk-da-anthropic'])->assertOk();

    getJson('/api/v1/settings/ai')
        ->assertOk()
        ->assertJsonPath('credentials.openai.key', 'sk-da-openai')
        ->assertJsonPath('credentials.anthropic.key', 'sk-da-anthropic');
});

it('keeps the key encrypted at rest, so reading the row is not enough', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])->assertOk();

    $raw = DB::table('ai_settings')->where('provider', 'openai')->value('key');

    expect($raw)->not->toContain('sk-secreta')
        ->and(AiSetting::find('openai')->key)->toBe('sk-secreta');
});

/** A chave volta para a tela, então o campo vazio é uma ordem de apagar, não de manter. */
it('erases the key when the field comes back empty', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])->assertOk();

    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => null])->assertOk();

    expect(AiSetting::find('openai')->key)->toBeNull();
});

it('injects the credential of the active provider into the request that follows', function () {
    putJson('/api/v1/settings/ai', [
        'provider' => 'ollama',
        'url' => 'http://192.168.0.124:11434',
        'modelCheapest' => 'qwen3-coder:30b',
        'modelSmartest' => 'gemma4:31b',
    ])->assertOk();

    getJson('/api/v1/settings/ai')->assertOk();

    expect(config('ai.default'))->toBe('ollama')
        ->and(config('ai.providers.ollama.url'))->toBe('http://192.168.0.124:11434')
        ->and(config('ai.providers.ollama.models.text.cheapest'))->toBe('qwen3-coder:30b')
        ->and(config('ai.providers.ollama.models.text.smartest'))->toBe('gemma4:31b');
});

/** Campo em branco não escreve nada, e é assim que o default do provedor continua valendo. */
it('writes no url and no model when the fields were left empty', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'ollama'])->assertOk();

    getJson('/api/v1/settings/ai')->assertOk();

    expect(config('ai.providers.ollama.url'))->toBe('http://localhost:11434')
        ->and(config('ai.providers.ollama.models.text.cheapest'))->toBe('llama3.1:8b')
        ->and(config('ai.providers.ollama.models.text.smartest'))->toBe('llama3.1:8b');
});

it('leaves the config alone when nothing was saved, so the env keeps working', function () {
    getJson('/api/v1/settings/ai')->assertOk();

    expect(config('ai.default'))->toBe('gemini');
});

it('keeps answering before anyone runs the migration, falling back to the environment', function () {
    Schema::drop('ai_settings');
    Schema::drop('settings');

    getJson('/api/v1/projects')->assertOk();

    expect(config('ai.default'))->toBe('gemini');
});

/** A tela mostra este endereço como placeholder: campo vazio deixa de ser adivinhação. */
it('tells the form the default url of each provider that has one', function () {
    getJson('/api/v1/settings/ai')
        ->assertOk()
        ->assertJsonPath('provider_urls.ollama', 'http://localhost:11434')
        ->assertJsonPath('provider_urls.anthropic', 'https://api.anthropic.com/v1');
});

/**
 * O endereço salvo entra no lugar do padrão dentro do config, e o padrão precisa sobreviver a
 * isso: senão a tela anuncia como padrão justamente o endereço que o usuário acabou de gravar.
 */
it('still reports the default url after the saved one took over the config', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'ollama', 'url' => 'http://192.168.0.124:11434'])->assertOk();

    getJson('/api/v1/settings/ai')
        ->assertOk()
        ->assertJsonPath('provider_urls.ollama', 'http://localhost:11434')
        ->assertJsonPath('credentials.ollama.url', 'http://192.168.0.124:11434');
});

it('refuses a provider the package does not have', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'inventado', 'key' => 'sk-secreta'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('provider');
});

it('refuses to switch to a provider that has no key yet', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('key');
});

/** Provedor local não tem chave para pedir, e era a validação que travava o cadastro dele. */
it('saves a provider that asks for no key at all', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'ollama'])
        ->assertOk()
        ->assertJsonPath('provider', 'ollama');

    expect(Setting::get(SettingKey::AI_PROVIDER))->toBe('ollama');
});

/** A tela devolve a chave guardada no campo, então reativar o provedor a reenvia junto. */
it('lets a provider that already has a key become the active one again', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])->assertOk();
    putJson('/api/v1/settings/ai', ['provider' => 'ollama'])->assertOk();

    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])
        ->assertOk()
        ->assertJsonPath('provider', 'openai')
        ->assertJsonPath('credentials.openai.key', 'sk-secreta');
});

it('reports the ai as configured while a provider is active', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'ollama'])->assertOk();

    getJson('/api/v1/settings/ai')
        ->assertOk()
        ->assertJsonPath('configured', true);
});

/** "Sem IA" na tela: é este campo que desabilita, no frontend, todo botão que chamaria um agente. */
it('turns the ai off when the form comes back with no provider', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'ollama'])->assertOk();

    putJson('/api/v1/settings/ai', ['provider' => ''])
        ->assertOk()
        ->assertJsonPath('provider', '')
        ->assertJsonPath('configured', false);

    expect(Setting::get(SettingKey::AI_PROVIDER))->toBe('');
});

/** Desligar não apaga cadastro: religar o provedor não pode pedir a chave de novo. */
it('keeps every credential after the ai is turned off', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])->assertOk();

    putJson('/api/v1/settings/ai', ['provider' => ''])->assertOk();

    getJson('/api/v1/settings/ai')
        ->assertOk()
        ->assertJsonPath('credentials.openai.key', 'sk-secreta');
});

/** Instalação nova, antes de alguém abrir a tela: sem AI_PROVIDER no ambiente, a IA nasce desligada. */
it('reports the ai as off when the environment names no provider either', function () {
    config()->set('ai.default', '');

    getJson('/api/v1/settings/ai')
        ->assertOk()
        ->assertJsonPath('provider', '')
        ->assertJsonPath('configured', false);
});
