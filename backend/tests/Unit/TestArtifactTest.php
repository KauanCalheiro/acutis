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
