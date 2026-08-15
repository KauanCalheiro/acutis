/**
 * Faixa 42xx, exclusiva do E2E. As portas de desenvolvimento (frontend 3000, backend 4000) ficam
 * livres, então a suíte roda com a stack local de pé — sem derrubar nada.
 *
 * Fonte única: mudar aqui muda o harness inteiro (Playwright, os dois starters e os scripts).
 */
export const PORTS = {
    frontend: 4300,
    webdriver: 4400,
} as const

export const FRONTEND_URL = `http://localhost:${PORTS.frontend}`
export const WEBDRIVER_URL = `http://localhost:${PORTS.webdriver}`
