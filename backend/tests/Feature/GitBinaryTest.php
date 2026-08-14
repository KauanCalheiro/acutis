<?php

use App\Support\Git;

it('uses the git from the PATH when the bundle does not ship one', function () {
    expect(config('acutis.git.bin'))->toBe('git');
    expect(acutis()->gitBin)->toBe('git');
});

it('uses the bundled git when one is configured', function () {
    config()->set('acutis.git.bin', '/opt/acutis/git/bin/git');

    expect(acutis()->gitBin)->toBe('/opt/acutis/git/bin/git');
});

it('reports git as available when the binary answers', function () {
    expect(Git::available())->toBeTrue();
});

/**
 * Sem git o acutis segue servindo projeto de template, então a interface precisa saber disto para
 * desabilitar a importação em vez de deixar o clone estourar na cara do usuário.
 */
it('reports git as unavailable when the binary is missing', function () {
    config()->set('acutis.git.bin', '/nao/existe/git');

    expect(Git::available())->toBeFalse();
});
