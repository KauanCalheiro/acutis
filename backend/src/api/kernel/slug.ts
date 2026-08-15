/**
 * O `Str::slug` do Laravel: sem acento, minúsculo, separado por hífen.
 *
 * É o que transforma o nome que o usuário digita no diretório do projeto, então mudar isto renomeia
 * projetos.
 */
export function slug(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
}
