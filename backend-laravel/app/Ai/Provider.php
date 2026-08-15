<?php

namespace App\Ai;

/**
 * Qual provedor de IA vale nesta requisição, e se existe algum.
 *
 * O `ApplyAiSettings` já pôs o escolhido na tela sobre o `config('ai.default')`, então aqui basta
 * ler o config: vazio é "sem IA" — ou porque o usuário escolheu assim, ou porque a instalação
 * ainda não configurou nada. Todo passo que chamaria um agente consulta isto antes.
 */
final class Provider
{
    public static function active(): string
    {
        return (string) config('ai.default');
    }

    public static function configured(): bool
    {
        return filled(self::active());
    }
}
