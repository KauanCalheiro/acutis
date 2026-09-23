import type { WalkthroughScene, WalkthroughStep } from '~/composables/walkthrough'

/** Os passos da apresentação do relatório agregado, um por card. */
export function reportWalkthroughSteps(): WalkthroughStep[] {
  return [
    {
      testid: 'relatorio-vazio',
      title: 'Nenhuma rodada ainda',
      body: 'O relatório nasce das rodadas: rode os cenários filtrados na tela do projeto, e cada rodada entra aqui com o resultado, a duração e os cenários que falharam.'
    },
    {
      testid: 'metrica-ultima',
      title: 'Última rodada',
      body: 'Rodada é uma execução em que vários cenários rodam juntos, como a do Rodar filtrados. O número diz quantos passaram na mais recente, com a data e a duração logo abaixo.'
    },
    {
      testid: 'metrica-sucesso-rodadas',
      title: 'Rodadas verdes',
      body: 'De todas as rodadas guardadas, quantas terminaram com todos os cenários passando. Basta um cenário falhar para a rodada inteira contar como vermelha.'
    },
    {
      testid: 'metrica-sucesso-cenarios',
      title: 'Cenários verdes',
      body: 'A mesma conta feita por cenário executado, somando todas as rodadas. Abaixo, quantos steps rodaram e a média por cenário.'
    },
    {
      testid: 'metrica-duracao',
      title: 'Duração média',
      body: 'Quanto uma rodada leva, em média, do começo ao fim. Ajuda a perceber quando a suíte começou a ficar lenta. Abaixo, a rodada mais longa.'
    },
    {
      testid: 'metrica-instaveis',
      title: 'Cenários instáveis',
      body: 'Os que passaram numa rodada e falharam em outra sem ninguém mexer neles. Mesmo com o último resultado verde, esse teste não é confiável.'
    },
    {
      testid: 'relatorio-resultado',
      title: 'Resultado das rodadas',
      body: 'Uma coluna por rodada, da mais antiga para a mais recente: em verde os cenários que passaram, em vermelho os que falharam.'
    },
    {
      testid: 'relatorio-duracao',
      title: 'Duração das rodadas',
      body: 'Quanto cada rodada levou, na ordem em que rodaram. Uma subida contínua é a suíte ficando lenta.'
    },
    {
      testid: 'relatorio-ranking-falhas',
      title: 'Cenários que mais falham',
      body: 'Os cenários com mais falhas nas rodadas guardadas. É por onde começar a investigar.'
    },
    {
      testid: 'relatorio-ranking-lentos',
      title: 'Cenários mais lentos',
      body: 'Os cenários que mais demoram, pela duração média. Bons candidatos para otimizar.'
    },
    {
      testid: 'relatorio-matriz',
      title: 'Histórico por cenário',
      body: 'Uma linha por cenário e uma célula por rodada: verde passou, vermelho falhou, cinza ficou de fora. Verde e vermelho se alternando na mesma linha é sinal de instabilidade.'
    },
    {
      testid: 'relatorio-execucao',
      title: 'Execuções',
      body: 'Cada rodada guardada, da mais recente para a mais antiga, com quantos passaram e quanto levou. Clique numa para abrir o detalhe dela.'
    },
    {
      testid: 'relatorio-playwright',
      side: 'left',
      title: 'Relatório do Playwright',
      body: 'Abre o relatório do próprio Playwright, com vídeo e trace de cada passo. Ele guarda só a rodada mais recente, a primeira da lista.'
    }
  ]
}

