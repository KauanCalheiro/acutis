/**
 * Para onde vão os relatos de erro no pacote publicado. Ficam vazios no repositório: o workflow de
 * release escreve os dois a partir dos secrets antes de empacotar, e `TELEMETRY_URL` e
 * `TELEMETRY_KEY` no ambiente sobrescrevem em qualquer caso.
 */
export const DEFAULT_TELEMETRY_URL = ''
export const DEFAULT_TELEMETRY_KEY = ''
