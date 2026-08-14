// @vitest-environment node
import { existsSync } from 'node:fs'
import { execPath } from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { ffmpegBin, linkType, playwrightCommand } from './host.js'

const ORIGINAL = { ...process.env }

afterEach(() => {
    process.env = { ...ORIGINAL }
})

describe('playwrightCommand', () => {
    it('chama o npx do host quando ninguém aponta um CLI embutido', () => {
        delete process.env.ACUTIS_PLAYWRIGHT_CLI

        expect(playwrightCommand(['test', '--grep', 'login'])).toEqual([
            'npx',
            ['playwright', 'test', '--grep', 'login']
        ])
    })

    /**
     * No app empacotado não existe npx nem PATH com node: o único jeito de chegar ao Playwright é
     * o node que está rodando o webdriver executar o CLI que veio junto no bundle.
     */
    it('executa o CLI do bundle com o próprio node quando ACUTIS_PLAYWRIGHT_CLI aponta um', () => {
        process.env.ACUTIS_PLAYWRIGHT_CLI = '/opt/acutis/webdriver/node_modules/playwright/cli.js'

        expect(playwrightCommand(['test'])).toEqual([
            execPath,
            ['/opt/acutis/webdriver/node_modules/playwright/cli.js', 'test']
        ])
    })
})

describe('ffmpegBin', () => {
    /**
     * O binário do `ffmpeg-static` já está no node_modules que viaja no bundle, então quem não
     * configurou nada usa ele — e não depende de haver ffmpeg instalado na máquina.
     */
    it('usa o binário que veio no node_modules quando ninguém configura nada', async () => {
        delete process.env.ACUTIS_FFMPEG_BIN

        const { default: ffmpegStatic } = await import('ffmpeg-static')

        expect(ffmpegBin()).toBe(ffmpegStatic)
        expect(existsSync(ffmpegBin())).toBe(true)
    })

    it('usa o ffmpeg do bundle quando ACUTIS_FFMPEG_BIN aponta um', () => {
        process.env.ACUTIS_FFMPEG_BIN = '/opt/acutis/ffmpeg'

        expect(ffmpegBin()).toBe('/opt/acutis/ffmpeg')
    })
})

describe('linkType', () => {
    /**
     * Symlink de diretório no Windows exige privilégio de administrador ou modo desenvolvedor
     * ligado; junction não exige nada e serve para o mesmo fim aqui.
     */
    it('pede junction no Windows', () => {
        expect(linkType('win32')).toBe('junction')
    })

    it('pede symlink de diretório nos demais sistemas', () => {
        expect(linkType('darwin')).toBe('dir')
        expect(linkType('linux')).toBe('dir')
    })
})
