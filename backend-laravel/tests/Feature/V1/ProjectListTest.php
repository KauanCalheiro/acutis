<?php

use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

use function Pest\Laravel\getJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);
});

afterEach(fn () => File::deleteDirectory($this->projectsPath));

function makeProjectDir(string $name, string $slug, ?string $createdAt = null): void
{
    $dir = config('acutis.projects.path')."/{$slug}";
    File::ensureDirectoryExists($dir);
    File::put($dir.'/acutis.json', json_encode([
        'name' => $name,
        'slug' => $slug,
        'created_at' => $createdAt ?? now()->toIso8601String(),
        'version' => 1,
    ]));
}

it('lists all projects sorted by name', function () {
    makeProjectDir('Beta', 'beta');
    makeProjectDir('Alpha', 'alpha');

    getJson('/api/v1/projects')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.name', 'Alpha')
        ->assertJsonPath('data.1.name', 'Beta')
        ->assertJsonPath('data.0.repository', null)
        ->assertJsonPath('data.0.provider', null);
});

it('returns an empty list when there are no projects', function () {
    getJson('/api/v1/projects')->assertOk()->assertJsonCount(0, 'data');
});

it('ignores directories without an acutis.json manifest', function () {
    makeProjectDir('Real', 'real');
    File::ensureDirectoryExists(config('acutis.projects.path').'/not-a-project');

    getJson('/api/v1/projects')->assertOk()->assertJsonCount(1, 'data');
});

it('filters by name (partial, case-insensitive)', function () {
    makeProjectDir('Checkout Flow', 'checkout-flow');
    makeProjectDir('Login Page', 'login-page');

    getJson('/api/v1/projects?filter[name]=LOGIN')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.slug', 'login-page');
});

it('filters by slug', function () {
    makeProjectDir('Checkout Flow', 'checkout-flow');
    makeProjectDir('Login Page', 'login-page');

    getJson('/api/v1/projects?filter[slug]=checkout')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.slug', 'checkout-flow');
});

it('searches across name and slug', function () {
    makeProjectDir('Payments', 'payments');
    makeProjectDir('User Cart', 'user-cart');
    makeProjectDir('Wishlist', 'cart-wishlist');

    getJson('/api/v1/projects?search=cart')
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

it('sorts by name descending', function () {
    makeProjectDir('Alpha', 'alpha');
    makeProjectDir('Zeta', 'zeta');

    getJson('/api/v1/projects?sort=-name')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Zeta')
        ->assertJsonPath('data.1.name', 'Alpha');
});

it('sorts by created_at descending', function () {
    makeProjectDir('Old', 'old', '2020-01-01T00:00:00+00:00');
    makeProjectDir('New', 'new', '2030-01-01T00:00:00+00:00');

    getJson('/api/v1/projects?sort=-created_at')
        ->assertOk()
        ->assertJsonPath('data.0.slug', 'new')
        ->assertJsonPath('data.1.slug', 'old');
});

it('paginates with page[size] and page[number]', function () {
    foreach (range(1, 5) as $i) {
        makeProjectDir("Project {$i}", "project-{$i}", sprintf('2020-0%d-01T00:00:00+00:00', $i));
    }

    getJson('/api/v1/projects?sort=created_at&page[size]=2&page[number]=2')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.slug', 'project-3')
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('meta.per_page', 2)
        ->assertJsonPath('meta.total', 5);
});

it('does not inherit the remote of an enclosing repository', function () {
    $parent = config('acutis.projects.path');
    File::ensureDirectoryExists($parent);
    (new Process(['git', 'init', '-q'], $parent))->mustRun();
    (new Process(['git', 'remote', 'add', 'origin', 'https://github.com/acme/parent.git'], $parent))->mustRun();

    makeProjectDir('Plain Project', 'plain-project');

    getJson('/api/v1/projects')
        ->assertOk()
        ->assertJsonPath('data.0.repository', null)
        ->assertJsonPath('data.0.provider', null);
});

it('detects the git provider from the remote', function () {
    $dir = config('acutis.projects.path').'/with-remote';
    makeProjectDir('With Remote', 'with-remote');
    (new Process(['git', 'init', '-q'], $dir))->mustRun();
    (new Process(['git', 'remote', 'add', 'origin', 'https://github.com/acme/app.git'], $dir))->mustRun();

    getJson('/api/v1/projects')
        ->assertOk()
        ->assertJsonPath('data.0.repository', 'https://github.com/acme/app.git')
        ->assertJsonPath('data.0.provider', 'github');
});
