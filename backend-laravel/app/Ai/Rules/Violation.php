<?php

namespace App\Ai\Rules;

/**
 * Uma regra quebrada no arquivo que a IA escreveu. O `fixable` separa quem conserta: o Fixer
 * resolve o que é erro do modelo, mas variável sem valor só o usuário preenche, e mandar isso
 * para o loop o faria girar até o limite sem chance de acertar.
 */
final class Violation
{
    public function __construct(
        public readonly string $rule,
        public readonly string $message,
        public readonly bool $fixable = true,
    ) {}
}
