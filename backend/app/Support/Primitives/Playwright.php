<?php

namespace App\Support\Primitives;

use Stringable;

/**
 * O conteúdo de um arquivo Playwright que a IA escreveu, de cenário ou de login. Guarda o que
 * toda regra precisa perguntar sobre ele, para cada regra ficar só com o julgamento e nenhuma
 * repetir o mesmo preg_match.
 */
final class Playwright implements Stringable
{
    public function __construct(public readonly string $value) {}

    /** @return list<string> */
    public function lines(): array
    {
        return explode("\n", $this->value);
    }

    public function has(string $needle): bool
    {
        return str_contains($this->value, $needle);
    }

    public function matches(string $pattern): bool
    {
        return preg_match($pattern, $this->value) === 1;
    }

    /**
     * O primeiro grupo de cada ocorrência do padrão, sem repetir.
     *
     * @return list<string>
     */
    public function capture(string $pattern): array
    {
        preg_match_all($pattern, $this->value, $matches);

        return array_values(array_unique($matches[1]));
    }

    /**
     * Os nomes de variável que o arquivo lê.
     *
     * @return list<string>
     */
    public function envKeys(): array
    {
        return $this->capture('/process\.env\.([A-Z][A-Z0-9_]*)/');
    }

    /**
     * De onde o arquivo importa.
     *
     * @return list<string>
     */
    public function imports(): array
    {
        return $this->capture('/^\s*import\s.+?\sfrom\s+[\'"]([^\'"]+)[\'"]/m');
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
