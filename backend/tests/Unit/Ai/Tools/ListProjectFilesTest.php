<?php

use App\Ai\Tools\ListProjectFiles;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Illuminate\Support\Facades\File;
use Laravel\Ai\Tools\Request;

beforeEach(function () {
    $this->project = sys_get_temp_dir().'/acutis-list-'.uniqid();
    $this->outside = sys_get_temp_dir().'/acutis-list-outside-'.uniqid();

    File::ensureDirectoryExists($this->project.'/tests/produtos');
    File::ensureDirectoryExists($this->project.'/node_modules/playwright');
    File::ensureDirectoryExists($this->project.'/.git');
    File::ensureDirectoryExists($this->outside);
    File::put($this->project.'/playwright.config.ts', '');
    File::put($this->project.'/tests/auth.setup.ts', '');
    File::put($this->project.'/tests/produtos/busca.spec.ts', '');
    File::put($this->project.'/node_modules/playwright/index.js', '');
    File::put($this->project.'/.git/config', '');
    File::put($this->outside.'/segredo.txt', '');
});

afterEach(function () {
    File::deleteDirectory($this->project);
    File::deleteDirectory($this->outside);
});

function listFiles(array $arguments = []): string
{
    return (new ListProjectFiles(test()->project))->handle(new Request($arguments));
}

it('lists the files of the project as paths relative to its root', function () {
    expect(listFiles())->toContain('playwright.config.ts')
        ->and(listFiles())->toContain('tests/auth.setup.ts')
        ->and(listFiles())->toContain('tests/produtos/busca.spec.ts');
});

it('never lists the dependency folder, which would bury the listing', function () {
    expect(listFiles())->not->toContain('node_modules');
});

it('never lists what holds a secret, so the agent is not even tempted', function () {
    File::ensureDirectoryExists($this->project.'/environments');
    File::put($this->project.'/environments/ambiente.json', '{}');
    File::put($this->project.'/.env', 'AUTH_PASSWORD=segredo123');
    File::put($this->project.'/storage-state.json', '{}');

    $listing = listFiles();

    expect($listing)->not->toContain('environments/')
        ->and($listing)->not->toContain('.env')
        ->and($listing)->not->toContain('storage-state.json');
});

it('never lists the git folder', function () {
    expect(listFiles())->not->toContain('.git/config');
});

it('lists only the requested subdirectory when asked for one', function () {
    $listing = listFiles(['directory' => 'tests/produtos']);

    expect($listing)->toContain('busca.spec.ts')
        ->and($listing)->not->toContain('playwright.config.ts');
});

it('refuses a directory that climbs out of the project', function () {
    $listing = listFiles(['directory' => '../'.basename($this->outside)]);

    expect($listing)->not->toContain('segredo.txt')
        ->and($listing)->toContain('fora do projeto');
});

it('says the directory does not exist instead of throwing', function () {
    expect(listFiles(['directory' => 'nao-existe']))->toContain('não encontrado');
});

it('answers the tool contract the ai package expects', function () {
    $tool = new ListProjectFiles($this->project);

    expect((string) $tool->description())->not->toBeEmpty()
        ->and($tool->schema(new JsonSchemaTypeFactory))->toHaveKey('directory');
});
