<?php

namespace App\Ai;

use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Roda o spec de verdade no webdriver. Quem chama é a Action, no laço dela: o agente escreve, o
 * runner executa, e o erro volta para o agente na chamada seguinte. O limite de voltas é código,
 * não conversa, que é o que separa isto do laço de ferramentas que vivia dentro do modelo.
 *
 * A instância guarda o que aconteceu, então a Action lê tentativas e resultado depois do loop.
 */
final class SpecRunner
{
    private int $attempts = 0;

    private ?string $ranSpec = null;

    private ?PlaywrightRunResult $last = null;

    /** @param  array<string, string>  $env */
    public function __construct(
        private readonly ?string $baseUrl = null,
        private readonly array $env = [],
    ) {}

    /** O resultado deste spec, executando só se ele mudou desde a última vez. */
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

    /** Devolve null quando o serviço não responde: exceção aqui mataria a geração inteira. */
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
            return null;
        }

        $this->ranSpec = $spec;

        return $this->last = new PlaywrightRunResult(
            passed: (bool) ($result['passed'] ?? false),
            output: (string) ($result['output'] ?? ''),
            storageState: $result['storageState'] ?? null,
            html: $result['html'] ?? null,
        );
    }
}
