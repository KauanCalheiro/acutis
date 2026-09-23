import type { WalkthroughScene, WalkthroughStep } from '~/composables/walkthrough'

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
