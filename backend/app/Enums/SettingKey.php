<?php

namespace App\Enums;

/** As configurações globais do acutis, uma linha por chave na tabela `settings`. */
enum SettingKey: string
{
    /**
     * Provedor de IA ativo, um dos declarados em `config('ai.providers')`. O cadastro de cada um
     * mora em `ai_settings`; aqui fica só qual deles vale.
     */
    case AI_PROVIDER = 'ai.provider';
}
