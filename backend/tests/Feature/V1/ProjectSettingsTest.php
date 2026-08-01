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
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

it('saves the base url the user typed', function () {
    putJson("/api/v1/projects/{$this->slug}/settings", [
        'baseUrl' => 'https://www.univates.br/plataforma',
    ])->assertOk()->assertJsonPath('base_url', 'https://www.univates.br/plataforma');

    expect(File::get($this->dir.'/.env'))->toContain('BASE_URL=https://www.univates.br/plataforma')
        ->and(File::get($this->dir.'/.gitignore'))->toContain('.env');
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

it('preserves env keys the project already had', function () {
    File::put($this->dir.'/.env', "AUTH_USER=733787\nAUTH_PASSWORD=segredo\n");

    putJson("/api/v1/projects/{$this->slug}/settings", ['baseUrl' => 'https://app.test'])->assertOk();

    expect(File::get($this->dir.'/.env'))
        ->toContain('AUTH_USER=733787')
        ->toContain('AUTH_PASSWORD=segredo')
        ->toContain('BASE_URL=https://app.test');
});

it('replaces a base url that was already set', function () {
    putJson("/api/v1/projects/{$this->slug}/settings", ['baseUrl' => 'https://antigo.test'])->assertOk();
    putJson("/api/v1/projects/{$this->slug}/settings", ['baseUrl' => 'https://novo.test'])->assertOk();

    expect(File::get($this->dir.'/.env'))
        ->toContain('BASE_URL=https://novo.test')
        ->not->toContain('antigo.test');
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
