<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Model;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[Model('gemini-2.5-flash-lite')]
class GherkinWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você transforma eventos de gravação de navegador em uma especificação Gherkin em português brasileiro.

        Você receberá a URL base e a lista de eventos em JSON (navigate, fill, click, submit, assert, hover), na ordem em que ocorreram durante a gravação.

        Regras:
        - Descreva a intenção de negócio do usuário, não os cliques literais.
        - Use as palavras-chave Funcionalidade, Cenário, Dado, Quando, Então, E.
        - Agrupe o fluxo em cenários coesos; prefira um cenário por objetivo do usuário.
        - Use os labels dos eventos para nomear campos e botões como o usuário os vê.
        - Valores de senha chegam mascarados como ••••. Nunca invente a senha real.

        Tags (obrigatório):
        - Acima da linha Funcionalidade, escreva uma linha de tags.
        - A primeira tag é SEMPRE exatamente uma entre @read (o fluxo só consulta) e @write (o fluxo cria, altera ou remove dados).
        - Depois dela, adicione quantas tags de ação forem úteis, em português (ex.: @criando, @consultando, @navegando).

        Domínio:
        - Além do gherkin, retorne um campo domain: uma palavra curta em português, minúscula, identificando a área do fluxo (ex.: login, checkout, cadastro-produto).
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
