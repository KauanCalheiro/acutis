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

    /**
     * Prefixo AUTH_ de propósito: USER e PASSWORD puros colidem com variáveis do shell (no
     * Unix o USER do sistema já vem no ambiente do processo), e o teste receberia o usuário da
     * máquina em vez de falhar por credencial faltando.
     */
    case USER = 'AUTH_USER';

    case PASSWORD = 'AUTH_PASSWORD';

    case ACTIVE_ENVIRONMENT = 'ENVIRONMENT';
}
