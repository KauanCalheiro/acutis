<?php

return [
    'projects' => [
        // Diretório raiz onde os projetos são criados (~/.acutis por padrão).
        // Tests sobrescrevem via config()->set('acutis.projects.path', ...).
        'path' => env('ACUTIS_PROJECTS_PATH', ($_SERVER['HOME'] ?? base_path()).'/.acutis'),
    ],
];
