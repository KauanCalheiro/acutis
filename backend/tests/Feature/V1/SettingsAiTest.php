<?php

use App\Enums\SettingKey;
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
        ->assertJsonPath('key_set', false)
        ->assertJsonCount(count(config('ai.providers')), 'providers');
});

it('saves the provider with its key and never gives the key back', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])
        ->assertOk()
        ->assertJsonPath('provider', 'openai')
        ->assertJsonPath('key_set', true);

    $response = getJson('/api/v1/settings/ai')->assertOk();

    expect($response->json())->not->toContain('sk-secreta')
        ->and($response->json('key_set'))->toBeTrue();
});

it('keeps the key encrypted at rest, so reading the row is not enough', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])->assertOk();

    $raw = DB::table('settings')->where('key', SettingKey::AI_KEY->value)->value('value');

    expect($raw)->not->toContain('sk-secreta')
        ->and(Setting::find(SettingKey::AI_KEY->value)->value)->toBe('sk-secreta');
});

it('injects the saved provider and key into the request that follows', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])->assertOk();

    getJson('/api/v1/settings/ai')->assertOk();

    expect(config('ai.default'))->toBe('openai')
        ->and(config('ai.providers.openai.key'))->toBe('sk-secreta');
});

it('leaves the config alone when nothing was saved, so the env keeps working', function () {
    getJson('/api/v1/settings/ai')->assertOk();

    expect(config('ai.default'))->toBe('gemini');
});

it('keeps answering before anyone runs the migration, falling back to the environment', function () {
    Schema::drop('settings');

    getJson('/api/v1/projects')->assertOk();

    expect(config('ai.default'))->toBe('gemini');
});

it('refuses a provider the package does not have', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'inventado', 'key' => 'sk-secreta'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('provider');
});

it('refuses to change provider without the key of the new one', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])->assertOk();

    putJson('/api/v1/settings/ai', ['provider' => 'gemini'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('key');
});

it('keeps the key when saving the same provider without typing it again', function () {
    putJson('/api/v1/settings/ai', ['provider' => 'openai', 'key' => 'sk-secreta'])->assertOk();

    putJson('/api/v1/settings/ai', ['provider' => 'openai'])
        ->assertOk()
        ->assertJsonPath('key_set', true);

    expect(Setting::find(SettingKey::AI_KEY->value)->value)->toBe('sk-secreta');
});
