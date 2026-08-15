/**
 * As portas exclusivas do E2E, que não colidem com as de desenvolvimento.
 *
 * Fonte única: mudar aqui muda o harness inteiro (Playwright, os dois starters e os scripts).
 */
export const PORTS = {
    frontend: 4300,
    webdriver: 4400,
} as const

export const FRONTEND_URL = `http://localhost:${PORTS.frontend}`
export const WEBDRIVER_URL = `http://localhost:${PORTS.webdriver}`
