/** Um projeto do acutis: um diretório em `~/.acutis/<slug>` com um `acutis.json` dentro. */
import type { Project as ProjectContract } from '#shared/contracts/project'

export class Project {
  constructor(
    readonly name: string,
    readonly slug: string,
    readonly path: string,
    readonly created_at: string,
    /** O `origin` do git, quando o diretório é um repositório. */
    readonly repository: string | null = null,
    /** GitHub, GitLab ou Bitbucket, deduzido da URL do remote. */
    readonly provider: ProjectContract['provider'] = null,
    /** O projeto de exemplo que a apresentação inicial cria e revoga. */
    readonly demo: boolean = false
  ) {}
}

/** O manifesto gravado na raiz do projeto, que é o que faz um diretório ser um projeto. */
export interface ProjectManifest {
  name: string
  slug: string
  created_at: string
  version: number
  /** A ordem em que a gravação tenta os seletores; ausente, vale a padrão. */
  selectors?: string[]
  demo?: boolean
}
