<?php

namespace App\Support\Primitives;

use InvalidArgumentException;
use Stringable;

/**
 * A URL do sistema sob teste. Existe para o host e o caminho serem lidos de um lugar só: eram
 * dois parse_url espalhados, e o caminho da base é justamente o que o spec não pode repetir ao
 * concatenar.
 */
final class Url implements Stringable
{
    public function __construct(public readonly string $value)
    {
        if (filter_var($value, FILTER_VALIDATE_URL) === false) {
            throw new InvalidArgumentException("URL inválida: {$value}");
        }
    }

    public function host(): string
    {
        return (string) parse_url($this->value, PHP_URL_HOST);
    }

    /** O caminho que a URL já traz, sem a barra final. */
    public function path(): string
    {
        return rtrim((string) parse_url($this->value, PHP_URL_PATH), '/');
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
