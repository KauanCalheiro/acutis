import { test, expect } from '@playwright/test'

// Os testes deste arquivo rodam já autenticados: o projeto "setup" executa o
// auth.setup.ts (login) e salva o storage-state.json, reusado aqui.
// Adicione casos de navegação conforme as páginas do sistema.
test('acessa a área autenticada sem cair no login', async ({ page }) => {
    await page.goto('/')
    await expect(page).not.toHaveURL(/login/)
})
