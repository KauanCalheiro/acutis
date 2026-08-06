<?php

namespace App\Support;

use App\Enums\EnvKey;
use App\Support\Primitives\Environments;
use App\Support\Recording\Credentials;

/**
 * Os eventos de uma gravação. Duas marcações convivem aqui de propósito: a do fluxo de cenário,
 * que confia na flag `sensitive` posta pelo gravador, e a do login, que reconhece o campo pelo
 * inputType, porque a gravação de auth não marca a senha como sensível.
 *
 * Nenhum valor sensível sai daqui: o que vai para a IA é um marcador. Quando o valor já existe no
 * ambiente, o marcador é o nome da variável; quando não, é um número que o PHP atribuiu e que a
 * IA devolve batizado. Assim o pareamento entre valor e variável nunca depende de posição.
 */
final class Recording
{
    public const MASK = '••••';

    /** Prefixo do marcador de valor sensível que ainda não tem variável. */
    public const SENSITIVE = 'SENSIVEL_';

    /** @param  array<int, array<string, mixed>>  $events */
    private function __construct(private readonly array $events) {}

    /** @param  array<int, array<string, mixed>>  $events */
    public static function make(array $events): self
    {
        return new self($events);
    }

    /**
     * Os eventos gravados. O DOM capturado fica de fora por padrão: é grande e só serve sob
     * demanda, então mandá-lo em todo prompt ou gravá-lo no arquivo de eventos é justamente o
     * que se quer evitar. Quem precisa dele pede.
     *
     * @return array<int, array<string, mixed>>
     */
    public function events(bool $html = false): array
    {
        if ($html) {
            return $this->events;
        }

        return array_map(function (array $event): array {
            unset($event['html']);

            return $event;
        }, $this->events);
    }

    /**
     * Troca o valor de cada evento sensível pelo marcador. Usar antes de mandar eventos gravados
     * pra IA ou gravar em disco.
     *
     * @return array<int, array<string, mixed>>
     */
    public function redacted(?Environments $environments = null): array
    {
        $environments ??= new Environments;
        $position = 0;

        return array_map(function (array $event) use ($environments, &$position): array {
            if (($event['sensitive'] ?? false) !== true) {
                return $event;
            }

            $position++;
            $value = (string) ($event['value'] ?? '');
            $event['value'] = self::marker($environments->keyOf($value) ?? self::SENSITIVE.$position);

            return $event;
        }, $this->events());
    }

    /**
     * O DOM ao redor de cada elemento, na chave do evento que o produziu. Fica fora dos eventos e
     * fora do primeiro prompt: só chega ao modelo se ele pedir, pelo índice.
     *
     * @return array<int, string>
     */
    public function html(): array
    {
        $html = [];

        foreach ($this->events as $index => $event) {
            if (filled($event['html'] ?? null)) {
                $html[$index] = (string) $event['html'];
            }
        }

        return $html;
    }

    /**
     * A senha real chega ao backend (é ela que vai pro .env do projeto), mas não sai daqui: nem
     * para o provedor de IA, nem para o arquivo de eventos em disco. Usuário e senha viram o nome
     * da variável que os guarda, então o agente não precisa deduzir qual campo é qual.
     *
     * @return array<int, array<string, mixed>>
     */
    public function withoutPasswords(): array
    {
        $events = $this->events();
        $password = $this->passwordIndex();

        foreach ($events as $index => $event) {
            if (($event['inputType'] ?? null) === 'password') {
                $events[$index]['value'] = self::marker(EnvKey::PASSWORD->value);
            }
        }

        $user = $password === null ? null : $this->fillBefore($password);

        if ($user !== null) {
            $events[$user]['value'] = self::marker(EnvKey::USER->value);
        }

        return $events;
    }

