---
name: frontend-feedback
description: Retorno de interação no frontend — sucesso e erro vão para toast (useToast), nunca alert inline, salvo pedido explícito
metadata:
  type: feedback
---

Toda mensagem de interação — salvou, criou, removeu, ativou, **e também o erro de validação vindo da API** — vai para um toast (`useToast()`). Nada de `UAlert` inline dentro de formulário ou modal.

**Why:** um lugar só para o retorno, sem cada tela inventar o seu. O `UApp` no `app.vue` já existe para isso, e o toast aparece igual venha de onde vier.

**How to apply:**

- Sucesso: `toast.add({ title, color: 'success', icon: 'i-ic-round-check-circle' })`
- Erro: mesma chamada com `color: 'error'` e o texto de `extractServerError(err, fallback)`
- Posição é global (`<UApp :toaster="{ position: 'top-center' }">`), não passar por chamada
- `UAlert` inline só quando o usuário pedir explicitamente para aquela tela

## Gotcha: toast dentro de modal

Funciona — renderiza por cima do backdrop —, mas o `UModal` marca o resto da página como `aria-hidden`, então `page.getByRole('status')` **não acha** o toast no E2E. Afirmar pelo texto: `expect(page.getByText('Ambiente salvo', { exact: true })).toBeVisible()`. O `exact: true` evita casar com o `<span>` de anúncio aria-live que o Nuxt UI renderiza junto.
