# Instalar o acutis

Para quem vai **usar** o acutis. Nada precisa estar instalado antes: PHP, Node, Playwright e o
navegador vêm dentro do aplicativo.

Baixe o arquivo do seu sistema em
[Releases](https://github.com/KauanCalheiro/acutis/releases/latest):

| Sistema | Arquivo |
|---------|---------|
| macOS (Apple Silicon — M1 em diante) | `acutis_<versão>_aarch64.dmg` |
| Windows 10/11 (64 bits) | `acutis_<versão>_x64_en-US.msi` |
| Ubuntu 22.04+ e derivados | `acutis_<versão>_amd64.AppImage` ou `acutis_<versão>_amd64.deb` |

> **O primeiro boot demora alguns minutos.** O aplicativo está descompactando os próprios arquivos
> em `~/.acutis/runtime`. A janela só aparece no fim. Nas próximas vezes abre em segundos.

---

## macOS

1. Abra o `.dmg` e arraste o **acutis** para *Aplicativos*.
2. **Na primeira vez, não abra com dois cliques.** Clique com o botão direito sobre o acutis e
   escolha **Abrir**; na caixa que aparece, confirme em **Abrir**.

O passo 2 é necessário porque o aplicativo não é assinado com uma conta de desenvolvedor da Apple —
[a assinatura ainda não existe](DESKTOP.md#release). Dois cliques direto mostram *"não foi possível
verificar o desenvolvedor"* e não deixam continuar. Depois da primeira vez, abre normalmente.

Se aparecer **"O acutis está danificado e não pode ser aberto"**, o macOS pôs o arquivo em
quarentena no download. Remova a marca:

```sh
xattr -dr com.apple.quarantine /Applications/acutis.app
```

### Requisito

Não há. O `git` do sistema é usado quando existe; se não existir, o acutis funciona igual, só sem a
opção de importar projeto de um repositório — e a tela diz isso. Para tê-lo, instale as ferramentas
de linha de comando:

```sh
xcode-select --install
```

---

## Windows

1. Abra o `.msi` e siga o instalador.
2. O **SmartScreen** vai avisar que o aplicativo não é reconhecido: clique em **Mais informações** →
   **Executar assim mesmo**.

O aviso aparece porque o instalador não é assinado com certificado EV —
[mesma situação do macOS](DESKTOP.md#release).

### Requisito

Nenhum: o `git` vai dentro do instalador, e o **WebView2** já faz parte do Windows 11 e do Windows
10 atualizado. Se o aplicativo abrir e a janela ficar branca, instale o
[WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) e abra de novo.

---

## Ubuntu

### AppImage (funciona em qualquer distribuição)

```sh
chmod +x acutis_*_amd64.AppImage
./acutis_*_amd64.AppImage
```

### .deb (integra ao menu de aplicativos)

```sh
sudo apt install ./acutis_*_amd64.deb
```

### Requisito

A webview do sistema. No Ubuntu 22.04 e 24.04:

```sh
sudo apt install libwebkit2gtk-4.1-0
```

Sem ela o aplicativo não abre janela nenhuma. O `.deb` já declara essa dependência e a instala
sozinho; o `.AppImage` não.

---

## Onde ficam seus dados

Tudo em `~/.acutis` — no Windows, `C:\Users\<você>\.acutis`:

| Caminho | O que é |
|---------|---------|
| `~/.acutis/<projeto>/` | seus projetos: cenários, testes gerados, gravações |
| `~/.acutis/runtime/` | banco, configurações e os arquivos do próprio aplicativo |
| `~/.acutis/runtime/logs/` | logs dos três serviços — é o que interessa quando algo falha |

Desinstalar o aplicativo não apaga nada disso. Apagar `~/.acutis/runtime` faz o acutis se reinstalar
no próximo boot, **sem** perder os projetos.

## Se não abrir

A janela de erro do próprio acutis mostra o motivo e o caminho dos logs. Ao abrir um chamado, anexe
o conteúdo de `~/.acutis/runtime/logs/`.
