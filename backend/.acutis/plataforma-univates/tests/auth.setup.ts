import { test as setup, expect } from '@playwright/test';

setup('Authentication', async ({ page }) => {
    const username = process.env.AUTH_USER;
    const password = process.env.AUTH_PASSWORD;

    if (!username || !password) {
        throw new Error('AUTH_USER and AUTH_PASSWORD environment variables must be set.');
    }

    await page.goto('https://www.univates.br/plataforma/login');

    // Check if the user/password inputs are initially hidden and need a button click to reveal
    const loginButtonSelector = 'button:has-text("Entrar com usuário/código")';
    const usernameInputSelector = '#v-0';
    const passwordInputSelector = '#v-1';

    // If the username input is not visible, click the button to reveal it
    if (await page.locator(usernameInputSelector).isHidden()) {
        await page.locator(loginButtonSelector).click();
    }

    await page.locator(usernameInputSelector).fill(username);
    await page.locator(passwordInputSelector).fill(password);

    // Click the 'Entrar' button that is visible after filling the inputs
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    // Wait for navigation or for the password field to disappear to confirm login
    await expect(page.locator(passwordInputSelector)).not.toBeVisible();
    await page.waitForURL(url => !url.toString().includes('/login'));

    // Save the authentication state
    await page.context().storageState({ path: 'storage-state.json' });
});

