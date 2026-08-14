# Publicar uma versão

Como sair de um commit na `main` para os três instaladores baixáveis em
[Releases](https://github.com/KauanCalheiro/acutis/releases).

Quem constrói na própria máquina: [DESKTOP.md](DESKTOP.md). Quem só instala: [INSTALL.md](INSTALL.md).

## O caminho normal

Publicar é **empurrar uma tag**. O resto é automático.

```sh
git checkout main && git pull

# 1. a versão precisa estar nos dois arquivos, e igual nos dois
#    desktop/src-tauri/tauri.conf.json  →  "version": "0.2.0"
#    desktop/src-tauri/Cargo.toml       →  version = "0.2.0"

git commit -am "chore: bump version to 0.2.0"
git push

git tag v0.2.0
git push origin v0.2.0
```

A tag dispara `.github/workflows/desktop-release.yml`, que:

1. constrói em três máquinas ao mesmo tempo — `macos-14`, `windows-latest`, `ubuntu-22.04`;
2. roda o smoke do bundle e os testes do shell em cada uma (o smoke não roda no Windows);
3. cria a release com os quatro arquivos anexados e o texto de instalação já preenchido.

Leva de 30 a 60 minutos, quase tudo baixando runtimes e o Chromium.

> **A versão da tag e a do `tauri.conf.json` são coisas separadas.** A tag decide *quando* publicar;
> o `tauri.conf.json` decide o *nome do arquivo* e o diretório em `~/.acutis/runtime/app/<versão>`.
> Esquecer de subir a segunda gera `acutis_0.1.0.dmg` numa release chamada `v0.2.0`, e o app não
> reextrai o payload por achar que já está instalado.

## Acompanhar

```sh
gh run watch                                     # a execução em andamento
gh run view --log-failed                         # o log de quem falhou
```

Um alvo que falha **não** cancela os outros (`fail-fast: false`): quem depende do `.msi` não fica
sem release porque o AppImage quebrou. A release sai com o que deu certo, e o alvo que faltou pode
ser anexado depois.

## Construir sem publicar

Para testar o pipeline inteiro sem criar release:

```sh
gh workflow run "Instaladores desktop"
```

O `workflow_dispatch` faz os três builds e sobe os instaladores como *artifacts* da execução — o job
de release só roda quando o disparo veio de uma tag. Baixar:

```sh
gh run download <id-da-execução>
```

## Anexar um alvo que faltou

Construa na máquina daquele sistema ([DESKTOP.md](DESKTOP.md)) e anexe:

```sh
gh release upload v0.2.0 desktop/src-tauri/target/release/bundle/msi/acutis_0.2.0_x64_en-US.msi
```

Para substituir um arquivo já publicado, acrescente `--clobber`.

## Corrigir uma release

Uma tag já empurrada não se reaproveita: apagá-la e recriá-la deixa quem já baixou com um arquivo
que não corresponde mais à tag. Publique `v0.2.1`.

Se precisar mesmo refazer (a release nunca foi anunciada, por exemplo):

```sh
gh release delete v0.2.0 --yes
git push --delete origin v0.2.0
git tag -d v0.2.0
```

## O que ainda é manual

**Assinatura.** Nada é assinado, e é por isso que o texto da release explica o clique-direito-Abrir
no macOS e o *Executar assim mesmo* no Windows. Para resolver de verdade:

| Sistema | O que falta | Custo |
|---|---|---|
| macOS | conta paga do Apple Developer Program, certificado *Developer ID Application*, e notarização (`xcrun notarytool`) | US$ 99/ano |
| Windows | certificado de assinatura de código EV — sem ser EV, o SmartScreen continua avisando até a reputação acumular | algumas centenas de dólares/ano |

O Tauri assina no próprio `build` quando encontra as variáveis de ambiente
(`APPLE_CERTIFICATE`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` no macOS;
`WINDOWS_CERTIFICATE` no Windows). Guardadas como *secrets* do repositório, viram só mais um `env:`
no workflow — o resto do pipeline não muda.

**Atualização automática.** O updater do Tauri depende de artefatos assinados, então entra junto com
o item acima. Enquanto isso, atualizar é baixar a versão nova; o app extrai o payload no diretório da
versão nova e não mistura com a anterior.

## Espaço em disco

Cada versão instalada ocupa ~1,2 GB em `~/.acutis/runtime/app/<versão>`, e as antigas **não** são
apagadas — de propósito: apagar a anterior enquanto ela ainda pode estar rodando quebraria o app
aberto. Limpar as antigas é seguro com o acutis fechado:

```sh
ls ~/.acutis/runtime/app/                 # veja o que existe
rm -rf ~/.acutis/runtime/app/0.1.0        # apague as versões que não usa mais
```
