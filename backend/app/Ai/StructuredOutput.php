<?php

namespace App\Ai;

use ArrayAccess;
use Laravel\Ai\Responses\TextResponse;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class StructuredOutput
{
    /**
     * O campo esperado da resposta estruturada.
     *
     * Resposta vazia tem uma causa conhecida: o agente gastou os passos do laço ainda chamando
     * ferramentas e nunca chegou a responder. Quem está do outro lado precisa saber disso e o que
     * fazer, então a mensagem diz — erro genérico aqui vira tela de falha sem saída.
     */
    public static function field(TextResponse $response, string $key): string
    {
        if ($response instanceof ArrayAccess && isset($response[$key]) && is_string($response[$key])) {
            return $response[$key];
        }

        $decoded = self::decodeLoosely($response->text);

        if (is_array($decoded) && is_string($decoded[$key] ?? null)) {
            return $decoded[$key];
        }

        throw new UnprocessableEntityHttpException(trim($response->text) === ''
            ? 'A IA não concluiu: ela gastou as tentativas usando as ferramentas e não devolveu o '
                .'arquivo. Tente de novo. Se repetir, o sistema testado pode estar fora do ar ou lento '
                .'demais para o teste terminar.'
            : "A IA respondeu num formato inesperado, sem o campo '{$key}'. Tente de novo.");
    }

    /** @return list<string> */
    public static function fieldArray(TextResponse $response, string $key): array
    {
        if ($response instanceof ArrayAccess && isset($response[$key]) && is_array($response[$key])) {
            return $response[$key];
        }

        $decoded = self::decodeLoosely($response->text);

        if (is_array($decoded) && is_array($decoded[$key] ?? null)) {
            return $decoded[$key];
        }

        return [];
    }

    private static function decodeLoosely(string $text): ?array
    {
        $decoded = json_decode(trim($text), true);

        if (is_array($decoded)) {
            return $decoded;
        }

        $start = strpos($text, '{');
        $end = strrpos($text, '}');

        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        return json_decode(substr($text, $start, $end - $start + 1), true);
    }
}
