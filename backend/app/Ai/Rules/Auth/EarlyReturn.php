<?php

namespace App\Ai\Rules\Auth;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/**
 * O setup de login não tem saída antecipada: ele existe para logar, e todo `return` no corpo dele
 * é um caminho em que o login não aconteceu.
 *
 * A regra nasceu de uma execução real. Faltando as credenciais no ambiente, o agente escreveu um
 * `if` que salvava a sessão vazia e retornava — e a execução ficou verde sem nunca ter logado.
 * Verde obtido assim é pior que vermelho: todo cenário autenticado depois roda deslogado.
 */
final class EarlyReturn
{
    /**
     * ponytail: qualquer return no arquivo, sem olhar aninhamento. Indentação não separa o return
     * de dentro de um `if` do que fecha um callback, e um setup que loga não precisa de nenhum dos
     * dois — falso positivo aqui custa uma volta do Fixer, falso negativo custa a sessão.
     */
    private const ANY_RETURN = '/\breturn\b/';

    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        if (! $playwright->matches(self::ANY_RETURN)) {
            return [];
        }

        return [new Violation(
            'login-contornado',
            'O setup tem saída antecipada; ele precisa executar o login inteiro sempre, '
                .'porque sessão salva sem login deixa todo cenário autenticado rodando deslogado.',
        )];
    }
}
