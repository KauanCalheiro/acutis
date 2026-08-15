<?php

use App\Enums\EnvKey;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    postJson('/api/v1/projects/create/template', ['name' => 'Portal Sistema'])->assertCreated();

    $this->slug = Str::slug('Portal Sistema');
    $this->dir = $this->projectsPath.'/'.$this->slug;
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

it('writes the credentials the user typed into the environment', function () {
    postJson("/api/v1/projects/{$this->slug}/auth/credentials", [
        'username' => '482910',
        'password' => 'senha-real',
    ])->assertNoContent();

    $environment = json_decode(File::get($this->dir.'/environments/ambiente.json'), true);

    expect($environment['vars'])->toContain(
        ['key' => EnvKey::USER->value, 'value' => '482910', 'secret' => false],
        ['key' => EnvKey::PASSWORD->value, 'value' => 'senha-real', 'secret' => true],
    )->and(File::get($this->dir.'/.gitignore'))->toContain('environments');
});

it('preserves the variables the environment already had', function () {
    putJson("/api/v1/projects/{$this->slug}/environments/ambiente", [
        'name' => 'Ambiente',
        'vars' => [['key' => 'CHECKOUT_CARD', 'value' => '4111111111111111']],
    ])->assertOk();

    postJson("/api/v1/projects/{$this->slug}/auth/credentials", [
        'username' => 'user',
        'password' => 'pass',
    ])->assertNoContent();

    $environment = json_decode(File::get($this->dir.'/environments/ambiente.json'), true);

    expect(array_column($environment['vars'], 'key'))->toContain('CHECKOUT_CARD', EnvKey::USER->value, EnvKey::PASSWORD->value);
});

it('validates the credentials', function () {
    postJson("/api/v1/projects/{$this->slug}/auth/credentials", ['username' => ''])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['username', 'password']);
});

it('returns 404 for a project that does not exist', function () {
    postJson('/api/v1/projects/inexistente/auth/credentials', [
        'username' => 'user',
        'password' => 'pass',
    ])->assertNotFound();
});
