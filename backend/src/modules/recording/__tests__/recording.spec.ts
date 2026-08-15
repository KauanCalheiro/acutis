// @vitest-environment node
/**
 * O que sai de uma gravação, e sobretudo o que não sai. Portado de
 * `backend-laravel/tests/Unit/RecordingTest.php`.
 */
import { expect, it } from 'vitest'
import { environmentVar } from '../../environment/providers/environment-var.js'
import { specActiveVars } from '../../../../test/support/fixtures.js'
import type { RecordedEvent } from '../events.js'
import { Recording } from '../recording.js'

function events(): RecordedEvent[] {
    return [
        { type: 'navigate', url: 'https://sistema.test/login', inputType: null, value: null },
        { type: 'fill', url: 'https://sistema.test/login', inputType: 'text', value: 'user1' },
        { type: 'fill', url: 'https://sistema.test/login', inputType: 'password', value: 'topsecret123' },
        { type: 'submit', url: 'https://sistema.test/login', inputType: null, value: null }
    ]
}

function sensitiveEvents(values: string[]): RecordedEvent[] {
    return values.map((value) => ({
        type: 'fill',
        url: 'https://sistema.test/produtos',
        inputType: 'text',
        sensitive: true,
        value
    }))
}

function valuesOf(list: RecordedEvent[]): (string | null | undefined)[] {
    return list.map((event) => event.value)
}

it('extrai o usuário e a senha dos eventos gravados', () => {
    const credentials = Recording.make(events()).credentials()

    expect(credentials!.username).toBe('user1')
    expect(credentials!.password).toBe('topsecret123')
})

it('não tem credencial nenhuma quando nenhum campo de senha foi gravado', () => {
    const credentials = Recording.make([
        { type: 'fill', url: 'https://sistema.test', inputType: 'text', value: 'user1' }
    ]).credentials()

    expect(credentials).toBeNull()
})

it('não tem credencial quando a senha foi gravada sem um usuário antes dela', () => {
    const credentials = Recording.make([
        { type: 'fill', url: 'x', inputType: 'password', value: 'topsecret123' }
    ]).credentials()

    expect(credentials).toBeNull()
})

it('ignora um evento que não é preenchimento logo antes da senha ao achar o usuário', () => {
    const credentials = Recording.make([
        { type: 'fill', url: 'x', inputType: 'text', value: 'user1' },
        { type: 'click', url: 'x', inputType: null, value: null },
        { type: 'fill', url: 'x', inputType: 'password', value: 'topsecret123' }
    ]).credentials()

    expect(credentials!.username).toBe('user1')
    expect(credentials!.password).toBe('topsecret123')
})

it('marca um valor gravado que casa com um valor do ambiente usando aquela chave', () => {
    const list = Recording.make(sensitiveEvents(['abc123token']))
        .redacted(specActiveVars([environmentVar('API_TOKEN', 'abc123token')]))

    expect(valuesOf(list)).toEqual(['{{API_TOKEN}}'])
})

/** O segredo nunca sai daqui, então casar por valor é o único jeito de reconhecê-lo. */
it('marca também um valor que casa com um segredo do ambiente', () => {
    const list = Recording.make(sensitiveEvents(['topsecret123'])).redacted(specActiveVars())

    expect(valuesOf(list)).toEqual(['{{AUTH_PASSWORD}}'])
})

it('numera os valores sensíveis que não casam com chave nenhuma, na ordem da gravação', () => {
    const list = Recording.make(sensitiveEvents(['primeiro-valor', 'segundo-valor']))
        .redacted(specActiveVars())

    expect(valuesOf(list)).toEqual(['{{SENSIVEL_1}}', '{{SENSIVEL_2}}'])
})

it('nunca deixa o valor sensível original passar', () => {
    const list = Recording.make(sensitiveEvents(['valor-que-nao-pode-vazar']))
        .redacted(specActiveVars())

    expect(JSON.stringify(list)).not.toContain('valor-que-nao-pode-vazar')
})

it('deixa em paz os valores que nunca foram marcados como sensíveis', () => {
    const list = Recording.make(events()).redacted(specActiveVars())

    expect(valuesOf(list)).toContain('user1')
})

it('marca as credenciais do login gravado pelo campo que as guarda', () => {
    const list = Recording.make(events()).withoutPasswords()

    expect(valuesOf(list)).toEqual([null, '{{AUTH_USER}}', '{{AUTH_PASSWORD}}', null])
})

it('nunca deixa a senha real passar ao marcar o login', () => {
    const list = Recording.make(events()).withoutPasswords()

    expect(JSON.stringify(list)).not.toContain('topsecret123')
})

it('marca o campo de senha mesmo sem um campo de usuário antes dele', () => {
    const list = Recording.make([
        { type: 'fill', url: 'x', inputType: 'password', value: 'topsecret123' }
    ]).withoutPasswords()

    expect(valuesOf(list)).toEqual(['{{AUTH_PASSWORD}}'])
})

function eventsWithHtml(): RecordedEvent[] {
    return [
        { type: 'navigate', url: 'x', inputType: null, value: null, html: null },
        {
            type: 'click',
            url: 'x',
            inputType: null,
            value: null,
            html: '<div><button class="btn">Salvar</button></div>'
        },
        { type: 'fill', url: 'x', inputType: 'text', value: 'user1', html: '<div><input name="user"></div>' }
    ]
}

it('deixa o html capturado fora dos eventos por padrão', () => {
    expect(Recording.make(eventsWithHtml()).events()[1]).not.toHaveProperty('html')
})

it('carrega o html capturado quando ele é pedido', () => {
    expect(Recording.make(eventsWithHtml()).events(true)[1]!.html)
        .toBe('<div><button class="btn">Salvar</button></div>')
})

/** O html vive no próprio arquivo; mandá-lo junto seria pagar por ele em todo lugar. */
it('nunca manda o html capturado adiante', () => {
    const list = Recording.make(eventsWithHtml()).redacted()

    expect(JSON.stringify(list)).not.toContain('Salvar')
    expect(list[1]).not.toHaveProperty('html')
})

it('mantém o html fora dos eventos de login também', () => {
    const list = Recording.make(eventsWithHtml()).withoutPasswords()

    expect(list[1]).not.toHaveProperty('html')
})

it('guarda o html capturado na chave do evento de onde ele veio', () => {
    const html = Recording.make(eventsWithHtml()).html()

    expect(html).toEqual({
        1: '<div><button class="btn">Salvar</button></div>',
        2: '<div><input name="user"></div>'
    })
})

it('não tem html nenhum para uma gravação feita antes da captura existir', () => {
    expect(Recording.make(events()).html()).toEqual({})
})

it('resolve o valor real de cada marcador batizado, pelo marcador e não pela posição', () => {
    const values = Recording.make(sensitiveEvents(['primeiro-valor', 'segundo-valor']))
        .envValues({ SENSIVEL_2: 'SEGUNDO_TOKEN', SENSIVEL_1: 'PRIMEIRO_TOKEN' })

    expect(values).toEqual({
        SEGUNDO_TOKEN: 'segundo-valor',
        PRIMEIRO_TOKEN: 'primeiro-valor'
    })
})

it('pula um marcador batizado que a gravação nunca produziu', () => {
    const values = Recording.make(sensitiveEvents(['primeiro-valor']))
        .envValues({ SENSIVEL_1: 'PRIMEIRO_TOKEN', SENSIVEL_9: 'INVENTADO' })

    expect(values).toEqual({ PRIMEIRO_TOKEN: 'primeiro-valor' })
})
