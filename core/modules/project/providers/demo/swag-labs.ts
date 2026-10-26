/** Os arquivos do projeto de exemplo: o login e os cenários gravados no Swag Labs. */
import type { RecorderEvent } from '#shared/contracts/recording'
import { EnvKey } from '../../../environment/providers/env-key.js'

export const SWAG_LABS_URL = 'https://www.saucedemo.com'

export const SWAG_LABS_USER = 'standard_user'

export const SWAG_LABS_PASSWORD = 'secret_sauce'

export interface DemoScenario {
  id: string
  title: string
  steps: string[]
  events: RecorderEvent[]
  gherkin: string
  playwright: string
}

function event(type: string, path: string, label: string, testId?: string, value?: string): RecorderEvent {
  return {
    type,
    url: `${SWAG_LABS_URL}${path}`,
    label,
    ...(value === undefined ? {} : { value }),
    ...(testId === undefined
      ? {}
      : {
          selectors: {
            cssStable: `[data-test="${testId}"]`
          }
        })
  }
}

export const DEMO_AUTH: DemoScenario = {
  id: 'auth',
  title: 'Autenticação',
  steps: [
    'Abrir a tela de login',
    'Preencher usuário e senha',
    'Entrar no catálogo'
  ],
  events: [
    event('navigate', '/', 'Abrir a tela de login'),
    event('fill', '/', 'Usuário', 'username', SWAG_LABS_USER),
    {
      ...event('fill', '/', 'Senha', 'password', '••••••••'),
      sensitive: true
    },
    event('click', '/', 'Entrar', 'login-button')
  ],
  gherkin: `# language: pt
Funcionalidade: Autenticação

  Cenário: Entrar no Swag Labs
    Dado que estou na tela de login
    Quando informo usuário e senha válidos
    Então vejo o catálogo de produtos
`,
  playwright: `import { test as setup, expect } from '@playwright/test'

setup('Autenticação', async ({ page }) => {
    await setup.step('Abrir a tela de login', async () => {
        await page.goto('/')
    })

    await setup.step('Preencher usuário e senha', async () => {
        await page.locator('[data-test="username"]').fill(process.env.${EnvKey.USER} ?? '')
        await page.locator('[data-test="password"]').fill(process.env.${EnvKey.PASSWORD} ?? '')
    })

    await setup.step('Entrar no catálogo', async () => {
        await page.locator('[data-test="login-button"]').click()
        await expect(page.locator('[data-test="title"]')).toHaveText('Products')
    })

    await page.context().storageState({ path: process.env.${EnvKey.STORAGE_STATE} || 'storage-state.json' })
})
`
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'adicionar-produto-ao-carrinho',
    title: 'Adicionar produto ao carrinho',
    steps: [
      'Abrir o catálogo',
      'Adicionar a mochila ao carrinho',
      'Conferir o carrinho'
    ],
    events: [
      event('navigate', '/inventory.html', 'Abrir o catálogo'),
      event('click', '/inventory.html', 'Add to cart', 'add-to-cart-sauce-labs-backpack'),
      event('click', '/inventory.html', 'Carrinho', 'shopping-cart-link'),
      event('assert', '/cart.html', 'Sauce Labs Backpack', 'inventory-item-name')
    ],
    gherkin: `# language: pt
Funcionalidade: Adicionar produto ao carrinho

  Cenário: Colocar a mochila no carrinho
    Dado que estou no catálogo
    Quando adiciono a "Sauce Labs Backpack" ao carrinho
    Então o carrinho mostra a "Sauce Labs Backpack"
`,
    playwright: `import { test, expect } from '@playwright/test'

test.describe('Adicionar produto ao carrinho', { tag: ['@write', '@carrinho'] }, () => {
    test('coloca a mochila no carrinho', async ({ page }) => {
        await test.step('Abrir o catálogo', async () => {
            await page.goto('/inventory.html')
        })

        await test.step('Adicionar a mochila ao carrinho', async () => {
            await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click()
            await expect(page.locator('[data-test="shopping-cart-badge"]')).toHaveText('1')
        })

        await test.step('Conferir o carrinho', async () => {
            await page.locator('[data-test="shopping-cart-link"]').click()
            await expect(page.locator('[data-test="inventory-item-name"]')).toHaveText('Sauce Labs Backpack')
        })
    })
})
`
  },
  {
    id: 'finalizar-compra',
    title: 'Finalizar compra',
    steps: [
      'Adicionar a camiseta ao carrinho',
      'Preencher os dados de entrega',
      'Confirmar o pedido'
    ],
    events: [
      event('navigate', '/inventory.html', 'Abrir o catálogo'),
      event('click', '/inventory.html', 'Add to cart', 'add-to-cart-sauce-labs-bolt-t-shirt'),
      event('click', '/inventory.html', 'Carrinho', 'shopping-cart-link'),
      event('click', '/cart.html', 'Checkout', 'checkout'),
      event('fill', '/checkout-step-one.html', 'First Name', 'firstName', 'Ana'),
      event('fill', '/checkout-step-one.html', 'Last Name', 'lastName', 'Souza'),
      event('fill', '/checkout-step-one.html', 'Zip/Postal Code', 'postalCode', '95900-000'),
      event('click', '/checkout-step-one.html', 'Continue', 'continue'),
      event('click', '/checkout-step-two.html', 'Finish', 'finish'),
      event('assert', '/checkout-complete.html', 'Thank you for your order!', 'complete-header')
    ],
    gherkin: `# language: pt
Funcionalidade: Finalizar compra

  Cenário: Comprar uma camiseta
    Dado que a "Sauce Labs Bolt T-Shirt" está no carrinho
    Quando preencho os dados de entrega
    E confirmo o pedido
    Então vejo "Thank you for your order!"
`,
    playwright: `import { test, expect } from '@playwright/test'

test.describe('Finalizar compra', { tag: ['@write', '@checkout'] }, () => {
    test('compra uma camiseta', async ({ page }) => {
        await test.step('Adicionar a camiseta ao carrinho', async () => {
            await page.goto('/inventory.html')
            await page.locator('[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]').click()
            await page.locator('[data-test="shopping-cart-link"]').click()
            await page.locator('[data-test="checkout"]').click()
        })

        await test.step('Preencher os dados de entrega', async () => {
            await page.locator('[data-test="firstName"]').fill('Ana')
            await page.locator('[data-test="lastName"]').fill('Souza')
            await page.locator('[data-test="postalCode"]').fill('95900-000')
            await page.locator('[data-test="continue"]').click()
        })

        await test.step('Confirmar o pedido', async () => {
            await page.locator('[data-test="finish"]').click()
            await expect(page.locator('[data-test="complete-header"]')).toHaveText('Thank you for your order!')
        })
    })
})
`
  },
  {
    id: 'ordenar-produtos-por-preco',
    title: 'Ordenar produtos por preço',
    steps: [
      'Abrir o catálogo',
      'Ordenar do menor para o maior preço',
      'Conferir o primeiro produto'
    ],
    events: [
      event('navigate', '/inventory.html', 'Abrir o catálogo'),
      event('select', '/inventory.html', 'Price (low to high)', 'product-sort-container', 'lohi'),
      event('assert', '/inventory.html', 'Sauce Labs Onesie', 'inventory-item-name')
    ],
    gherkin: `# language: pt
Funcionalidade: Ordenar produtos por preço

  Cenário: Ver o produto mais barato primeiro
    Dado que estou no catálogo
    Quando ordeno do menor para o maior preço
    Então o primeiro produto é o "Sauce Labs Onesie"
`,
    playwright: `import { test, expect } from '@playwright/test'

test.describe('Ordenar produtos por preço', { tag: ['@read', '@catalogo'] }, () => {
    test('mostra o mais barato primeiro', async ({ page }) => {
        await test.step('Abrir o catálogo', async () => {
            await page.goto('/inventory.html')
        })

        await test.step('Ordenar do menor para o maior preço', async () => {
            await page.locator('[data-test="product-sort-container"]').selectOption('lohi')
        })

        await test.step('Conferir o primeiro produto', async () => {
            await expect(page.locator('[data-test="inventory-item-name"]').first()).toHaveText('Sauce Labs Onesie')
        })
    })
})
`
  }
]
