<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    /**
     * Requisição não fingida vira erro na hora, com a URL no nome. Sem isto, um agente que alguém
     * esqueceu de fingir chama a API de verdade: gasta crédito em silêncio e trava a suíte no
     * timeout, em vez de falhar apontando o que faltou.
     */
    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
    }
}
