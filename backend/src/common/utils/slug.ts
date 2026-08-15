/** O texto sem acento, minúsculo e separado por hífen — é o que vira o diretório do projeto. */
export function slug(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
}
