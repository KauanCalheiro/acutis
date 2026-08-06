<?php

namespace App\Ai;

/** Os tetos do laço de ferramentas, num lugar só para serem ajustados de uma vez. */
final class Limits
{
    /**
     * Passos que um agente de escrita pode dar antes de ter que responder. Cada chamada de tool
     * gasta um.
     *
     * Medido numa execução real: o caminho normal fica em torno de seis, ou seja escrever, rodar,
     * conferir as regras, responder. O número aqui é folga para o caminho ruim, em que a execução
     * falha e ele reescreve várias vezes. É teto, não custo, e a geração comum não chega perto dele.
     */
    public const STEPS = 35;

    /**
     * Segundos que uma chamada ao modelo pode levar antes do cliente HTTP desistir.
     *
     * O padrão do laravel/ai é 60, e uma escrita real de spec passa disso: a chamada morre com
     * `cURL error 28` e o endpoint devolve 500. O teto do PHP em `AppServiceProvider` fica acima
     * deste número, senão o request morre antes da chamada.
     */
    public const TIMEOUT = 500;
}