/** Os passos da apresentação de uma rodada individual, um por card. */
export function runWalkthroughSteps(): WalkthroughStep[] {
  return [
    {
      testid: 'execucao-status',
      title: 'Resultado da rodada',
      body: 'Sucesso quando todos os cenários passaram. Senão, quantos falharam.'
    },
    {
      testid: 'execucao-contexto',
      title: 'O que rodou',
      body: 'O projeto, o que entrou na rodada (o projeto inteiro ou um filtro, que aparece ao passar o mouse), a branch e quem rodou.'
    },
    {
      testid: 'metrica-cenarios',
      title: 'Cenários',
      body: 'Quantos passaram entre os que rodaram nesta rodada. Abaixo, quantos falharam.'
    },
    {
      testid: 'metrica-sucesso',
      title: 'Sucesso',
      body: 'A mesma conta dos cenários, em porcentagem.'
    },
    {
      testid: 'metrica-duracao',
      title: 'Duração',
      body: 'Quanto a rodada levou do começo ao fim. Abaixo, a diferença para a rodada anterior.'
    },
    {
      testid: 'metrica-steps',
      title: 'Steps',
      body: 'Step é cada passo dentro de um cenário, como abrir a tela, preencher um campo ou conferir um resultado. Abaixo, a média por cenário.'
    },
    {
      testid: 'metrica-mais-lento',
      title: 'Mais lento',
      body: 'O cenário que mais demorou nesta rodada, e quanto levou.'
    },
    {
      testid: 'execucao-quebras',
      title: 'O que quebrou',
      body: 'Cada cenário que falhou, com o passo em que parou. O link abre o erro e o vídeo daquela execução.'
    },
    {
      testid: 'execucao-donut-resultado',
      title: 'Resultado dos cenários',
      body: 'A proporção entre os cenários que passaram e os que falharam.'
    },
    {
      testid: 'execucao-donut-tempo',
      title: 'Onde o tempo foi gasto',
      body: 'Como o tempo total se divide: os quatro cenários mais demorados e o resto somado.'
    },
    {
      testid: 'execucao-tempo',
      title: 'Duração por cenário',
      body: 'Todos os cenários do mais lento ao mais rápido, com quanto levaram e a fatia do tempo total de cada um.'
    },
    {
      testid: 'execucao-comparacao',
      title: 'Contra a rodada anterior',
      body: 'Quanto tempo a mais ou a menos que a rodada anterior, e quais cenários quebraram, voltaram a passar, entraram ou saíram.'
    },
    {
      testid: 'execucao-cenarios',
      side: 'top',
      title: 'Cenários da rodada',
      body: 'A tabela completa, do mais lento ao mais rápido: status, steps, duração, fatia do tempo e, nos que falharam, o passo que quebrou com o link para a execução.'
    },
    {
      testid: 'execucao-playwright',
      side: 'left',
      title: 'Relatório do Playwright',
      body: 'Abre o relatório do próprio Playwright, com vídeo e trace de cada passo. Só aparece na rodada mais recente, a única que ele guarda.'
    }
  ]
}

type ScenarioTab = 'eventos' | 'gherkin' | 'playwright' | 'execucoes'

interface ScenarioTabsScenes {
  tabs: WalkthroughScene
  showTab: (tab: ScenarioTab) => void
  hasGherkin: () => boolean
}

/** Os passos que percorrem as abas de um cenário, trocando a aba a cada passo. */
function scenarioTabsSteps(scenes: ScenarioTabsScenes): WalkthroughStep[] {
  return [
    {
      testid: [
        'cenario-eventos',
        'cenario-eventos-vazio'
      ],
      scene: scenes.tabs,
      enter: () => scenes.showTab('eventos'),
      title: 'Eventos gravados',
      body: 'Cada passo que você fez na gravação e, quando houver, o vídeo dela. Dá para retomar a gravação a partir de um passo: os seguintes são descartados e você continua dali.'
    },
    {
      testid: 'cenario-gherkin',
      scene: scenes.tabs,
      enter: () => scenes.showTab('gherkin'),
      when: scenes.hasGherkin,
      title: 'O cenário em Gherkin',
      body: 'A descrição em linguagem natural do que o teste verifica, escrita pela IA na revisão da gravação.'
    },
    {
      testid: [
        'cenario-playwright',
        'cenario-playwright-vazio'
      ],
      scene: scenes.tabs,
      enter: () => scenes.showTab('playwright'),
      title: 'O script',
      body: 'O teste Playwright gerado, exatamente o arquivo que roda.'
    },
    {
      testid: [
        'execucoes-busca',
        'cenario-execucoes-vazio'
      ],
      scene: scenes.tabs,
      enter: () => scenes.showTab('execucoes'),
      title: 'Execuções',
      body: 'O histórico de cada vez que ele rodou. Filtre por data e status, e abra uma execução para ver vídeo e saída.'
    }
  ]
}

