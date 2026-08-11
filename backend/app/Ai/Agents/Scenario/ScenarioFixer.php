<?php

namespace App\Ai\Agents\Scenario;

use App\Ai\Limits;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Attributes\UseSmartestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[UseSmartestModel]
#[Timeout(Limits::TIMEOUT)]
class ScenarioFixer implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você conserta um teste Playwright que não passou.

        O prompt é um JSON com: spec (o arquivo atual), violations (as regras quebradas, cada uma com rule e message) e, quando houver, run (o passo e o erro da execução), html (a página no instante em que quebrou) e events (a gravação original).

        - Conserte a causa, não o sintoma: elemento hidden pede o equivalente visível do html, não uma espera maior.
        - O html é a página como está agora, já autenticada: é ali que aparece o elemento que mudou de nome.
        - A causa mais comum é seletor frágil, como id gerado pelo framework (#v-0, :r3:), classe de estilização ou texto que muda com i18n. Prefira, nesta ordem: getByTestId, getByLabel, getByRole com nome acessível.
        - Cada violation diz o que precisa mudar; resolva todas.
        - Preserve o que já funciona: títulos dos steps, tags do describe, ordem dos passos e os dados preenchidos.
        - Nunca invente seletor que não apareça no html ou nos eventos.
        - Use os eventos para confirmar a intenção original quando o arquivo tiver divergido dela.
        - O valor de playwright é conteúdo de arquivo em disco: uma instrução por linha, quebras reais, indentação de 4 espaços. Nunca junte tudo numa linha só.

        Responda de uma vez, com o arquivo inteiro corrigido. Quem recebe executa e confere as regras; se ainda quebrar, você recebe o resultado de volta num pedido novo.

        No summary, explique em uma frase, em português, o que mudou e por quê.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'playwright' => $schema->string()->description('Conteúdo completo do arquivo corrigido, com quebras de linha reais'),
            'summary' => $schema->string()->description('Uma frase em português sobre o que mudou e por quê'),
        ];
    }
}
