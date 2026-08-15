---
name: e2e-backend
description: E2E que depende do backend Laravel — banco SQLite dedicado, seed determinístico, porta 4200 compartilhada entre suítes
metadata:
  type: feedback
---

## Seed determinístico

Quando o teste depende de dado do **backend Laravel/DB**, usar banco dedicado — nunca o `database.sqlite` de dev:

- `backend-laravel/database/e2e.sqlite` — isolado, só pra rodadas de E2E (gitignored)
- Antes da suíte: `DB_DATABASE=database/e2e.sqlite php artisan migrate:fresh --seed`
- `php artisan serve` da suíte aponta pro mesmo `DB_DATABASE`; cada rodada começa do mesmo estado semeado

Testes só com extensão + arquivo local (vídeo/eventos de gravação) não têm banco envolvido — não se aplica.

## Porta 4200 compartilhada

Suítes que precisam de backend sobem `php artisan serve` **sempre na 4200** (fixo no `NUXT_API_ACUTIS_URL`), via `e2e/support/backend.ts` (`startBackend(env)` → `stop`). O helper espera a porta liberar antes de subir; `stop` espera o processo morrer + porta livre — sem isso a suíte seguinte conversa com o backend errado. Mesmo motivo pro `workers: 1`: dois workers disputariam a porta; se doer no tempo, a saída é porta por spec, não voltar a vários workers.

Testes rodam **headless** por default — não passar `headless: false` sem necessidade real.