/** Os passos da apresentação de um cenário gravado. */
export function scenarioWalkthroughSteps(scenes: ScenarioTabsScenes): WalkthroughStep[] {
  return [
    {
      testid: 'cenario-titulo',
      title: 'Este é o cenário',
      body: 'O título e, abaixo, o arquivo .spec.ts que ele virou. As tags (@read, @write, domínio) são as mesmas que a busca do projeto usa para filtrar.'
    },
    {
      testid: 'cenario-testar',
      title: 'Testar',
      body: 'Roda só este cenário e mostra passo a passo, com vídeo e a saída do Playwright. Se falhar e houver IA configurada, dá para pedir que ela corrija o teste.'
    },
    {
      testid: 'cenario-sugestoes',
      title: 'Ver sugestões',
      body: 'A IA aponta os elementos gravados que não têm data-testid e sugere onde colocar no seu código, para o teste não quebrar quando o layout mudar. Precisa de IA configurada.'
    },
    {
      testid: 'cenario-pular',
      title: 'Pausar',
      body: 'Tira o cenário das execuções sem apagar nada. O Playwright pula ele até você voltar a rodar.'
    },
    {
      testid: 'cenario-editar',
      title: 'Editar',
      body: 'Ajusta à mão título, arquivo, domínio, tags, o Gherkin e o teste Playwright.'
    },
    {
      testid: 'cenario-excluir',
      title: 'Excluir',
      body: 'Apaga o teste, a feature e os eventos gravados. Pede confirmação antes.'
    },
    ...scenarioTabsSteps(scenes)
  ]
}

interface AuthWalkthroughScenes extends ScenarioTabsScenes {
  written: () => boolean
}

/** Os passos da apresentação da autenticação do projeto, gravada ou ainda por gravar. */
export function authWalkthroughSteps(scenes: AuthWalkthroughScenes): WalkthroughStep[] {
  return [
    {
      testid: 'auth-gravar-vazio',
      title: 'Grave o login',
      body: 'Abre o navegador para você entrar no sistema uma vez, normalmente. A IA transforma essa gravação no teste de login, e os cenários seguintes já gravam autenticados. A senha fica no .env do projeto, nesta máquina, nunca no script.'
    },
    {
      testid: 'auth-dispensar',
      title: 'Não precisa de login',
      body: 'Se o sistema não tem login, avise aqui e os cenários gravam sem autenticação.'
    },
    {
      testid: 'cenario-auth-status',
      title: 'Esta é a autenticação',
      body: 'O login que todo cenário autenticado roda antes de começar. O selo mostra o estado dele: configurada, falhando ou dispensada.'
    },
    {
      testid: 'auth-gravar',
      title: 'Gravar novamente',
      body: 'Regrava o login do zero. Use quando a tela de login do sistema mudar ou o teste parar de entrar.'
    },
    {
      testid: 'cenario-editar',
      title: 'Editar',
      body: 'Ajusta à mão o teste de login que a IA escreveu.'
    },
    {
      testid: 'cenario-testar',
      title: 'Testar',
      body: 'Roda o login e confirma que ele entra no sistema. Se faltar usuário ou senha, a tela pede antes de rodar. Eles ficam no .env do projeto, nesta máquina, nunca no script.'
    },
    ...scenarioTabsSteps(scenes).map(step => ({
      ...step,
      when: () => scenes.written() && (step.when?.() ?? true)
    }))
  ]
}

interface ProjectWalkthroughScenes {
  environments: WalkthroughScene
  showVariablesTab: () => void
  showSelectorsTab: () => void
  hasScenarios: () => boolean
}

