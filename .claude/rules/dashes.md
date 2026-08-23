**Nunca** usar `—` (travessão) nem `" - "` (hífen cercado de espaços) como separador de frase. Vale para todo texto que eu escreva: copy de interface, mensagem de erro, prompt de agente de IA, arquivo de memória, mensagem de commit, descrição de PR e resposta ao usuário.

**Why:** vira muleta. A frase que precisa de travessão quase sempre está pedindo duas frases, uma vírgula ou dois-pontos, e o texto fica mais direto sem ele.

**How to apply:** escolher a pontuação que a frase realmente pede, nunca trocar um traço por outro.

| ❌ | ✅ |
|---|---|
| `Os arquivos ficam fora do git — cada máquina tem os seus.` | `Os arquivos ficam fora do git, então cada máquina tem os seus.` |
| `Repositório público — sem autenticação` | `Repositório público, sem autenticação` |
| `secret é só máscara — não muda onde guarda` | `secret é só máscara: não muda onde guarda` |
| `Rode o cenário em Testar — cada execução fica registrada` | `Rode o cenário em Testar. Cada execução fica registrada.` |

Hífen dentro de palavra composta (`dois-pontos`, `pré-requisito`), em flag de CLI (`--dirty`) e em operação aritmética continua normal. Marcador de lista markdown no início da linha também.
