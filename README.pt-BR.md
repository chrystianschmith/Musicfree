<div align="center">
  <img src="assets/logo.svg" width="72" alt="" />
  <h1>Musicfree</h1>
  <p><b>Player de música para desktop, rápido e minimalista, para o YouTube Music.</b><br/>Experiência no estilo Spotify · app nativo e leve · Windows, macOS e Linux</p>

[![Download](https://img.shields.io/github/v/release/chrystianschmith/Musicfree?label=download)](https://github.com/chrystianschmith/Musicfree/releases/latest)

[Read in English](README.md)

<img src="docs/screenshots/home.png" alt="Tela inicial do Musicfree" width="860" />
</div>

## Funções

- **Recomendações conforme o que você escuta**: mix do dia, "Porque você ouviu…", "Voltar a ouvir" e seus artistas mais tocados, a partir de um perfil de escuta que fica só no seu computador (ouvir até o fim conta a favor, pular logo conta contra)
- **Fila infinita**: quando a fila acaba, músicas parecidas continuam tocando
- **Início**: filtros por clima, mixes, lançamentos e artistas do YouTube Music
- **Design fluido e ambiente**: o app inteiro ganha o tom da capa atual, com transições suaves e barra lateral recolhível
- **Busca** com sugestões enquanto você digita e abas para músicas, álbuns, artistas e playlists
- **Páginas de artista, álbum e playlist** com tocar, aleatório e iniciar rádio
- **Tocando agora** dentro do app: capa grande, **letra sincronizada** (clique num verso para pular até ele), fila e músicas relacionadas
- **Sua biblioteca**, salva no computador: curtidas, playlists (criar, renomear, reordenar arrastando), álbuns e artistas salvos, histórico
- **Fila**: tocar a seguir, adicionar à fila, reordenar, aleatório, repetir uma ou todas
- **Atalhos e teclas de mídia**: `Espaço`, `Ctrl+←/→`, `Ctrl+↑/↓`, `Ctrl+L` (letra), `Ctrl+K` ou `/` (busca), além das teclas de mídia e do painel de mídia do sistema
- **Continua de onde parou**: a última fila e a posição voltam quando você abre o app (pausado)
- Tudo roda **dentro do app**: sem abrir navegador, sem conta, sem anúncios

## Download

Baixe o instalador do seu sistema na **[versão mais recente](https://github.com/chrystianschmith/Musicfree/releases/latest)**:

| Sistema                       | Arquivo                          | Tamanho |
| ----------------------------- | -------------------------------- | ------- |
| Windows 10/11                 | `Musicfree_x.y.z_x64-setup.exe`  | ~4 MB   |
| macOS (Intel e Apple Silicon) | `Musicfree_x.y.z_universal.dmg`  | ~10 MB  |
| Linux (Debian/Ubuntu)         | `Musicfree_x.y.z_amd64.deb`      | ~5 MB   |
| Linux (qualquer distro)       | `Musicfree_x.y.z_amd64.AppImage` | ~80 MB  |

O AppImage é maior porque inclui o WebKit; os outros usam o navegador interno do sistema. Para atualizar, instale a versão nova por cima da antiga: sua biblioteca e suas configurações continuam.

Os instaladores **não têm assinatura digital**, então a primeira abertura pede um clique a mais:

- **Windows**: o SmartScreen mostra "O Windows protegeu o computador" → **Mais informações** → **Executar assim mesmo**.
- **macOS**: clique com o botão direito no app → **Abrir** → **Abrir**. Se aparecer que o app está danificado, rode `xattr -cr /Applications/Musicfree.app`.
- **Linux (AppImage)**: `chmod +x Musicfree_*.AppImage` e execute.

## Rodar a partir do código

Requisitos: Node 22+, pnpm 10+, Rust (stable) e os [pré-requisitos do Tauri](https://v2.tauri.app/start/prerequisites/) para o seu sistema.

```bash
git clone https://github.com/chrystianschmith/Musicfree.git
cd Musicfree
pnpm install

pnpm tauri dev      # app desktop com o YouTube Music de verdade
pnpm dev            # só a interface no navegador, com dados de demonstração
pnpm tauri build    # gera o instalador do seu sistema
```

Arquitetura, stack, comandos de teste, como publicar uma versão e estrutura do projeto estão no [README em inglês](README.md).

## Como funciona, em resumo

- **Músicas**: o app pede o áudio a vários clientes do YouTube e fica com o primeiro que o servidor realmente entrega. Para passar pela verificação anti-bot, ele roda dentro do app o mesmo script que o site do YouTube roda no navegador (BotGuard) e anexa o token gerado aos pedidos.
- **Recomendações**: um perfil de escuta salvo no seu computador. Músicas ouvidas até o fim e curtidas sobem, músicas puladas logo descem, e o que você ouviu há muito tempo vai perdendo peso. As músicas mais fortes viram rádios do YouTube Music, que alimentam o Início e a fila infinita.

## Problemas comuns

**A música não toca, para depois de mais ou menos um minuto ou o app pula para a próxima.** O YouTube muda as verificações anti-bot com frequência, e a reprodução depende de passar por elas. O app registra o que aconteceu com cada música num arquivo de log:

| Sistema | Pasta dos logs                                       |
| ------- | ---------------------------------------------------- |
| Windows | `%LOCALAPPDATA%\dev.chrystianschmith.musicfree\logs` |
| macOS   | `~/Library/Logs/dev.chrystianschmith.musicfree`      |
| Linux   | `~/.local/share/dev.chrystianschmith.musicfree/logs` |

As linhas que começam com `[stream]` e `[potoken]` mostram qual cliente do YouTube foi testado e o que o servidor respondeu. Anexe esse trecho ao [abrir uma issue](https://github.com/chrystianschmith/Musicfree/issues).

**Início ou busca vazios.** Confira a internet. Proxies corporativos e antivírus que inspecionam conexões HTTPS podem bloquear a API do YouTube.

**Sua biblioteca fica só no seu computador**, no arquivo `musicfree.db`: em `%APPDATA%\dev.chrystianschmith.musicfree` no Windows, `~/Library/Application Support/dev.chrystianschmith.musicfree` no macOS e `~/.config/dev.chrystianschmith.musicfree` no Linux. Desinstalar mantém o arquivo, a menos que você marque a opção de apagar os dados do app.

## Aviso

O Musicfree é um projeto não oficial, pessoal e educacional, sem vínculo com o YouTube ou o Google. Ele usa a API interna (InnerTube) do YouTube, o que os Termos de Serviço do YouTube não permitem para apps de terceiros. Use por sua conta e risco, apenas para uso pessoal. O projeto não é feito para ser publicado em lojas nem monetizado. Todas as músicas pertencem aos seus respectivos donos.

## Licença

[MIT](LICENSE) © 2026 Chrystian Schmith
