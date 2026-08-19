#!/usr/bin/env node
// Banner da subida do acutis: a logo em ASCII, o nome em letra grande e os endereços
// expostos. Usado nas duas frentes — o ./dev.sh do repositório e o `acutis` publicado.
//
//   node bin/splash.mjs [urlFrontend] [urlApi]            avulso
//   import { splash } from './splash.mjs'                de dentro do bin

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Par, e metade disso é a altura em linhas — 18 dá 9 linhas. A célula do braille tem
// 2 pontos de largura por 4 de altura, então COLS/2 linhas sempre resulta num bitmap
// quadrado (COLS*2 por COLS*2 pontos).
const COLS = 20
const STROKE = 4.5 // raio do traço em unidades do viewBox (o svg usa stroke-width 8)
const SS = [3, 6] // braille: 2x4 pontos por célula
const BITS = [[0, 0, 0], [0, 1, 1], [0, 2, 2], [1, 0, 3], [1, 1, 4], [1, 2, 5], [0, 3, 6], [1, 3, 7]]

const plain = !process.stdout.isTTY || process.env.NO_COLOR
const fg = (r, g, b) => (plain ? '' : `\x1b[38;2;${r};${g};${b}m`)
const off = plain ? '' : '\x1b[0m'
const BRAND = [125, 185, 240]

// --- logo: o mesmo path que o frontend desenha, rasterizado em ASCII ----------
// No repositório a fonte é o próprio arquivo do frontend, então não há um segundo desenho
// para manter em dia. No pacote publicado esse arquivo não existe: o `cli:build` deixa uma
// cópia gerada ao lado deste script.
const repoSrc = new URL('../app/utils/logo.ts', import.meta.url)
const logoPath = existsSync(repoSrc)
  ? readFileSync(repoSrc, 'utf8').match(/logoPath = '([^']+)'/)[1]
  : (await import('./logo-path.js')).logoPath

const segments = logoPath.split('M').slice(1).flatMap((chunk) => {
  const n = chunk.match(/-?\d+\.?\d*/g).map(Number)
  const pts = []
  for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]])
  return pts.slice(1).map((p, i) => [pts[i], p])
})

function renderLogo() {
  const rows = COLS / 2
  const [w, h] = [COLS * SS[0], rows * SS[1]] // com COLS par isso dá w === h: ponto quadrado
  // Caixa de corte QUADRADA em volta do que o desenho ocupa. Retangular esticaria a logo,
  // já que o ponto do braille é quadrado (2x4 pontos numa célula de proporção 1:2).
  const xs = segments.flat().map(p => p[0])
  const ys = segments.flat().map(p => p[1])
  const cx0 = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy0 = (Math.min(...ys) + Math.max(...ys)) / 2
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + STROKE
  const [x0, x1, y0, y1] = [cx0 - half, cx0 + half, cy0 - half, cy0 + half]
  const sx = (w - 1) / (x1 - x0)
  const sy = (h - 1) / (y1 - y0)
  const rx = STROKE * sx
  const ry = STROKE * sy
  const px = new Uint8Array(w * h)

  const dot = (cx, cy) => {
    for (let y = Math.max(0, Math.ceil(cy - ry)); y <= Math.min(h - 1, cy + ry); y++) {
      for (let x = Math.max(0, Math.ceil(cx - rx)); x <= Math.min(w - 1, cx + rx); x++) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy <= 1) px[y * w + x] = 1
      }
    }
  }

  for (const [[ax, ay], [bx, by]] of segments) {
    const [x1p, y1p] = [(ax - x0) * sx, (ay - y0) * sy]
    const [x2p, y2p] = [(bx - x0) * sx, (by - y0) * sy]
    const steps = Math.ceil(Math.max(Math.abs(x2p - x1p), Math.abs(y2p - y1p)))
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0
      dot(x1p + (x2p - x1p) * t, y1p + (y2p - y1p) * t)
    }
  }

  return toBraille(px, w, h)
}

// bitmap 1 bit por pixel -> linhas de braille (cada célula é 2x4 pontos)
function toBraille(px, w, h) {
  const lines = []
  for (let y = 0; y < h; y += 4) {
    let line = ''
    for (let x = 0; x < w; x += 2) {
      let bit = 0
      for (const [dx, dy, b] of BITS)
        if (px[(y + dy) * w + x + dx]) bit |= 1 << b
      line += String.fromCharCode(0x2800 + bit)
    }
    lines.push(line)
  }
  return lines
}

// --- nome em letra grande, no mesmo braille ------------------------------------
// glifos de 1 bit por caractere, 5x7 — escalados depois para virar pixels de braille
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.']
}
// Pixel perfect no braille: a célula tem 2 pontos de largura por 4 de altura, então o
// passo de uma letra para a outra (SCALE*5 + GAP) precisa ser PAR, senão cada letra cai
// meia célula fora e o traço racha. Mesma regra na vertical: altura múltipla de 4.
const SCALE = 2 // 5x7 do glifo vira 10x14 pontos
const GAP = 5 // passo de 12 pontos = 6 células exatas por letra

function renderWordmark(text) {
  const glyphs = [...text].map(ch => GLYPHS[ch])
  const gw = glyphs[0][0].length * SCALE
  // largura par e altura múltipla de 4: é o tamanho da célula do braille. Sem isso a
  // última coluna vaza para a linha seguinte e o desenho embaralha.
  const w = Math.ceil((glyphs.length * gw + (glyphs.length - 1) * GAP) / 2) * 2
  const h = Math.ceil((glyphs[0].length * SCALE) / 4) * 4
  const px = new Uint8Array(w * h)

  glyphs.forEach((rows, g) => {
    const ox = g * (gw + GAP)
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch !== '#') return
        for (let dy = 0; dy < SCALE; dy++)
          for (let dx = 0; dx < SCALE; dx++)
            px[(y * SCALE + dy) * w + ox + x * SCALE + dx] = 1
      })
    })
  })
  return toBraille(px, w, h)
}

// --- composição ----------------------------------------------------------------
const PAD = 1 // linha em branco acima e abaixo da logo
const DROP = 1 // o bloco da direita começa uma linha abaixo do topo da logo

export function splash(frontendUrl, apiUrl) {
  const wordmark = renderWordmark('ACUTIS')
  const logo = renderLogo()
  const label = fg(120, 140, 165)
  const value = fg(150, 200, 245)

  const right = [
    ...wordmark.map(l => fg(...BRAND) + l + off),
    '',
    `${label}frontend${off}   ${value}${frontendUrl}${off}`,
    `${label}api${off}        ${value}${apiUrl}${off}`
  ]

  const height = Math.max(logo.length, right.length + DROP) + PAD * 2
  const blank = ' '.repeat(logo[0].length)

  const out = []
  for (let i = 0; i < height; i++) {
    const l = logo[i - PAD] ?? blank
    const r = right[i - PAD - DROP] ?? ''
    out.push(`  ${fg(...BRAND)}${l}${off}   ${r}`.replace(/\s+$/, ''))
  }

  return `\n${out.join('\n')}\n\n`
}

// chamado direto pelo ./dev.sh, que passa as urls como argumento
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.argv[2] || 'http://localhost:3000'
  process.stdout.write(splash(url, process.argv[3] || url))
}
