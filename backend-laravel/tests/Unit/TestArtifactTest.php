<?php

use App\Support\TestArtifact;

/** O modelo às vezes devolve a feature inteira numa linha só, sem nenhuma quebra. */
const GHERKIN_NUMA_LINHA = '@read @cursos Funcionalidade: Consulta de cursos Como um usuário interessado '
    .'Eu quero buscar cursos Cenário: Navegar para a lista Dado que estou na home Quando acesso a seção';

it('reads the title from the feature line', function () {
    expect(TestArtifact::title("Funcionalidade: Login do usuário\n  Cenário: entra"))->toBe('Login do usuário');
});

it('stops the title at the next gherkin keyword when the feature came in a single line', function () {
    expect(TestArtifact::title(GHERKIN_NUMA_LINHA))->toBe('Consulta de cursos');
});

it('cuts a title that would not fit a file name', function () {
    $titulo = TestArtifact::title('Funcionalidade: '.str_repeat('palavra ', 40));

    expect(mb_strlen($titulo))->toBeLessThanOrEqual(TestArtifact::TITLE_LIMIT)
        ->and($titulo)->toEndWith('palavra');
});

it('reads the scenario name and stops it at the next keyword too', function () {
    expect(TestArtifact::scenario(GHERKIN_NUMA_LINHA))->toBe('Navegar para a lista');
});

it('keeps the feature body when the tags share the line with it', function () {
    $stamped = TestArtifact::stampGherkinTags(GHERKIN_NUMA_LINHA, ['@read', '@cursos']);

    expect($stamped)->toContain('Funcionalidade: Consulta de cursos')
        ->and($stamped)->toStartWith('@read @cursos');
});

it('replaces the tag line that carries nothing but tags', function () {
    $stamped = TestArtifact::stampGherkinTags("@antiga\nFuncionalidade: Login", ['@read']);

    expect($stamped)->toBe("@read\nFuncionalidade: Login");
});

/** Sem .feature o título mora no describe: é de lá que o cenário é lido e é lá que ele é regravado. */
it('replaces the title inside the describe of the spec', function () {
    $stamped = TestArtifact::stampPlaywrightTitle(
        "test.describe('Login', { tag: ['@read'] }, () => {})",
        'Entrar no sistema',
    );

    expect($stamped)->toBe("test.describe('Entrar no sistema', { tag: ['@read'] }, () => {})");
});

it('escapes the quote of a title that carries one, so the file stays valid', function () {
    $stamped = TestArtifact::stampPlaywrightTitle("test.describe('Login', () => {})", "Entrar n'algum lugar");

    expect($stamped)->toBe("test.describe('Entrar n\\'algum lugar', () => {})");
});

it('leaves a spec without a describe exactly as it came', function () {
    $spec = "setup('autenticação', async () => {})";

    expect(TestArtifact::stampPlaywrightTitle($spec, 'Outro'))->toBe($spec);
});
