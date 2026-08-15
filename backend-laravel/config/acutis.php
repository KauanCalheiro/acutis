<?php

return [
    'projects' => [
        // Diretório raiz onde os projetos são criados (~/.acutis por padrão).
        // Tests sobrescrevem via config()->set('acutis.projects.path', ...).
        'path' => env('ACUTIS_PROJECTS_PATH', ($_SERVER['HOME'] ?? base_path()).'/.acutis'),

        // Caminho equivalente no host (fora do container), pra links vscode://file/.
        // Sem essa env, cai no valor de 'path' acima.
        'host_path' => env('ACUTIS_PROJECTS_HOST_PATH'),
    ],

    'webdriver' => [
        'url' => env('WEBDRIVER_URL', 'http://localhost:4000'),
    ],
];
