<?php

use App\Support\AcutisConfig;

if (! function_exists('acutis')) {
    /** Resolver global tipado da configuração do Acutis: acutis()->projectsPath. */
    function acutis(): AcutisConfig
    {
        return AcutisConfig::resolve();
    }
}
