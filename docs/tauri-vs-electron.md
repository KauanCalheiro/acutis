# Tauri x Electron para empacotar o acutis

Medido em 14/08/2026, num MacBook Apple Silicon. As duas implementações existem e funcionam:

- Tauri — branch `feat/empacotamento-desktop`, [PR #138](https://github.com/KauanCalheiro/acutis/pull/138)
- Electron — branch `feat/empacotamento-desktop-electron`, partindo da anterior

A comparação isola o shell: as adaptações de produto (resolvedores de binário, `junction` no Windows,
endpoint de capacidades, `ffmpeg-static`), o `bundle-resources.sh`, o payload `.tar.gz` e a estratégia
de boot são **os mesmos nos dois**. O que muda é quem sobe os processos e desenha a janela.

Os dois foram exercitados até o mesmo ponto: instalador gerado, app aberto de verdade, os três
serviços de pé, e um teste Playwright executado pelo runner com o node e o Chromium do bundle.

## Números

| | Tauri | Electron | |
|---|---:|---:|---|
| Instalador (`.dmg`) | **373 MB** | 463 MB | +90 MB no Electron |
| Build completo (compilar + `.dmg`) | **53s** | 90s | ambos com o cache de dependências já aquecido |
| Rebuild após tocar um arquivo | **32s** | 90s | o Rust é incremental; o electron-builder reempacota tudo sempre |
| Primeiro boot (extrai o payload) | ~2min | ~2min | domina a extração, igual nos dois |
| Boot seguinte, três serviços de pé | **1,3s** | 1,6s | empate prático |
| RAM do shell em repouso | **101 MB** + 158 MB de WebKit = **259 MB** | **155 MB** | ver a ressalva abaixo |
| RAM dos três serviços | 294 MB | 302 MB | igual, como esperado |
| Linhas de produção | 612 (Rust) | **480** (JS) | |
| Linhas de teste | 184 | 182 | 11 testes em cada, cobrindo o mesmo |
| Dependências diretas | 7 crates | **2** pacotes | |
| Árvore travada | 447 crates | 354 pacotes | |
| Toolchain no CI | Rust + Node + PHP | **Node + PHP** | |

**A RAM merece cuidado.** O `ps` do Tauri mostra 101 MB, menos que os 155 MB do Electron — mas isso
engana: no macOS a WKWebView roda em três processos do sistema que não aparecem como filhos do app.
Somados, dão 158 MB, e confirmei que morrem junto com o app. O total real fica em ~259 MB para o
Tauri contra 155 MB do Electron. **O Electron gastou menos memória**, ao contrário do que a fama dos
dois sugere — provavelmente porque aqui a janela é um cliente burro apontando para `localhost`, e o
Chromium do Electron faz esse pouco com um processo, enquanto o WebKit insiste em três.

## O que foi diferente na prática

**O Electron instala pior.** A instalação via pnpm falhou três vezes seguidas nesta máquina: o
`extract-zip` do `install.js` produziu 256 KB de um zip de 99 MB, sem erro nenhum, deixando o
`Electron Framework.framework` incompleto e o app abortando com `dyld: Library not loaded`. Resolver
exigiu limpar `~/Library/Caches/electron` e extrair na mão com o `unzip` do sistema. O `rustup` e o
`cargo` do Tauri instalaram e compilaram sem uma intervenção.

Isso é a **mesma classe de problema** que obrigou o payload `.tar.gz`: extrair árvores com symlinks e
frameworks é onde as ferramentas de empacotamento falham, e falham em silêncio.

**O Electron precisou de menos cerimônia para tudo o mais.** Sem `build.rs`, sem `tauri.conf.json`,
sem schemas gerados, sem ícone em formato próprio — o `package.json` cobre configuração e build. O
`node:test` da stdlib deu os 11 testes sem adicionar um framework, contra o `cargo test` que já vem
pronto: empate aqui.

**O `extraResources` do electron-builder engoliu um erro parecido com o do Tauri.** Declarado como
`["../payload/…"]`, ele simplesmente não copiou o arquivo, e o `.dmg` saiu com 94 MB — plausível o
bastante para passar despercebido se eu não estivesse conferindo o tamanho. Só a forma
`{from, to}` funcionou. O Tauri tinha errado o mesmo ponto de outro jeito, jogando tudo em
`Resources/_up_/`.

**Ciclo de desenvolvimento: o Tauri é mais rápido, contra a intuição.** Esperava-se o contrário —
"compilar Rust demora" —, mas o `cargo clean` não descarta o cache global, então até um build do zero
sai em 43s, e o bundle completo em 53s. O `electron-builder` gasta 90s toda vez, porque reempacota,
reassina e remonta o `.dmg` sem nada incremental. Tocando um arquivo, a distância dobra: 32s contra
90s.

A ressalva justa é que o Electron tem um atalho que o Tauri não tem: `pnpm start` roda o app sem
empacotar nada, em segundos. Para iterar no shell, é o caminho mais rápido dos três.

## Recomendação

**Ficar com o Tauri**, por três motivos, nenhum deles o consumo de memória:

1. **O instalador é 90 MB menor** e não carrega um segundo navegador — o app já leva um Chromium
   inteiro para o Playwright, e o Electron acrescenta outro só para desenhar a janela.
2. **A instalação da toolchain é confiável.** O que quebrou três vezes no Electron não é código do
   acutis, e voltaria a atormentar qualquer pessoa que fosse construir o projeto.
3. **O build é quase 3x mais rápido** — 32s contra 90s ao mexer no shell, e 53s contra 90s do zero.

O argumento do outro lado é real e não deve ser descartado: **o Electron tira o Rust do CI e da
máquina de quem constrói**, e o shell fica 130 linhas menor em uma linguagem que o resto do projeto
já usa. Se manter uma toolchain Rust por 480 linhas de JavaScript equivalente incomodar mais do que
os 90 MB extras, trocar é defensável — e o custo de trocar agora é baixo, porque as duas
implementações são intercambiáveis: consomem o mesmo payload e o mesmo `bundle-resources.sh`.

O que **não** deve mudar em nenhum cenário é o que está fora do shell: o payload `.tar.gz`, o `php -S`
direto, os resolvedores de binário e a limpeza de órfãos. Foi ali que estiveram todos os problemas
difíceis, e nos dois shells a solução foi idêntica.

## O que nenhum dos dois provou

Windows e Linux. Nem o Tauri nem o Electron foram construídos fora do macOS, e o workflow de release
nunca rodou. A decisão acima vale para o que foi medido; o `php.exe` do Windows continua sendo o
maior risco aberto dos dois lados, porque é anterior à escolha do shell.
