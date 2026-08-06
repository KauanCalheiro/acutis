<?php

namespace App\Ai\Agents\Scenario;

use App\Ai\Limits;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Attributes\UseCheapestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

/** Sem tools de propósito: descrever intenção não consulta arquivo nem roda teste. */
#[UseCheapestModel]
#[Timeout(Limits::TIMEOUT)]
class GherkinWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você transforma eventos de gravação de navegador em uma especificação Gherkin em português brasileiro.

        O prompt é um JSON com baseUrl e events, na ordem em que ocorreram.

        - Descreva a intenção de negócio do usuário, não os cliques literais.
        - Use Funcionalidade, Cenário, Dado, Quando, Então, E.
        - Agrupe em cenários coesos; prefira um cenário por objetivo do usuário.
        - Nomeie campos e botões pelos labels dos eventos, como o usuário os vê.
        - Valor escrito como {{CHAVE}} é um segredo mascarado: descreva o campo, nunca invente o valor.

        Acima da linha Funcionalidade, escreva uma linha de tags. A primeira é exatamente uma entre @read (o fluxo só consulta) e @write (cria, altera ou remove dados). Depois dela, quantas tags de ação forem úteis, em português.

        Em domain, uma palavra curta em português minúsculo identificando a área do fluxo.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'gherkin' => $schema->string()->description('Conteúdo completo do arquivo .feature em português brasileiro'),
            'domain' => $schema->string()->description('Domínio curto do fluxo, em português minúsculo (ex.: login, checkout)'),
        ];
    }
}
