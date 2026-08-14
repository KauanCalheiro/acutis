<?php

namespace App\Action\Settings;

use App\Support\Git;
use Lorisleiva\Actions\Concerns\AsAction;

/**
 * O que esta instalação consegue fazer, para a interface desabilitar o que não dá — em vez de
 * oferecer e falhar na hora do clique.
 *
 * A IA tem o próprio endereço (`settings/ai`), que já devolve `configured`; aqui ficam as
 * capacidades que dependem de binário externo, e que o app empacotado resolve de outro jeito em
 * cada sistema.
 */
class ShowCapabilities
{
    use AsAction;

    /** @return array<string, bool> */
    public function handle(): array
    {
        return [
            'git' => Git::available(),
        ];
    }
}
