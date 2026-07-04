<?php

namespace App\Ai;

use ArrayAccess;
use Laravel\Ai\Responses\TextResponse;
use RuntimeException;

class StructuredOutput
{
    public static function field(TextResponse $response, string $key): string
    {
        if ($response instanceof ArrayAccess && isset($response[$key]) && is_string($response[$key])) {
            return $response[$key];
        }

        $decoded = self::decodeLoosely($response->text);

        if (is_array($decoded) && is_string($decoded[$key] ?? null)) {
            return $decoded[$key];
        }

        throw new RuntimeException("O agente de IA não retornou o campo '{$key}' esperado.");
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
