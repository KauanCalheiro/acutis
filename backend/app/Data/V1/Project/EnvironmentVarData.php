<?php

namespace App\Data\V1\Project;

use Illuminate\Support\Str;
use Spatie\LaravelData\Data;

class EnvironmentVarData extends Data
{
    public const KEY = '[A-Za-z_][A-Za-z0-9_]*';

    private const POINTER_BODY = '\{\{env\.('.self::KEY.')\}\}';

    private const POINTER = '/'.self::POINTER_BODY.'/';

    private const ONLY_POINTER = '/^'.self::POINTER_BODY.'$/';

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

    public static function pointerTo(string $key): string
    {
        return '{{env.'.$key.'}}';
    }

    public function toLine(): string
    {
        return "{$this->key}={$this->value}";
    }

    public function isPointer(): bool
    {
        return filled($this->value) && preg_match(self::ONLY_POINTER, $this->value) === 1;
    }

    public function pointerKey(): ?string
    {
        return preg_match(self::POINTER, (string) $this->value, $matches) === 1 ? $matches[1] : null;
    }

    /** @param  array<string, string>  $dotenv */
    public function resolve(array $dotenv): string
    {
        return preg_replace_callback(
            self::POINTER,
            fn (array $matches): string => $dotenv[$matches[1]] ?? '',
            (string) $this->value,
        );
    }

    /** @param  array<string, string>  $dotenv */
    public function masked(array $dotenv): self
    {
        return new self(
            key: $this->key,
            value: $this->secret ? null : $this->value,
            secret: $this->secret,
            pending: blank($this->resolve($dotenv)),
        );
    }

    public function pointedTo(string $environmentSlug, ?self $stored = null): self
    {
        if ($this->isPointer()) {
            return new self($this->key, $this->value, secret: true);
        }

        if ($stored?->isPointer()) {
            return new self($this->key, $stored->value, secret: true);
        }

        return new self($this->key, self::pointerTo(self::vaultKeyFor($environmentSlug, $this->key)), secret: true);
    }

    private static function vaultKeyFor(string $environmentSlug, string $key): string
    {
        return Str::upper(Str::replace('-', '_', $environmentSlug)).'_'.$key;
    }
}
