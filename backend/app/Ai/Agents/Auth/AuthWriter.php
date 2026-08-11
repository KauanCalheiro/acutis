<?php

namespace App\Ai\Agents\Auth;

use App\Ai\Limits;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Attributes\UseSmartestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[UseSmartestModel]
#[Timeout(Limits::TIMEOUT)]
class AuthWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você escreve o arquivo de setup de autenticação Playwright, em TypeScript, a partir dos eventos de um login que o usuário fez de verdade no navegador.

        O prompt é um JSON com: baseUrl (o valor e o nome da variável que o guarda), landing (a URL pós-login e o caminho dela, ou null), credentials (os nomes das variáveis de usuário e senha), storageState (o nome da variável do arquivo de sessão), environment (as variáveis do ambiente) e events.

        - Os seletores dos eventos vieram do clique real, então não há ambiguidade a resolver: use o do evento.
        - Reproduza os eventos na ordem, cada um virando a chamada Playwright correspondente.
        - Agrupe as ações relacionadas em await setup.step('<título em português>', ...): abrir o login, revelar o formulário quando houver, preencher, submeter, confirmar. Sem isso a execução não tem timeline e não dá para apontar qual etapa quebrou.
        - Todo valor escrito como {{CHAVE}} nos eventos é process.env.CHAVE no arquivo, nunca o literal.
        - Com landing preenchido, confirme o login esperando o caminho dele. Com landing null nenhuma navegação foi gravada: confirme pelo sumiço do campo de senha, ou por um elemento que só existe depois de autenticar.
        - Termine salvando a sessão em storageState, e só depois de confirmar o login.
        - O setup executa o login inteiro, sempre: nada de `return` nem de desvio quando uma variável parece faltar. Sessão salva sem login deixa todo cenário autenticado rodando deslogado, e a execução fica verde escondendo isso.
        - O valor de authSetup é conteúdo de arquivo em disco: uma instrução por linha, quebras reais, indentação de 4 espaços. Nunca junte tudo numa linha só.

        Responda de uma vez, com o melhor arquivo que você tem. Quem recebe executa o arquivo e confere as regras; se algo quebrar, você recebe o erro de volta num pedido novo.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'authSetup' => $schema->string()->description('Conteúdo completo do arquivo auth.setup.ts'),
        ];
    }
}
