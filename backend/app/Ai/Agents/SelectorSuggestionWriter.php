<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\UseCheapestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[UseCheapestModel]
class SelectorSuggestionWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você recebe uma lista de eventos de gravação de navegador (tipo, label,
        seletor CSS atual e/ou texto do elemento) que NÃO têm um data-testid —
        por isso dependem de um seletor frágil (classe CSS, id gerado, texto).

        Pra cada evento, sugira um valor de data-testid pra adicionar no
        elemento de origem, no padrão <recurso>-<acao>, sempre em kebab-case
        minúsculo (ex.: login-entrar, carrinho-remover-item). Use o label e o
        tipo do evento pra inferir o recurso e a ação.

        Explique o motivo em português, curto e direto: por que o seletor atual
        é frágil (ex.: "classe CSS pode mudar com estilização", "id pode ser
        gerado dinamicamente", "texto pode mudar com i18n").
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'suggestions' => $schema->array()->items(
                $schema->object([
                    'event' => $schema->string()->description('Label/tipo do evento gravado'),
                    'currentSelector' => $schema->string()->description('Seletor atual usado (frágil)'),
                    'suggestedTestId' => $schema->string()->description('Valor sugerido de data-testid, padrão recurso-acao'),
                    'reason' => $schema->string()->description('Motivo em português de por que o seletor atual é frágil'),
                ])
            )->description('Uma sugestão por evento recebido'),
        ];
    }
}
