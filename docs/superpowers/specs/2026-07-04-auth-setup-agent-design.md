# Agente de autenticação que loga sozinho — design

**Data:** 2026-07-04 · **Status:** aprovado

## Problema

Cada sistema-alvo tem seu próprio login. Os testes gerados precisam nascer autenticados sem repetir o fluxo de login em cada um. Decisão do usuário: o modelo deve **descobrir e executar o login sozinho** a partir de credenciais, e o resultado deve ser reaplicável em outros fluxos.

## Deliberação: guardar estado ou fluxo? (decidido com o usuário)

**Ambos, em papéis distintos** — padrão oficial do Playwright (setup project + storageState):

1. **Fluxo = fonte de verdade durável.** Um `auth.setup.ts` por sistema, escrito pelo agente. Versionável, regenerável, nunca expira.
2. **Estado = cache derivado.** O setup, ao logar, salva o `storageState` (cookies + localStorage). Testes daquele sistema reusam via `use.storageState` — login roda 1x, não por teste.
3. **Expirou → o fluxo refabrica o estado.** Estado é descartável; o fluxo não.
4. **Credenciais nunca no código.** O `auth.setup.ts` lê de `process.env`; o runner injeta as credenciais como env na execução.

## Arquitetura

```
POST /api/v1/auth-setups { loginUrl, executionUrl?, username, password }
  GenerateAuthSetup (Action):
    snapshot = CaptureSnapshot(loginUrl)         ← o agente "vê" o formulário
    setup    = AuthSetupWriter(loginUrl + snapshot)   ← escreve auth.setup.ts (creds via env)
    até 3 tentativas:
      result = RunPlaywrightTest(setup, baseUrl: executionUrl, env: {AUTH_USER, AUTH_PASSWORD})
      passou (e storageState capturado) → fim
      falhou → AuthSetupWriter(setup + erro + snapshot atualizado) → retry
  200 { authSetup, testRun: { executed, passed, attempts, error }, storageCaptured }
```

O agente loga "sozinho" no sentido operacional: recebe olhos (snapshot da página) + mãos (execução real via runner) e itera o script de login até o storageState nascer. Determinístico e testável — reusa o loop já provado em [[recording-test-generation]].

### Webdriver (execução — único serviço com Chromium)

- **`POST /runner/snapshot { url }`** → `{ url, title, elements: [{tag,type,id,name,testId,placeholder,ariaLabel,text}] }`: abre a URL e extrai os elementos interativos (inputs, botões, links) — material pro agente escrever o login. Guardado por `WEBDRIVER_TEST_MODE=1`.
- **`POST /runner/spec`** ganha `env` (injeta variáveis no processo Playwright, ex. credenciais) e passa a **retornar `storageState`** quando o spec produzir `storage-state.json` no dir temporário. Sem novo endpoint.

### Backend

- **`app/Ai/Tools/CaptureSnapshot`** — HTTP para `/runner/snapshot` (irmã da `RunPlaywrightTest`).
- **`app/Ai/Agents/AuthSetupWriter`** (`gemini-2.5-flash-lite`, `HasStructuredOutput { authSetup }`): instructions escrevem um `auth.setup.ts` que loga com `process.env.AUTH_USER`/`AUTH_PASSWORD`, espera a navegação pós-login e chama `page.context().storageState({ path: 'storage-state.json' })`.
- **`GenerateAuthSetup`** (Action) orquestra snapshot → escrita → execução → autocorreção.
- **`AuthSetupData`** (entrada, validação pt-BR): `loginUrl` url obrigatória, `username`/`password` obrigatórios, `executionUrl` url opcional.
- Controller `V1/AuthSetupController` + rota `POST auth-setups`.

## Segurança

- Credenciais entram por request, viram env na execução, **nunca** aparecem no `auth.setup.ts` retornado nem em log.
- `storageState` (cookies/tokens de sessão) não é devolvido cru na resposta — só `storageCaptured: bool`. Persistência do estado é o próximo passo (fica no webdriver quando houver catálogo por sistema).
- Runner executa código arbitrário e agora recebe credenciais — reforça: serviço interno de dev, `WEBDRIVER_TEST_MODE`, nunca exposto publicamente.

## Testes (TDD — red primeiro)

- **e2e (webdriver):** `/runner/snapshot` devolve os inputs de uma página fixture; `/runner/spec` com `env` roda um spec que lê `process.env` e com `storageState` no output quando o spec salva o arquivo.
- **backend (Pest, fakes + `Http::fake`):** gera `authSetup`; snapshot é promptado ao agente; execução passa → `testRun.passed`, `storageCaptured=true`; falha→erro realimentado→retry; 3 falhas → desiste; validação 422 (loginUrl/credenciais).

## Fora de escopo (upgrades com gatilho claro)

- **Injetar o storageState nos testes de gravação** (`/recordings/tests` reusando a sessão) — próximo PR, é a segunda metade do "aplicar em outros fluxos".
- Tool calling nativo do laravel/ai (agente dirigindo browser ao vivo) — o loop orquestrado entrega o mesmo resultado com contrato determinístico; migra quando a deliberação passo-a-passo em sessão viva valer a complexidade.
- Persistência de `auth.setup.ts`/estado por sistema, MFA/captcha.
