<?php

namespace App\Support\Primitives;

use App\Data\V1\Project\EnvironmentVarData;
use InvalidArgumentException;

/**
 * As variáveis do ambiente ativo. Chega às regras, às tools e aos payloads como tipo, e não como
 * array solto, porque é ela que decide se uma chave existe, se tem valor e se o valor pode sair
 * daqui — três perguntas que antes cada chamador respondia do seu jeito.
 */
final class Environments
{
    /** @param  list<EnvironmentVarData>  $vars */
    public function __construct(public readonly array $vars = [])
    {
        $keys = array_column($vars, 'key');

        foreach ($keys as $key) {
            if (preg_match('/^'.EnvironmentVarData::KEY.'$/', $key) !== 1) {
                throw new InvalidArgumentException("Nome de variável inválido: {$key}");
            }
        }

        if (count($keys) !== count(array_unique($keys))) {
            throw new InvalidArgumentException('O ambiente declara a mesma variável duas vezes.');
        }
    }

    public function get(string $key): ?EnvironmentVarData
    {
        return EnvironmentVarData::keyed($this->vars, $key);
    }

    public function has(string $key): bool
    {
        return $this->get($key) !== null;
    }

    /**
     * A chave que já guarda esse valor, se alguma guardar. É por aqui que um valor gravado vira
     * marcador sem o modelo precisar reconhecê-lo, inclusive quando é segredo.
     */
    public function keyOf(string $value): ?string
    {
        if (blank($value)) {
            return null;
        }

        foreach ($this->vars as $var) {
            if ($var->value === $value) {
                return $var->key;
            }
        }

        return null;
    }

    /** Declarada mas sem valor: em runtime chega undefined no teste e ele quebra. */
    public function isEmpty(string $key): bool
    {
        return blank($this->get($key)?->value);
    }

    /**
     * As que carregam um valor que pode vazar literal para o arquivo gerado. A secreta fica de
     * fora porque o valor dela nunca chega ao modelo, então não há literal a acusar.
     *
     * @return list<EnvironmentVarData>
     */
    public function exposed(): array
    {
        return array_values(array_filter(
            $this->vars,
            fn (EnvironmentVarData $var): bool => ! $var->secret && filled($var->value),
        ));
    }
}
