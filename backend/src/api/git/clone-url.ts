/**
 * A URL de clone com o token embutido.
 *
 * O token entra codificado porque ele vem digitado pelo usuário e pode carregar barra ou espaço —
 * que, crus, quebrariam a URL em outro lugar.
 */
export function tokenUrl(url: string, token: string): string {
    return url.replace(/^https:\/\//, `https://${encodeURIComponent(token)}@`)
}
