<?php

use App\Ai\Tools\ReadProjectFile;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Illuminate\Support\Facades\File;
use Laravel\Ai\Tools\Request;

beforeEach(function () {
    $this->project = sys_get_temp_dir().'/acutis-tool-'.uniqid();
    $this->outside = sys_get_temp_dir().'/acutis-outside-'.uniqid();

    File::ensureDirectoryExists($this->project.'/tests');
    File::ensureDirectoryExists($this->outside);
    File::put($this->project.'/playwright.config.ts', 'export default { testDir: "./tests" }');
    File::put($this->project.'/tests/auth.setup.ts', 'import { test as setup } from "@playwright/test"');
    File::put($this->outside.'/segredo.txt', 'nao pode sair daqui');
});

afterEach(function () {
    File::deleteDirectory($this->project);
    File::deleteDirectory($this->outside);
});

function readInProject(string $path, ?string $root = null): string
{
    return (new ReadProjectFile($root ?? test()->project))->handle(new Request(['path' => $path]));
}

it('reads a file that lives in the project', function () {
    expect(readInProject('playwright.config.ts'))->toContain('testDir');
});

it('reads a file in a subdirectory of the project', function () {
    expect(readInProject('tests/auth.setup.ts'))->toContain('@playwright/test');
});

it('refuses a path that climbs out of the project', function () {
    expect(readInProject('../'.basename($this->outside).'/segredo.txt'))
        ->not->toContain('nao pode sair daqui');
});

it('refuses an absolute path outside the project', function () {
    expect(readInProject($this->outside.'/segredo.txt'))->not->toContain('nao pode sair daqui');
});

it('refuses a symlink that points out of the project', function () {
    symlink($this->outside.'/segredo.txt', $this->project.'/atalho.txt');

    expect(readInProject('atalho.txt'))->not->toContain('nao pode sair daqui');
});

it('refuses a path that climbs out and back in through another directory', function () {
    expect(readInProject('tests/../../'.basename($this->outside).'/segredo.txt'))
        ->not->toContain('nao pode sair daqui');
});

it('refuses the environment file, which holds the credentials in plain text', function () {
    File::ensureDirectoryExists($this->project.'/environments');
    File::put($this->project.'/environments/ambiente.json', '{"vars":[{"key":"AUTH_PASSWORD","value":"segredo123"}]}');

    expect(readInProject('environments/ambiente.json'))->not->toContain('segredo123');
});

it('refuses the dotenv, which holds the credentials in plain text', function () {
    File::put($this->project.'/.env', "AUTH_PASSWORD=segredo123\n");

    expect(readInProject('.env'))->not->toContain('segredo123');
});

it('refuses the saved session, which is a credential in another shape', function () {
    File::put($this->project.'/storage-state.json', '{"cookies":[{"name":"sessao","value":"tok-abc"}]}');

    expect(readInProject('storage-state.json'))->not->toContain('tok-abc');
});

it('says why the secret file was refused, so the agent stops trying', function () {
    File::put($this->project.'/.env', "AUTH_PASSWORD=segredo123\n");

    expect(readInProject('.env'))->toContain('segredo');
});

it('says the file is outside the project instead of throwing, so the agent can correct itself', function () {
    expect(readInProject($this->outside.'/segredo.txt'))->toContain('fora do projeto');
});

it('says the file does not exist instead of throwing', function () {
    expect(readInProject('nao-existe.ts'))->toContain('não encontrado');
});

it('answers the tool contract the ai package expects', function () {
    $tool = new ReadProjectFile($this->project);

    expect((string) $tool->description())->not->toBeEmpty()
        ->and($tool->schema(new JsonSchemaTypeFactory))->toHaveKey('path');
});
