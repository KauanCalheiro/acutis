<?php

namespace App\Enums;

/**
 * Chaves que o acutis escreve e lê. As que a IA declara para um cenário são dinâmicas e não cabem
 * aqui. Para essas existe Environments::merge().
 */
enum EnvKey: string
{
    /** URL do sistema sob teste: onde o navegador abre ao gravar e a base que o Playwright usa. */
    case URL = 'URL';

    case USER = 'USER';

    case PASSWORD = 'PASSWORD';

    case ACTIVE_ENVIRONMENT = 'ENVIRONMENT';
}