    /**
     * A URL em que a gravação caiu depois do login: a primeira navegação após o submit (ou após o
     * campo de senha, quando não houve submit) que saiu da URL onde o login foi enviado. É a única
     * URL que pode virar asserção no teste — qualquer outra seria inventada.
     */
    public function landingUrl(): ?string
    {
        $submitIndex = null;

        foreach ($this->events as $index => $event) {
            $type = $event['type'] ?? null;

            if ($type === 'submit' || ($type === 'fill' && ($event['inputType'] ?? null) === 'password')) {
                $submitIndex = $index;
            }
        }

        if ($submitIndex === null) {
            return null;
        }

        $submitUrl = $this->events[$submitIndex]['url'] ?? null;

        foreach (array_slice($this->events, $submitIndex + 1) as $event) {
            $url = $event['url'] ?? null;

            if (($event['type'] ?? null) === 'navigate' && $url && $url !== $submitUrl) {
                return $url;
            }
        }

        return null;
    }

    /**
     * Usuário e senha reais do login gravado, ou null quando não dá para identificá-los. Sem um
     * dos dois não há login executável, então quem chamou precisa pedir ao usuário.
     */
    public function credentials(): ?Credentials
    {
        $passwordIndex = $this->passwordIndex();

        if ($passwordIndex === null) {
            return null;
        }

        $userIndex = $this->fillBefore($passwordIndex);

        $username = $userIndex === null ? null : ($this->events[$userIndex]['value'] ?? null);
        $password = $this->events[$passwordIndex]['value'] ?? null;

        return $username && $password ? new Credentials($username, $password) : null;
    }

    /**
     * O valor real de cada marcador que a IA batizou. O pareamento é pela chave do marcador, que
     * o PHP atribuiu, e não pela ordem em que a IA respondeu.
     *
     * @param  array<string, string>  $names  marcador (SENSIVEL_1) → nome escolhido pela IA
     * @return array<string, string> nome escolhido → valor gravado
     */
    public function envValues(array $names): array
    {
        $sensitive = $this->sensitiveValues();
        $values = [];

        foreach ($names as $marker => $name) {
            if (! is_string($marker) || ! str_starts_with($marker, self::SENSITIVE)) {
                continue;
            }

            $position = (int) substr($marker, strlen(self::SENSITIVE));

            if (! isset($sensitive[$position - 1])) {
                continue;
            }

            $values[$name] = $sensitive[$position - 1];
        }

        return $values;
    }

    /**
     * Alerta quando os nomes que a IA declarou não cobrem os marcadores da gravação: sobrando ou
     * faltando, algum valor sensível fica sem variável e o teste recebe undefined em runtime.
     *
     * @param  array<string, string>  $names
     */
    public function unmatchedEnvWarning(array $names): ?string
    {
        $markers = count($this->sensitiveValues());

        if ($markers === 0 || count($names) === $markers) {
            return null;
        }

        return sprintf(
            'Gravação tem %d valor(es) sensível(is) mas a IA nomeou %d, e algum .env pode ter ficado vazio.',
            $markers,
            count($names),
        );
    }

    private static function marker(string $key): string
    {
        return '{{'.$key.'}}';
    }

    /** @return list<string> */
    private function sensitiveValues(): array
    {
        $values = [];

        foreach ($this->events as $event) {
            if (($event['sensitive'] ?? false) === true) {
                $values[] = (string) ($event['value'] ?? '');
            }
        }

        return $values;
    }

    private function passwordIndex(): ?int
    {
        foreach ($this->events as $index => $event) {
            if (($event['type'] ?? null) === 'fill' && ($event['inputType'] ?? null) === 'password') {
                return $index;
            }
        }

        return null;
    }

    /** O preenchimento anterior ao índice dado, que é onde o usuário do login foi digitado. */
    private function fillBefore(int $index): ?int
    {
        for ($i = $index - 1; $i >= 0; $i--) {
            if (($this->events[$i]['type'] ?? null) === 'fill') {
                return $i;
            }
        }

        return null;
    }
}
