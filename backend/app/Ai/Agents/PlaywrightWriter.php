<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Model;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[Model('gemma-3-27b-it')]
class PlaywrightWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você escreve testes Playwright em TypeScript a partir de um cenário Gherkin e dos eventos de gravação de navegador que o originaram.

        Regras:
        - Implemente exatamente o cenário descrito no Gherkin; os eventos são a fonte de seletores e valores.
        - Prioridade de seletor: dataTestId (page.getByTestId) > id (page.locator('#...')) > finder.
        - Estruture com test.describe e test.step espelhando os passos do Gherkin.
        - Inclua expect de URL após cada navegação registrada nos eventos.
        - Valores de senha chegam mascarados como •••• — use process.env ou um placeholder nomeado, nunca o valor mascarado.
        - Importe apenas de @playwright/test.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'playwright' => $schema->string()->description('Conteúdo completo do arquivo .spec.ts'),
        ];
    }
}
