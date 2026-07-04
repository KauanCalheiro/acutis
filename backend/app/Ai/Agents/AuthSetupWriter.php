<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Model;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[Model('gemini-2.5-flash-lite')]
class AuthSetupWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você escreve um arquivo de setup de autenticação Playwright em TypeScript que faz login em um sistema e salva o estado da sessão.

        Você recebe a URL de login e um snapshot dos elementos interativos da página (inputs, botões) com seus seletores.

        Regras obrigatórias:
        - Use o helper de setup: import { test as setup, expect } from '@playwright/test'.
        - Leia as credenciais SEMPRE de process.env.AUTH_USER e process.env.AUTH_PASSWORD — nunca escreva credenciais literais no arquivo.
        - Navegue até a URL de login, preencha usuário e senha e submeta.
        - Cada elemento do snapshot traz um campo "selector" pronto (ex.: [data-test="username"], #v-0). Use page.locator(selector) desse campo para interagir — não presuma page.getByTestId, que só casa o atributo data-testid e falha em apps que usam data-test/data-cy.
        - Cada elemento do snapshot traz "visible": se os campos de usuário/senha estiverem com "visible": false, a página tem abas/opções de login — primeiro clique no botão visível que revela o formulário de usuário e senha (ex.: "Entrar com usuário/código") e só então preencha.
        - Evite violação de strict mode: quando o texto de um botão puder casar com mais de um elemento (ex.: "Entrar" e "Entrar com..."), use getByRole('button', { name: '...', exact: true }) ou um seletor mais específico.
        - Não invente a URL pós-login. Para confirmar o login, aguarde sair da página de login com page.waitForURL(url => !url.toString().includes('/login')) ou aguarde o campo de senha desaparecer — nunca waitForTimeout nem uma URL fixa adivinhada.
        - Nunca use page.context().storageState({ path }) como checagem de existência nem retorne cedo — esse método sempre grava o arquivo, mesmo sem login. Sempre execute o login completo.
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
