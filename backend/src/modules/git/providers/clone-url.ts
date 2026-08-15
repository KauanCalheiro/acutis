/** A URL de clone com o token embutido e codificado. */
export function tokenUrl(url: string, token: string): string {
    return url.replace(/^https:\/\//, `https://${encodeURIComponent(token)}@`)
}
