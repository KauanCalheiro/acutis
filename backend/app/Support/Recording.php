<?php

namespace App\Support;

use App\Support\Recording\Credentials;

/**
 * Os eventos de uma gravação. Duas máscaras convivem aqui de propósito: a do fluxo de cenário,
 * que confia na flag `sensitive` posta pelo gravador, e a do login, que reconhece o campo pelo
 * inputType — a gravação de auth não marca a senha como sensível.
 */
final class Recording
{
    public const MASK = '••••';

    /** @param  array<int, array<string, mixed>>  $events */
    private function __construct(private readonly array $events) {}

    /** @param  array<int, array<string, mixed>>  $events */
    public static function make(array $events): self
    {
        return new self($events);
    }

    /**
     * Troca o valor de eventos marcados como sensíveis por '••••' — usar antes de mandar eventos
     * gravados pra IA ou gravar em disco.
     *
     * @return array<int, array<string, mixed>>
     */
    public function redacted(): array
    {
        return $this->mask(fn (array $event): bool => ($event['sensitive'] ?? false) === true);
    }

    /**
     * A senha real chega ao backend (é ela que vai pro .env do projeto), mas não deve sair daqui:
     * nem para o provedor de IA, nem para o arquivo de eventos em disco. O evento continua
     * identificável pelo inputType, então quem lê ainda reconhece o campo de senha normalmente.
     *
     * @return array<int, array<string, mixed>>
     */
    public function withoutPasswords(): array
    {
        return $this->mask(fn (array $event): bool => ($event['inputType'] ?? null) === 'password');
    }

    /** Usuário e senha reais do login gravado, ou null quando não dá para identificá-los. */
    public function credentials(): ?Credentials
    {
        $passwordIndex = null;

        foreach ($this->events as $index => $event) {
            if (($event['type'] ?? null) === 'fill' && ($event['inputType'] ?? null) === 'password') {
                $passwordIndex = $index;
                break;
            }
        }

        if ($passwordIndex === null) {
            return null;
        }

        $username = null;

        for ($i = $passwordIndex - 1; $i >= 0; $i--) {
            if (($this->events[$i]['type'] ?? null) === 'fill') {
                $username = $this->events[$i]['value'] ?? null;
                break;
            }
        }

        $password = $this->events[$passwordIndex]['value'] ?? null;

        // Sem um dos dois não há login executável — quem chamou precisa pedir ao usuário.
        return $username && $password ? new Credentials($username, $password) : null;
    }

    /**
     * Casa nomes de env var (na ordem em que a IA os declarou) com o valor real dos eventos
     * sensíveis (na mesma ordem em que apareceram na gravação).
     *
     * @param  list<string>  $envVars
     * @return array<string, string>
     */
    public function envValues(array $envVars): array
    {
        if ($envVars === []) {
            return [];
        }

        $sensitiveValues = array_values(array_filter(
            array_map(
                fn (array $event) => ($event['sensitive'] ?? false) === true ? ($event['value'] ?? '') : null,
                $this->events,
            ),
            fn ($value) => $value !== null,
        ));

        $result = [];

        foreach ($envVars as $index => $name) {
            $result[$name] = $sensitiveValues[$index] ?? '';
        }

        return $result;
    }

    /**
     * Alerta quando a quantidade de env vars declaradas pela IA não bate com a quantidade de
     * valores sensíveis da gravação — sinal de que algum .env ficaria vazio ou algum valor
     * sensível seria descartado sem aviso.
     *
     * @param  list<string>  $envVars
     */
    public function unmatchedEnvWarning(array $envVars): ?string
    {
        $sensitiveCount = count(array_filter(
            $this->events,
            fn (array $event): bool => ($event['sensitive'] ?? false) === true,
        ));

        if ($sensitiveCount === 0 || count($envVars) === $sensitiveCount) {
            return null;
        }

        return sprintf(
            'Gravação tem %d valor(es) sensível(is) mas a IA declarou %d env var(s) — algum .env pode ter ficado vazio ou sem escrever.',
            $sensitiveCount,
            count($envVars),
        );
    }

    /**
     * @param  callable(array<string, mixed>): bool  $sensitive
     * @return array<int, array<string, mixed>>
     */
    private function mask(callable $sensitive): array
    {
        return array_map(function (array $event) use ($sensitive): array {
            if ($sensitive($event)) {
                $event['value'] = self::MASK;
            }

            return $event;
        }, $this->events);
    }
}
