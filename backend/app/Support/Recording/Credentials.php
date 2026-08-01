<?php

namespace App\Support\Recording;

/** Usuário e senha reais de um login gravado — ver Recording::credentials(). */
final class Credentials
{
    public function __construct(
        public readonly string $username,
        public readonly string $password,
    ) {}
}
