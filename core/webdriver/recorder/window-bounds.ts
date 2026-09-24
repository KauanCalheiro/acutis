/** O tamanho da janela que deixa a página no tamanho pedido; null quando ela já está nele. */
export function windowBoundsFor(
  page: { width: number, height: number },
  measured: { innerWidth: number, innerHeight: number, outerWidth: number, outerHeight: number }
): { width: number, height: number } | null {
  if (measured.innerWidth === page.width && measured.innerHeight === page.height) return null

  return {
    width: page.width + measured.outerWidth - measured.innerWidth,
    height: page.height + measured.outerHeight - measured.innerHeight
  }
}
