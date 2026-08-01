<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

use function Pest\Laravel\postJson;

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

it('writes the credentials the user typed into .env', function () {
    postJson("/api/v1/projects/{$this->slug}/auth/credentials", [
        'username' => '733787',
        'password' => 'senha-real',
    ])->assertNoContent();

    expect(File::get($this->dir.'/.env'))
        ->toContain('AUTH_USER=733787')
        ->toContain('AUTH_PASSWORD=senha-real')
        ->and(File::get($this->dir.'/.env.example'))
        ->toContain('AUTH_USER=')
        ->not->toContain('senha-real')
        ->and(File::get($this->dir.'/.gitignore'))->toContain('.env');
});

it('preserves env keys the project already had', function () {
    File::put($this->dir.'/.env', "CHECKOUT_CARD=4111111111111111\n");

    postJson("/api/v1/projects/{$this->slug}/auth/credentials", [
        'username' => 'user',
        'password' => 'pass',
    ])->assertNoContent();

    expect(File::get($this->dir.'/.env'))
        ->toContain('CHECKOUT_CARD=4111111111111111')
        ->toContain('AUTH_USER=user');
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
