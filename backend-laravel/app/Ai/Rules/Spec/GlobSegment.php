<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/**
 * O glob do waitForURL casa a URL inteira, então só o formato `**segmento**` sobrevive ao que
 * muda sem nada ter falhado. As três formas de errar caem aqui porque são o mesmo erro:
 *
 * - '**\/produtos' ancora no fim e quebra com query string ou segmento a mais;
 * - '**produtos/**' exige a barra final e quebra quando a URL responde /produtos;
 * - '**pedidos/produtos**' amarra o caminho inteiro, e prefixo de locale ou tenant o desloca.
 */
final class GlobSegment
{
    /** Abre com **, um segmento sem barra nem curinga no meio, fecha com **. */
    private const SEGMENT = '/^\*\*[^\/*]+\*\*$/';

    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        $loose = array_values(array_filter(
            $playwright->capture('/waitForURL\s*\(\s*[\'"]([^\'"]*)[\'"]/'),
            fn (string $glob): bool => preg_match(self::SEGMENT, $glob) !== 1,
        ));

        if ($loose === []) {
            return [];
        }

        return [new Violation(
            'url-glob-frouxo',
            "O padrão '{$loose[0]}' não é um segmento cercado; use '**segmento**' com o último "
                .'segmento do caminho, sem barra em nenhuma das pontas.',
        )];
    }
}
