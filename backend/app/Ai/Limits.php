<?php

namespace App\Ai;

/** Os tetos que uma chamada de IA atravessa, num lugar só para serem ajustados de uma vez. */
final class Limits
{
    /**
     * Segundos que uma chamada ao modelo pode levar antes do cliente HTTP desistir.
     *
     * O padrão do laravel/ai é 60, e uma escrita real de spec passa disso: a chamada morre com
     * `cURL error 28` e o endpoint devolve 500. O teto do PHP em `AppServiceProvider` fica acima
     * deste número, senão o request morre antes da chamada.
     */
    public const TIMEOUT = 500;
}
