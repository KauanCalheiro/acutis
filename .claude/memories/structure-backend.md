---
name: structure-backend
description: Estrutura de pastas do backend Laravel — app/Http, database, routes, tests; comandos artisan/pint
metadata:
  type: project
---

Laravel 13, PHP 8.5. API REST. SQLite como banco de dados. `APP_URL=http://localhost:8000`.

```
backend/
├── app/
│   ├── Http/Controllers/
│   ├── Models/
│   └── Providers/
├── database/
│   ├── migrations/
│   ├── factories/
│   └── seeders/
├── routes/
│   └── api.php
└── tests/
    ├── Feature/
    └── Unit/
```

**Comandos:** `php artisan serve` · `php artisan test` · `./vendor/bin/pint`
