<?php

namespace App\Enums;

/**
 * Chaves do .env que o acutis escreve e lê. As que a IA declara para um cenário são dinâmicas e
 * não cabem aqui — para essas existe Env::merge().
 */
enum EnvKey: string
{
    /** URL do sistema sob teste: onde o navegador abre ao gravar e a base que o Playwright usa. */
    case BASE_URL = 'BASE_URL';

    case AUTH_USER = 'AUTH_USER';

    case AUTH_PASSWORD = 'AUTH_PASSWORD';

    case ACTIVE_ENVIRONMENT = 'ACUTIS_ENV';
}
