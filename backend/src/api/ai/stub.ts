/**
 * O ponto de reentrada da IA.
 *
 * Nenhum agente foi portado para o Node (decisão registrada em `docs/migracao-node.md`), mas os
 * endpoints que dependiam de modelo continuam existindo e respondendo o mesmo formato. Enquanto a
 * IA está fora do escopo, quem responde é este módulo: um objeto fixo, no mesmo contrato que o
 * `GherkinWriter` devolvia.
 *
 * É de propósito que ele seja o único arquivo com esse conhecimento — reativar a IA depois é trocar
 * o corpo destas duas funções por uma chamada ao AI SDK, sem tocar em service nem em controller.
 */

/** O que o `GherkinWriter` devolvia: o Gherkin do cenário e o domínio a que ele pertence. */
export interface GeneratedScenario {
    gherkin: string
    domain: string
}

/**
 * O provedor configurado. Espelha o `Provider::configured()` do Laravel, que lia `config('ai.default')`:
 * sem provedor o acutis continua funcionando, só que o cenário sai só da gravação.
 *
 * ponytail: enquanto o provedor é este módulo, a chave só existe para o teste conseguir desligá-lo;
 * quando a IA voltar, ela passa a ler a configuração de verdade.
 */
export function aiConfigured(): boolean {
    return (process.env.ACUTIS_AI_PROVIDER ?? 'stub') !== ''
}

/**
 * O cenário em Gherkin. Fixo: descrever a gravação é justamente o que exige modelo, e inventar uma
 * heurística aqui seria criar um segundo comportamento para desfazer quando a IA voltar.
 */
export function writeGherkin(): GeneratedScenario {
    return {
        gherkin: 'Funcionalidade: Login do Usuário\n  Cenário: entra',
        domain: 'login'
    }
}
