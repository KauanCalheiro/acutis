<?php

namespace App\Ai;

use Closure;
use Laravel\Ai\Responses\TextResponse;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Pede de novo quando a resposta não veio utilizável.
 *
 * As duas causas conhecidas se resolvem do mesmo jeito. Resposta vazia é geração cortada no meio, e
 * a tentativa seguinte começa de novo. Vir num formato sem o campo esperado é variação do modelo, e
 * ele não repete o mesmo desvio duas vezes seguidas com frequência. Em ambos, insistir uma vez
 * custa menos que devolver erro.
 */
final class Attempt
{
    /** Segunda chance, não persistência: se duas voltas não resolveram, o problema é outro. */
    private const TRIES = 2;

    /** @param  Closure(): TextResponse  $prompt */
    public static function answering(Closure $prompt, string $key, int $tries = self::TRIES): TextResponse
    {
        $last = null;

        for ($try = 1; $try <= $tries; $try++) {
            $response = $prompt();

            try {
                StructuredOutput::field($response, $key);

                return $response;
            } catch (UnprocessableEntityHttpException $e) {
                $last = $e;
            }
        }

        throw $last;
    }
}
