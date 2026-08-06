<script setup lang="ts">
// ponytail: rota de preview, o componente é puramente apresentacional (warnings via prop),
// então cada bloco só passa o prop direto, sem chamada de API.
const emptyVar = [
  'env-sem-valor: A variável TOKEN está declarada sem valor; preencha o ambiente ou o teste falha.'
]

const unfixable = [
  'url-absoluta: O arquivo monta uma URL absoluta. Toda navegação sai de process.env.URL, inclusive a primeira.'
]

const both = [
  ...emptyVar,
  ...unfixable,
  'seletor-fragil: O seletor .btn-primary depende de classe de estilo; grave um data-testid no elemento.'
]
</script>

<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-bold mb-1">
      Preview: ressalvas da geração
    </h1>
    <p class="text-sm text-muted mb-8">
      Mesmo componente do rascunho de cenário e da gravação de auth, com dado mocado.
    </p>

    <div class="flex flex-col gap-8">
      <div>
        <h2 class="text-sm font-semibold mb-2">
          Variável sem valor, a única ressalva que o usuário resolve
        </h2>
        <ScenarioWarnings
          :warnings="emptyVar"
          slug="alpha-store"
        />
      </div>

      <div>
        <h2 class="text-sm font-semibold mb-2">
          Ressalva que o Fixer tentou até o limite, sem ação do usuário
        </h2>
        <ScenarioWarnings
          :warnings="unfixable"
          slug="alpha-store"
        />
      </div>

      <div>
        <h2 class="text-sm font-semibold mb-2">
          Várias juntas
        </h2>
        <ScenarioWarnings
          :warnings="both"
          slug="alpha-store"
        />
      </div>

      <div>
        <h2 class="text-sm font-semibold mb-2">
          Sem ressalva, o componente não ocupa espaço
        </h2>
        <ScenarioWarnings slug="alpha-store" />
      </div>
    </div>
  </UContainer>
</template>
