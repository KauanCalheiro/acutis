import { createServer } from 'node:net'

/** 1991, o ano em que Carlo Acutis nasceu. */
export const DEFAULT_PORT = 1991

const ATTEMPTS = 50

/** Se a porta aceita uma escuta agora; perguntar de outro jeito corre com quem subir no meio. */
function listens(port) {
  return new Promise((resolve) => {
    const probe = createServer()

    probe.once('error', () => resolve(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
  })
}

/** A primeira porta livre a partir da preferida. */
export async function resolvePort({ preferred = DEFAULT_PORT, free = listens, attempts = ATTEMPTS } = {}) {
  const last = preferred + attempts - 1

  for (let port = preferred; port <= last; port++) {
    if (await free(port)) return port
  }

  throw new Error(`nenhuma porta livre entre ${preferred} e ${last}. Libere uma delas e tente de novo.`)
}
