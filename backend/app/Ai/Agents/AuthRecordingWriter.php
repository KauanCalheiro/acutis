<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Model;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[Model('gemini-2.5-flash-lite')]
class AuthRecordingWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você escreve um arquivo de setup de autenticação Playwright em TypeScript a partir dos eventos reais de um login gravado no navegador — o usuário fez o login de verdade, os eventos trazem o seletor que o navegador resolveu em cada clique/preenchimento.

        Regras de conversão dos eventos:
        - Use o helper de setup: import { test as setup, expect } from '@playwright/test'.
        - Prioridade de seletor por evento: dataTestId (page.getByTestId) > id/cssStable (page.locator(...)) > text (finder por texto).
        - Como os seletores já vêm resolvidos do clique/preenchimento real, não há ambiguidade a resolver — use o seletor do evento como está, não invente alternativa.
        - Reproduza a sequência de eventos na ordem: navigate, click, fill, submit — cada um vira a chamada Playwright correspondente.

        Identificar os campos de credencial:
        - O evento de fill cujo "value" é literalmente "••••" é o campo de SENHA — preencha com process.env.AUTH_PASSWORD, nunca com o valor mascarado.
        - O evento de fill de texto imediatamente anterior ao campo de senha (mesma tela, antes do submit) é o campo de USUÁRIO — preencha com process.env.AUTH_USER, mesmo que o evento traga o valor literal digitado. Nunca escreva esse valor literal no arquivo.
        - Se houver um clique antes dos campos aparecerem (ex.: revelar "entrar com usuário/senha"), reproduza esse clique antes de preencher.

        Esperas:
        - Nunca use waitForTimeout nem esperas de tempo fixo; sempre espere uma condição.
        - Após o evento de submit, aguarde sair da página de login com page.waitForURL(url => !url.toString().includes('/login')) ou aguarde o campo de senha desaparecer.
        - Confie no auto-wait do Playwright para o resto — não adicione esperas redundantes além dessas.
        - Nunca use page.context().storageState({ path }) como checagem de existência nem retorne cedo — sempre execute o login completo primeiro.
        - Ao final, e só depois de confirmar o login, SEMPRE salve o estado com: await page.context().storageState({ path: 'storage-state.json' }).
        - Importe apenas de @playwright/test.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'authSetup' => $schema->string()->description('Conteúdo completo do arquivo auth.setup.ts'),
        ];
    }
}
