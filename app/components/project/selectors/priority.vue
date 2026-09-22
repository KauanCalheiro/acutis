<script setup lang="ts">
import { selectorKeySchema, type SelectorKey } from '#shared/contracts/project'

interface ProjectSelectorsPriority {
  slug: string
  selectors: SelectorKey[]
}

const { slug, selectors } = defineProps<ProjectSelectorsPriority>()

const emit = defineEmits<{
  saved: []
}>()

/** Como cada seletor gravado é chamado na tela, o que ele resolve e a forma que ele toma. */
const LABELS: Record<SelectorKey, { name: string, hint: string, example: string }> = {
  dataTestId: {
    name: 'data-testid',
    hint: 'O atributo que a aplicação escreve para teste.',
    example: '[data-testid="login-entrar"]'
  },
  dataCy: {
    name: 'data-cy',
    hint: 'O equivalente do Cypress.',
    example: '[data-cy="login-entrar"]'
  },
  ariaLabel: {
    name: 'aria-label',
    hint: 'O rótulo de acessibilidade do elemento.',
    example: '[aria-label="Entrar na conta"]'
  },
  placeholder: {
    name: 'placeholder',
    hint: 'O texto de exemplo dentro do campo.',
    example: '[placeholder="voce@exemplo.com"]'
  },
  cssStable: {
    name: 'CSS estável',
    hint: 'Pelo name do campo, escopado no ancestral quando repete.',
    example: 'form[name="login"] input[name="email"]'
  },
  id: {
    name: 'id',
    hint: 'O id do elemento, que alguns frameworks regeneram a cada carga.',
    example: '[id="email"]'
  },
  text: {
    name: 'Texto',
    hint: 'O texto visível, quando só um elemento da página o carrega.',
    example: 'text="Entrar"'
  },
  finder: {
    name: 'Caminho CSS',
    hint: 'O caminho montado a partir da estrutura da página.',
    example: 'main > form > button:nth-child(3)'
  },
  xpath: {
    name: 'XPath',
    hint: 'A posição do elemento na árvore, do topo até ele.',
    example: '/html[1]/body[1]/form[1]/button[1]'
  }
}

const DEFAULT_ORDER = selectorKeySchema.options

/** Quanto a lista leva para se acomodar, o mesmo da transição do CSS. */
const SETTLE_MS = 200

let vacated: { index: number, at: number } | null = null

const order = ref<SelectorKey[]>([...selectors])
const persisted = ref<SelectorKey[]>([...selectors])
const dragging = ref<number | null>(null)
const saving = ref(false)
const confirmingRestore = ref(false)
const notify = useNotify()

const changed = computed(() => order.value.join() !== DEFAULT_ORDER.join())

/**
 * A lista se acomoda enquanto o card passa por cima, e não só quando ele é solto. O vizinho que
 * acabou de ocupar a posição vaga desliza sob o cursor e pediria a troca de volta: enquanto a
 * acomodação corre, essa posição não conta.
 */
function move(to: number) {
  const from = dragging.value

  if (from === null || from === to) return
  if (vacated !== null && vacated.index === to && Date.now() - vacated.at < SETTLE_MS) return

  vacated = { index: from, at: Date.now() }

  const moved = [...order.value]

  moved.splice(to, 0, ...moved.splice(from, 1))
  order.value = moved
  dragging.value = to
}

/** O arrasto terminou: o que mudou vai para o disco sem o usuário pedir. */
function settle() {
  dragging.value = null

  if (order.value.join() !== persisted.value.join()) void save()
}

function restore() {
  if (!confirmingRestore.value) {
    confirmingRestore.value = true

    return
  }

  confirmingRestore.value = false
  order.value = [...DEFAULT_ORDER]

  void save()
}

/** O `drop` e o `dragend` chegam juntos, então a ordem já conta como salva antes da resposta. */
async function save() {
  const previous = [...persisted.value]

  persisted.value = [...order.value]
  saving.value = true

  try {
    await $fetch(`/api/projects/${slug}/selectors`, {
      method: 'PUT',
      body: { selectors: order.value }
    })

    notify.success('Prioridade salva')
    emit('saved')
  } catch (error) {
    persisted.value = previous
    order.value = [...previous]
    notify.failure(error, 'Não foi possível salvar a prioridade dos seletores.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p
      class="text-sm text-muted"
      data-testid="seletores-descricao"
    >
      A gravação tenta os seletores nesta ordem e fica com o primeiro que o elemento tiver. Suba o
      que a sua aplicação escreve à mão, desça o que ela gera sozinha.
    </p>

    <TransitionGroup
      tag="ol"
      name="card"
      class="flex flex-col gap-2"
    >
      <li
        v-for="(key, index) in order"
        :key="key"
        :data-testid="`seletores-item-${index}`"
        :data-key="key"
        :data-dragging="dragging === index ? 'true' : 'false'"
        draggable="true"
        class="card flex items-center gap-3 rounded-lg border border-default bg-elevated px-3 py-2 hover:bg-accented/75"
        @dragstart="dragging = index"
        @dragenter.prevent="move(index)"
        @dragover.prevent
        @drop.prevent="settle"
        @dragend="settle"
      >
        <UIcon
          name="i-ic-round-drag-indicator"
          class="size-5 shrink-0 cursor-grab text-dimmed"
          :data-testid="`seletores-handle-${index}`"
          aria-hidden="true"
        />
        <span class="w-5 shrink-0 text-sm text-dimmed tabular-nums">{{ index + 1 }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">
            {{ LABELS[key].name }}
          </p>
          <p class="truncate text-xs text-dimmed">
            {{ LABELS[key].hint }}
          </p>
          <code
            :data-testid="`seletores-exemplo-${index}`"
            class="mt-1 block truncate font-mono text-xs text-toned"
          >{{ LABELS[key].example }}</code>
        </div>
      </li>
    </TransitionGroup>

    <div
      v-if="changed"
      class="flex flex-wrap gap-2"
    >
      <UButton
        :label="confirmingRestore ? 'Confirmar a volta ao padrão' : 'Restaurar o padrão'"
        :color="confirmingRestore ? 'warning' : 'neutral'"
        :variant="confirmingRestore ? 'soft' : 'ghost'"
        :loading="saving"
        icon="i-ic-round-restore"
        data-testid="seletores-restaurar"
        @click="restore"
      />
    </div>
  </div>
</template>

<style scoped>
.card {
  transition: transform 200ms ease, box-shadow 200ms ease, opacity 200ms ease, background-color 150ms ease;
}

.card[data-dragging="true"] {
  opacity: 0.6;
  transform: scale(1.02);
  box-shadow: var(--ui-shadow-lg, 0 10px 20px -5px rgb(0 0 0 / 0.25));
}

.card-move {
  transition: transform 200ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .card-move {
    transition: none;
  }

  .card[data-dragging="true"] {
    transform: none;
  }
}
</style>
