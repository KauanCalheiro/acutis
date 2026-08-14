<?php

use function Pest\Laravel\getJson;

it('reports git as available when the machine has the binary', function () {
    getJson('/api/v1/settings/capabilities')
        ->assertOk()
        ->assertJsonPath('git', true);
});

/**
 * O app empacotado leva git só no Windows. Nos demais sistemas ele pode não existir, e a interface
 * usa esta resposta para desabilitar a importação de repositório em vez de deixar o clone estourar.
 */
it('reports git as unavailable when the binary is missing', function () {
    config()->set('acutis.git.bin', '/nao/existe/git');

    getJson('/api/v1/settings/capabilities')
        ->assertOk()
        ->assertJsonPath('git', false);
});
