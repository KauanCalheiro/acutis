<?php

namespace App\Ai\Agents;

use App\Enums\EnvKey;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\UseSmartestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[UseSmartestModel]
class AuthRecordingWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        $user = EnvKey::USER->value;
        $password = EnvKey::PASSWORD->value;
        $url = EnvKey::URL->value;

        return <<<INSTRUCTIONS
        Você escreve um arquivo de setup de autenticação Playwright em TypeScript a partir dos eventos reais de um login gravado no navegador. O usuário fez o login de verdade, os eventos trazem o seletor que o navegador resolveu em cada clique/preenchimento.

        Regras de conversão dos eventos:
        - Use o helper de setup: import { test as setup, expect } from '@playwright/test'.
        - Prioridade de seletor por evento: dataTestId (page.getByTestId) > id/cssStable (page.locator(...)) > text (finder por texto).
        - Como os seletores já vêm resolvidos do clique/preenchimento real, não há ambiguidade a resolver: use o seletor do evento como está, não invente alternativa.
        - Reproduza a sequência de eventos na ordem: navigate, click, fill, submit, e cada um vira a chamada Playwright correspondente.
        - Envolva cada etapa do login em await setup.step('<título em português>', async () => { ... }), agrupando as ações relacionadas: abrir a tela de login, revelar o formulário (quando houver), preencher as credenciais, submeter, e confirmar que autenticou. Sem isso a execução não tem timeline e não dá pra apontar qual etapa quebrou.

        Identificar os campos de credencial:
        - O evento de fill cujo "value" é literalmente "••••" é o campo de SENHA: preencha com process.env.{$password}, nunca com o valor mascarado.
        - O evento de fill de texto imediatamente anterior ao campo de senha (mesma tela, antes do submit) é o campo de USUÁRIO: preencha com process.env.{$user}, mesmo que o evento traga o valor literal digitado. Nunca escreva esse valor literal no arquivo.
        - Os nomes são exatamente {$user} e {$password}, com o prefixo: process.env.USER é variável do sistema operacional e traria o usuário da máquina.
        - Se houver um clique antes dos campos aparecerem (ex.: revelar "entrar com usuário/senha"), reproduza esse clique antes de preencher.

        URL (regra dura, é onde mais se erra):
        - Nenhum host vai literal no arquivo. A URL base do sistema é a variável de ambiente {$url}: declare `const base = process.env.{$url}` no topo e monte cada URL como template string de base mais o caminho, ex.: await page.goto(`\${base}/login`).
        - {$url} é o único nome que existe para essa variável: nunca process.env.BASE_URL, process.env.APP_URL nem outro nome inventado a partir do rótulo "URL base".
        - As DUAS únicas URLs que podem virar caminho no arquivo são a "URL base" e a "URL pós-login" informadas no prompt. Nunca deduza, adivinhe, encurte ou monte uma URL a partir do nome do sistema, de um label ou de um evento de clique.
        - Com um "Caminho pós-login" informado, ele já vem pronto: use-o literalmente, sem somar ao caminho da URL base e sem repetir segmento que já esteja nela. Confirme o login com await page.waitForURL('**<caminho>') seguido de await expect(page).toHaveURL(<regex do caminho, com as barras escapadas>). Ex.: base https://sistema.test/intranet e caminho /intranet/ viram await page.waitForURL('**/intranet/') e await expect(page).toHaveURL(/\/intranet\//) — nunca '**/intranet/intranet/'.
        - NUNCA assevere URL exata — nem a string inteira, nem template com a base: toda checagem de URL é por padrão que contém o caminho. Query string, id na rota, barra final e redirecionamento fazem a igualdade exata falhar sem o login ter falhado.
        - Quando o prompt disser que nenhuma navegação após o submit foi gravada, NÃO escreva waitForURL nem toHaveURL em lugar nenhum: confirme o login pelo sumiço do campo de senha (await expect(page.locator(<seletor da senha>)).toBeHidden()) ou por um elemento que só existe depois de autenticar.
        - Em qualquer URL montada (o goto da tela de login, inclusive), o caminho é só o que sobra depois da URL base: nunca repita segmento que a base já traz. Base https://sistema.test/intranet e login em /intranet/login viram `\${base}/login`.
        - As URLs dos campos "url" dos eventos são só contexto de onde cada ação aconteceu, não são destino a asseverar.

        Esperas:
        - Nunca use waitForTimeout nem esperas de tempo fixo; sempre espere uma condição.
        - Confie no auto-wait do Playwright para o resto e não adicione esperas redundantes além dessas.
        - Nunca use page.context().storageState({ path }) como checagem de existência nem retorne cedo. Sempre execute o login completo primeiro.
        - Ao final, e só depois de confirmar o login, SEMPRE salve o estado com: await page.context().storageState({ path: process.env.STORAGE_STATE || 'storage-state.json' }).
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