/** Os passos da apresentação da tela de um projeto. */
export function projectWalkthroughSteps(scenes: ProjectWalkthroughScenes): WalkthroughStep[] {
  return [
    {
      testid: 'projeto-origem',
      title: 'Este é o projeto',
      body: 'O nome é editável: clique nele para renomear. Abaixo ficam a pasta onde os testes moram e, em projeto importado do Git, a branch.'
    },
    {
      testid: [
        'projeto-ambiente-ativo',
        'projeto-ambiente-nome'
      ],
      title: 'Ambientes',
      body: 'Cada ambiente diz contra o que os cenários rodam, como desenvolvimento, homologação e produção. Com mais de um, é aqui que você troca o ativo.'
    },
    {
      testid: 'ambientes-descricao',
      scene: scenes.environments,
      enter: scenes.showVariablesTab,
      title: 'Variáveis do ambiente',
      body: 'Cada ambiente guarda os próprios valores para as mesmas variáveis, como a URL do sistema e o usuário e a senha do login. Valor marcado como segredo só fica escondido na tela. Os arquivos ficam fora do git, então cada máquina tem os seus.'
    },
    {
      testid: 'seletores-descricao',
      scene: scenes.environments,
      enter: scenes.showSelectorsTab,
      title: 'Prioridade de seletores',
      body: 'A lista é a ordem em que a gravação tenta achar cada elemento, e ela fica com o primeiro que o elemento tiver. Arraste para subir o que a sua aplicação escreve à mão, como o data-testid, e descer o que ela gera sozinha. Vale só para este projeto.'
    },
    {
      testid: 'projeto-auth',
      title: 'Autenticação',
      body: 'Grave o login uma vez, e todo cenário autenticado roda esse login antes. A cor mostra o estado: verde funcionando, vermelho falhando, neutro sem login.'
    },
    {
      testid: 'cenario-novo',
      title: 'Novo cenário',
      body: 'Abre o navegador e grava o que você faz. Com login configurado, você escolhe entre autenticado e público (o público roda fora da sessão). Ao parar, a IA revisa a gravação e gera o teste.'
    },
    {
      testid: 'cenario-vazio-login',
      title: 'Comece pelo login',
      body: 'Sem cenário ainda, o primeiro passo é gravar o login: você entra no sistema uma vez e os próximos cenários já gravam autenticados. Se o sistema não tem login, é só avisar logo abaixo.'
    },
    {
      testid: 'cenario-vazio-gravar',
      title: 'Grave o primeiro cenário',
      body: 'Abre o navegador para você usar o sistema como sempre. O que você fizer vira um teste automático.'
    },
    {
      testid: 'cenario-busca',
      when: scenes.hasScenarios,
      title: 'Buscar cenário',
      body: 'Filtra os cenários pelo nome ou pela tag enquanto você digita.'
    },
    {
      testid: 'projeto-rodar-filtrados',
      when: scenes.hasScenarios,
      title: 'Rodar os filtrados',
      body: 'Roda de uma vez todos os cenários que a busca deixou na tela. Os pausados ficam de fora.'
    },
    {
      testid: 'cenario-card',
      title: 'Cada card é um cenário',
      body: 'Clique para abrir os eventos gravados e o código. No menu ⋮ você roda, pausa, edita, vê a última execução ou exclui.'
    },
    {
      testid: 'projeto-relatorio',
      title: 'Relatório das execuções',
      body: 'O histórico das rodadas: o que passou, o que falhou, o que está instável e o que está mais lento.'
    },
    {
      testid: 'projeto-vscode',
      title: 'Abrir no VS Code',
      body: 'Abre a pasta do projeto no editor. Um ponto amarelo ou vermelho aqui avisa que a sincronização com o Git precisa de atenção.'
    },
    {
      testid: 'projeto-remover',
      title: 'Remover projeto',
      body: 'Apaga a pasta e todos os testes dentro dela. Pede confirmação antes.'
    }
  ]
}

interface ProjectsWalkthroughScenes {
  createForm: WalkthroughScene
  settings: WalkthroughScene
  showTemplateTab: () => void
  showGitTab: () => void
}

