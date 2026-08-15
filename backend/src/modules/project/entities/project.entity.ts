/** Um projeto do acutis: um diretório em `~/.acutis/<slug>` com um `acutis.json` dentro. */
export class Project {
    constructor(
        readonly name: string,
        readonly slug: string,
        readonly path: string,
        readonly created_at: string,
        /** O `origin` do git, quando o diretório é um repositório. */
        readonly repository: string | null = null,
        /** GitHub, GitLab ou Bitbucket, deduzido da URL do remote. */
        readonly provider: string | null = null
    ) {}
}

/** O manifesto gravado na raiz do projeto, que é o que faz um diretório ser um projeto. */
export interface ProjectManifest {
    name: string
    slug: string
    created_at: string
    version: number
}
