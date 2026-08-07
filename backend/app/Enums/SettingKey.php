<?php

namespace App\Enums;

/** As configurações globais do acutis, uma linha por chave na tabela `settings`. */
enum SettingKey: string
{
    /** Provedor de IA ativo, um dos declarados em `config('ai.providers')`. */
    case AI_PROVIDER = 'ai.provider';

    /** Chave de API do provedor ativo. Cifrada em disco pelo cast do model. */
    case AI_KEY = 'ai.key';
}
