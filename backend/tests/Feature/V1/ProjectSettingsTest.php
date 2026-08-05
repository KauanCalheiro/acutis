<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    postJson('/api/v1/projects/create/template', ['name' => 'Portal Sistema'])->assertCreated();

    $this->slug = Str::slug('Portal Sistema');
    $this->dir = $this->projectsPath.'/'.$this->slug;
    $this->environment = fn (): array => json_decode(File::get($this->dir.'/environments/ambiente.json'), true);
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

it('saves the base url the user typed', function () {
    putJson("/api/v1/projects/{$this->slug}/settings", [
        'baseUrl' => 'https://www.univates.br/plataforma',
    ])->assertOk()->assertJsonPath('base_url', 'https://www.univates.br/plataforma');

    expect(($this->environment)()['vars'])
        ->toContain(['key' => 'URL', 'value' => 'https://www.univates.br/plataforma', 'secret' => false])
        ->and(File::get($this->dir.'/.gitignore'))->toContain('environments');
});

it('shows the saved base url on the project', function () {
    putJson("/api/v1/projects/{$this->slug}/settings", ['baseUrl' => 'https://app.test'])->assertOk();

    getJson("/api/v1/projects/{$this->slug}")
        ->assertOk()
        ->assertJsonPath('base_url', 'https://app.test');
});

it('has no base url until someone sets one', function () {
    getJson("/api/v1/projects/{$this->slug}")
        ->assertOk()
        ->assertJsonPath('base_url', null);
});

it('preserves the variables the environment already had', function () {
    postJson("/api/v1/projects/{$this->slug}/auth/credentials", [
        'username' => '482910',
        'password' => 'segredo',
    ])->assertNoContent();

    putJson("/api/v1/projects/{$this->slug}/settings", ['baseUrl' => 'https://app.test'])->assertOk();

    expect(($this->environment)()['vars'])->toContain(
        ['key' => 'URL', 'value' => 'https://app.test', 'secret' => false],
        ['key' => 'USER', 'value' => '482910', 'secret' => false],
        ['key' => 'PASSWORD', 'value' => 'segredo', 'secret' => true],
    );
});

it('replaces a base url that was already set', function () {
    putJson("/api/v1/projects/{$this->slug}/settings", ['baseUrl' => 'https://antigo.test'])->assertOk();
    putJson("/api/v1/projects/{$this->slug}/settings", ['baseUrl' => 'https://novo.test'])->assertOk();

    expect(($this->environment)()['vars'])
        ->toContain(['key' => 'URL', 'value' => 'https://novo.test', 'secret' => false])
        ->and(json_encode(($this->environment)()))->not->toContain('antigo.test');
});

it('asks for the base url while the project has none', function () {
    getJson("/api/v1/projects/{$this->slug}")->assertOk()->assertJsonPath('requires_url', true);
});

it('stops asking once the url is filled', function () {
    putJson("/api/v1/projects/{$this->slug}/settings", ['baseUrl' => 'https://app.test'])->assertOk();

    getJson("/api/v1/projects/{$this->slug}")->assertOk()->assertJsonPath('requires_url', false);
});

it('stops asking when the user chooses to leave it blank', function () {
    postJson("/api/v1/projects/{$this->slug}/settings/skip")->assertNoContent();

    getJson("/api/v1/projects/{$this->slug}")
        ->assertOk()
        ->assertJsonPath('requires_url', false)
        ->assertJsonPath('base_url', null);
});

it('returns 404 when skipping the url of a project that does not exist', function () {
    postJson('/api/v1/projects/inexistente/settings/skip')->assertNotFound();
});

it('validates the base url', function () {
    putJson("/api/v1/projects/{$this->slug}/settings", ['baseUrl' => 'nao-e-url'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['baseUrl']);
});

it('returns 404 for a project that does not exist', function () {
    putJson('/api/v1/projects/inexistente/settings', ['baseUrl' => 'https://app.test'])
        ->assertNotFound();
});
