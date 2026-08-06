<?php

namespace App\Ai\Agents\Lookup;

use Laravel\Ai\Attributes\UseCheapestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\CanActAsTool;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Promptable;
use Laravel\Ai\Providers\Tools\WebSearch;

/**
 * A busca na web mora sozinha aqui, e não junto das outras tools, porque o Gemini recusa o mesmo
 * pedido quando uma tool nativa dele viaja com tools de função nossas: exige
 * `tool_config.include_server_side_tool_invocations`, que o laravel/ai não expõe.
 *
 * Como sub-agente, cada pedido fica legal dos dois lados — quem chama leva só funções, e este leva
 * só a nativa. Os agentes de escrita o recebem como tool, e o pacote faz o embrulho sozinho.
 *
 * Sem saída estruturada de propósito: quem embrulha lê o texto da resposta.
 */
#[UseCheapestModel]
class WebSearcher implements Agent, CanActAsTool, HasTools
{
    use Promptable;

    public function name(): string
    {
        return 'WebSearcher';
    }

    public function description(): string
    {
        return 'Pesquisa na web e responde em texto. Use para API de Playwright que você não conhece '
            .'ou mensagem de erro obscura. Passe a pergunta inteira, porque ele não vê a conversa.';
    }

    public function tools(): iterable
    {
        return [new WebSearch(maxSearches: 2)];
    }

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você pesquisa na web e responde em português, curto e direto, sobre Playwright, TypeScript e APIs web.

        - Responda só o que foi perguntado, no menor número de linhas possível.
        - Prefira a documentação oficial do Playwright.
        - Traga o trecho de código quando ele for a resposta.
        - Não achou, diga que não achou. Resposta inventada custa mais que resposta ausente.
        INSTRUCTIONS;
    }
}
