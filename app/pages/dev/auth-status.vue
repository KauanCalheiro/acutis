<script setup lang="ts">
// ponytail: rota de preview, o badge é apresentacional (status via prop), então basta variar o prop.
const states = [
  {
    status: 'configured',
    when: 'O login foi gravado e a última execução dele passou.'
  },
  {
    status: 'failing',
    when: 'O arquivo existe, mas a última execução do login falhou. Todo cenário do projeto roda o login antes, então falham junto.'
  },
  {
    status: 'skipped',
    when: 'O projeto foi marcado como sem login, pelo "Não precisa de login". Gravar um login desfaz isso sozinho.'
  },
  {
    status: 'unset',
    when: 'Nunca foi configurado. Não rende badge: quem conta o estado é o convite a gravar, logo abaixo na tela.'
  }
]
</script>

<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-bold mb-1">
      Preview: estado da autenticação
    </h1>
    <p class="text-sm text-muted mb-8">
      Mesmo badge do cabeçalho da tela de cenário, ao lado do badge de origem. Só aparece no cenário
      de autenticação.
    </p>

    <div class="flex flex-col gap-6">
      <div
        v-for="state in states"
        :key="state.status"
      >
        <div class="flex items-center gap-2">
          <UBadge
            icon="i-ic-round-computer"
            label="Local"
          />
          <ScenarioAuthStatus :status="state.status" />
          <code class="text-xs text-dimmed">{{ state.status }}</code>
        </div>
        <p class="mt-1 text-sm text-muted">
          {{ state.when }}
        </p>
      </div>
    </div>

    <p class="mt-10 text-sm text-muted">
      O atalho "Não precisa de login" vive no estado vazio da mesma tela, abaixo de "Gravar login",
      e só aparece em <code>unset</code>.
    </p>
  </UContainer>
</template>
