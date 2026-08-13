import { describe, expect, it } from 'vitest'
import { hoverTriggerFor } from './useHoverTrail'

function menu(): { rotulo: Element, submenu: Element, opcao: Element, imagem: Element, banner: Element } {
    document.body.innerHTML = `
        <nav>
            <li id="ensino">
                <a id="rotulo">Ensino</a>
                <ul id="submenu"><li><a id="opcao">Graduação Presencial</a></li></ul>
            </li>
        </nav>
        <aside id="fora"><a id="promo"><img id="imagem" /></a></aside>
    `

    return {
        rotulo: document.querySelector('#rotulo')!,
        submenu: document.querySelector('#submenu')!,
        opcao: document.querySelector('#opcao')!,
        imagem: document.querySelector('#imagem')!,
        banner: document.querySelector('#fora')!
    }
}

describe('hoverTriggerFor', () => {
    /**
     * O rótulo do menu é irmão do submenu, não ancestral da opção: o mouse repousa nele, o
     * :hover sobe para o item de menu e a lista aparece.
     */
    it('picks the menu label the mouse rested on, which is a sibling of the list', () => {
        const { rotulo, opcao } = menu()

        expect(hoverTriggerFor(opcao, [rotulo])).toBe(rotulo)
    })

    it('picks the list itself when that is where the mouse last rested', () => {
        const { rotulo, submenu, opcao } = menu()

        expect(hoverTriggerFor(opcao, [rotulo, submenu])).toBe(submenu)
    })

    it('never reports the clicked element itself, whose hover reveals nothing', () => {
        const { rotulo, opcao } = menu()

        expect(hoverTriggerFor(opcao, [rotulo, opcao])).toBe(rotulo)
    })

    it('reports nothing when the mouse rested nowhere but on the element it clicked', () => {
        const { opcao } = menu()

        expect(hoverTriggerFor(opcao, [opcao])).toBeNull()
    })

    /** O mouse cruza o body em todo percurso, e passar o mouse nele não revela nada. */
    it('ignores the page itself, which the mouse always crosses', () => {
        const { opcao } = menu()

        expect(hoverTriggerFor(opcao, [document.body, document.documentElement])).toBeNull()
    })

    it('reports nothing when the mouse rested nowhere', () => {
        const { opcao } = menu()

        expect(hoverTriggerFor(opcao, [])).toBeNull()
    })

    /**
     * O mouse cruza o carrossel a caminho do botão do banner de cookies. Aquele repouso não abriu
     * nada perto do que foi clicado, e virava passo de teste do mesmo jeito.
     */
    it('ignores a resting element from another corner of the page', () => {
        const { imagem, opcao } = menu()

        expect(hoverTriggerFor(opcao, [imagem])).toBeNull()
    })

    it('still finds the menu label when the mouse crossed something unrelated afterwards', () => {
        const { rotulo, imagem, opcao } = menu()

        expect(hoverTriggerFor(opcao, [rotulo, imagem])).toBe(rotulo)
    })

    /** Repouso solto no topo da página: o body contém tudo, e vizinhança de tudo não é vizinhança. */
    it('ignores a resting element whose only kinship with the target is the page', () => {
        const { banner, opcao } = menu()

        expect(hoverTriggerFor(opcao, [banner])).toBeNull()
    })
})