/** Os passos da apresentação da lista de projetos, a primeira tela de quem abre o Acutis. */
export function projectsWalkthroughSteps(scenes: ProjectsWalkthroughScenes): WalkthroughStep[] {
  return [
    {
      testid: 'navbar-logo',
      side: 'right',
      title: 'Isto é o Acutis',
      body: 'Você navega pelo sistema que quer testar, o Acutis grava o que você fez e devolve um teste Playwright pronto para rodar. Projetos, testes e gravações ficam em pastas na sua máquina.'
    },
    {
      testid: 'projeto-adicionar',
      title: 'Tudo começa por um projeto',
      body: 'Um projeto é a pasta com os testes de um sistema. Há dois jeitos de criar, e cada um serve a uma situação.'
    },
    {
      testid: 'projeto-form-tab-template',
      scene: scenes.createForm,
      enter: scenes.showTemplateTab,
      title: 'Começar do zero',
      body: 'Cria a pasta já com o Playwright configurado, pedindo só um nome. É o caminho de quem ainda não tem nenhum teste escrito.'
    },
    {
      testid: 'projeto-form-tab-git',
      scene: scenes.createForm,
      enter: scenes.showGitTab,
      title: 'Importar de um Git',
      body: 'Clona um repositório que já existe e trabalha dentro dele. Cada cenário gravado, editado ou excluído vira um commit, e o Acutis sincroniza com o remoto sozinho.',
      items: [
        {
          term: 'Público',
          text: 'não pede nada. O Acutis descobre sozinho ao colar a URL.'
        },
        {
          term: 'Token',
          text: 'para repositório privado acessado por HTTPS.'
        },
        {
          term: 'Chave SSH',
          text: 'para repositório privado acessado por git@.'
        }
      ]
    },
    {
      testid: 'projeto-card',
      title: 'Cada card é um sistema',
      body: 'Entre no projeto para gravar cenários, rodar todos de uma vez e acompanhar o relatório das execuções.'
    },
    {
      testid: 'projeto-busca',
      title: 'Buscar projeto',
      body: 'Filtra a lista pelo nome enquanto você digita. Ajuda quando a tela já tem muitos projetos.'
    },
    {
      testid: 'navbar-projetos',
      side: 'right',
      title: 'A barra lateral vai junto',
      body: 'Ela aparece em todas as telas. Este ícone volta para a lista de projetos de onde você estiver.'
    },
    {
      testid: 'config-ia-provedor',
      scene: scenes.settings,
      title: 'Configurações: inteligência artificial',
      body: 'Gravar e rodar testes funciona sem IA nenhuma. O modelo entra para descrever o cenário em Gherkin, sugerir data-testid no seu código e consertar o teste que falhou. A escolha vale para o Acutis inteiro, não para um projeto.'
    },
    {
      testid: 'config-ia-provedor',
      scene: scenes.settings,
      title: 'Qual provedor escolher',
      body: 'Depois de escolher, o botão Testar confirma que o modelo responde antes de salvar.',
      items: [
        {
          term: 'Sem IA',
          text: 'grava e roda normalmente, só desliga o que depende de modelo.'
        },
        {
          term: 'Claude Agent e Codex',
          text: 'usam o CLI já instalado e logado nesta máquina, pela sua assinatura, sem chave de API.'
        },
        {
          term: 'Anthropic, OpenAI, Google Gemini e OpenRouter',
          text: 'pedem uma chave de API e cobram por uso.'
        },
        {
          term: 'Ollama',
          text: 'roda o modelo na sua máquina, sem chave.'
        }
      ]
    },
    {
      testid: 'navbar-cor',
      side: 'right',
      title: 'Cor da ferramenta',
      body: 'Troca a cor principal da interface, inclusive a do ícone na aba do navegador. A escolha fica guardada neste navegador.'
    },
    {
      testid: 'navbar-tema',
      side: 'right',
      title: 'Claro ou escuro',
      body: 'Alterna o tema da interface. Ele começa seguindo o tema do sistema.'
    },
    {
      testid: 'navbar-apresentacao',
      side: 'right',
      title: 'Pronto para começar',
      body: 'Crie o primeiro projeto e grave um cenário. Quando quiser rever esta apresentação, é por este botão.'
    }
  ]
}
