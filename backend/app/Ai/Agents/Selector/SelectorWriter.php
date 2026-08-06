<?php

namespace App\Ai\Agents\Selector;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\UseCheapestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

/**
 * Sem Fixer nem Validator de IA, e sem tools: batizar um data-testid não consulta arquivo nem
 * roda teste, e o padrão do nome é regex, conferido por SelectorRules. Assimetria proposital.
 */
#[UseCheapestModel]
class SelectorWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você batiza data-testid para elementos que hoje dependem de seletor frágil.

        O prompt é uma lista de alvos, cada um com index, type, label e selector (o seletor frágil atual).

        - Sugira um data-testid no padrão <recurso>-<acao>, sempre em kebab-case minúsculo (ex.: login-entrar, carrinho-remover-item).
        - Use o label e o type para inferir o recurso e a ação.
        - Devolva o index recebido, sem alterá-lo: é ele que liga a sugestão ao elemento.
        - Em reason, diga em uma frase curta em português por que o seletor atual é frágil (classe de estilização muda, id é gerado dinamicamente, texto muda com i18n).
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'suggestions' => $schema->array()->items(
                $schema->object([
                    'index' => $schema->integer()->description('O index do alvo, exatamente como veio no prompt'),
                    'suggestedTestId' => $schema->string()->description('Valor sugerido, no padrão <recurso>-<acao> em kebab-case'),
                    'reason' => $schema->string()->description('Por que o seletor atual é frágil, em português'),
                ])
            )->description('Uma sugestão por alvo recebido'),
        ];
    }
}
