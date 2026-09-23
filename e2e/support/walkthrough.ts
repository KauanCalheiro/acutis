import { FRONTEND_URL } from './ports'

/** As apresentações de primeira visita que a suíte já dá como vistas, para o fundo delas não travar os cliques. */
const SEEN = ['projetos']

/** O estado inicial do navegador de cada teste: apresentações vistas e nada mais. */
export const WALKTHROUGHS_SEEN = {
    cookies: [
        {
            name: 'acutis-walkthrough',
            value: encodeURIComponent(JSON.stringify(SEEN)),
            domain: new URL(FRONTEND_URL).hostname,
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax' as const,
        },
    ],
    origins: [],
}

/** O navegador de quem abre o Acutis pela primeira vez. */
export const FIRST_VISIT = {
    cookies: [],
    origins: [],
}
