<?php

namespace App\Ai;

/** Os tetos do laço de ferramentas, num lugar só para serem ajustados de uma vez. */
final class Limits
{
    /**
     * Passos que um agente de escrita pode dar antes de ter que responder. Cada chamada de tool
     * gasta um.
     *
     * Medido numa execução real: o caminho normal fica em torno de seis — escrever, rodar,
     * conferir as regras, responder. O número aqui é folga para o caminho ruim, em que a execução
     * falha e ele reescreve duas ou três vezes. Com oito a resposta vinha vazia; é teto, não custo,
     * e a geração comum não chega perto dele.
     */
    public const STEPS = 24;
}
