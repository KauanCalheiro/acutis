<?php

namespace App\Ai\Tools;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Throwable;

/**
 * Roda o spec de verdade no webdriver. É a tool que fecha o ciclo dentro do próprio agente: ele
 * escreve, executa, lê o erro no mesmo contexto em que escreveu e reescreve, sem precisar de uma
 * segunda chamada orquestrada de fora.
 *
 * A instância guarda o que aconteceu, então a Action lê tentativas e resultado depois do prompt.
 */
final class RunSpec implements Tool
{
    private int $attempts = 0;

    private ?string $ranSpec = null;

    private ?PlaywrightRunResult $last = null;

    /** @param  array<string, string>  $env */
    public function __construct(
        private readonly ?string $baseUrl = null,
        private readonly array $env = [],
    ) {}

    public function description(): string
    {
        return 'Executa um teste Playwright e devolve se ele passou, com a saída da execução quando falha. '
            .'Use para conferir o que você escreveu antes de responder.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'spec' => $schema->string()->description('Conteúdo completo do arquivo a executar.')->required(),
        ];
    }

    public function handle(Request $request): string
    {
        $result = $this->run((string) $request['spec']);

        if ($result === null) {
            return 'Não foi possível executar: o serviço de execução não respondeu.';
        }

        return $result->passed
            ? 'O teste passou.'
            : "O teste falhou.\n".$result->output;
    }

    /**
     * O resultado deste spec, executando só se ele mudou desde a última vez. É o que permite a
     * Action confirmar o arquivo sem repetir a execução que o agente já fez.
     */
    public function ensure(string $spec): ?PlaywrightRunResult
    {
        if ($this->ranSpec === $spec && $this->last !== null) {
            return $this->last;
        }

        return $this->run($spec);
    }

    public function attempts(): int
    {
        return $this->attempts;
    }

    public function last(): ?PlaywrightRunResult
    {
        return $this->last;
    }

    private function run(string $spec): ?PlaywrightRunResult
    {
        $this->attempts++;

        try {
            $result = Http::timeout(120)
                ->post(acutis()->webdriverUrl.'/runner/spec', [
                    'spec' => $spec,
                    'baseUrl' => $this->baseUrl,
                    'env' => $this->env,
                ])
                ->throw()
                ->json();
        } catch (Throwable) {
            // O agente precisa de uma resposta para seguir; exceção aqui mataria o loop inteiro.
            return null;
        }

        $this->ranSpec = $spec;

        return $this->last = new PlaywrightRunResult(
            passed: (bool) ($result['passed'] ?? false),
            output: (string) ($result['output'] ?? ''),
            storageState: $result['storageState'] ?? null,
        );
    }
}
