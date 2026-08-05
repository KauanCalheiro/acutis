<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class EnvironmentVarData extends Data
{
    public const KEY = '[A-Za-z_][A-Za-z0-9_]*';

    public function __construct(
        public readonly string $key,
        public readonly ?string $value = null,
        public readonly bool $secret = false,
        public readonly bool $pending = false,
    ) {}

    public static function fromLine(string $line): ?self
    {
        if (! preg_match('/^('.self::KEY.')=(.*)$/', trim($line), $matches)) {
            return null;
        }

        return new self($matches[1], trim($matches[2], " \t\"'"));
    }

    /** @param  list<self>  $vars */
    public static function keyed(array $vars, string $key): ?self
    {
        foreach ($vars as $var) {
            if ($var->key === $key) {
                return $var;
            }
        }

        return null;
    }

    public function toLine(): string
    {
        return "{$this->key}={$this->value}";
    }

    public function displayed(): self
    {
        return new self(
            key: $this->key,
            value: $this->value,
            secret: $this->secret,
            pending: blank($this->value),
        );
    }
}
