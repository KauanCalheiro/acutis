/**
 * O que muda entre rodar em desenvolvimento e rodar dentro do app empacotado.
 *
 * Em desenvolvimento o host tem node, npx e ffmpeg no PATH. No bundle não tem nada disso: os
 * binários viajam junto e o shell informa onde estão por variável de ambiente. Sem variável, tudo
 * cai no comportamento de hoje.
 */
import { execPath } from 'node:process'
import ffmpegStaticExport from 'ffmpeg-static'

/**
 * O `ffmpeg-static` declara os tipos como CommonJS, e sob ESM o TypeScript enxerga o módulo inteiro
 * no lugar do caminho que ele de fato exporta. Em runtime é a string, ou null onde o pacote não tem
 * binário para a plataforma.
 */
const ffmpegStatic = ffmpegStaticExport as unknown as string | null

/**
 * Comando e argumentos para invocar o Playwright.
 *
 * O CLI embutido é um arquivo .js, não um executável: quem o roda é o mesmo node que está rodando o
 * webdriver, que no bundle é o único node que existe.
 */
export function playwrightCommand(args: string[]): [string, string[]] {
    const cli = process.env.ACUTIS_PLAYWRIGHT_CLI

    return cli ? [execPath, [cli, ...args]] : ['npx', ['playwright', ...args]]
}

/**
 * O `ffmpeg-static` traz o binário da plataforma dentro do node_modules, que é o mesmo node_modules
 * que viaja no bundle — então o app empacotado não precisa baixar nem apontar nada. A variável fica
 * como escape para quem quiser um ffmpeg próprio, e o nome solto é o último recurso, para o caso de
 * uma plataforma que o pacote não cobre.
 */
export function ffmpegBin(): string {
    return process.env.ACUTIS_FFMPEG_BIN || ffmpegStatic || 'ffmpeg'
}

/**
 * Symlink de diretório no Windows exige privilégio de administrador ou o modo desenvolvedor ligado,
 * e o usuário final não tem nem um nem outro. Junction faz o mesmo papel sem exigir permissão.
 */
export function linkType(platform: NodeJS.Platform = process.platform): 'junction' | 'dir' {
    return platform === 'win32' ? 'junction' : 'dir'
}
