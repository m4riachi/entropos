<script setup lang="ts">
/**
 * Modal "are you sure?" dialog built on the native <dialog> element.
 * Call `open()` through a template ref; `confirm` fires on the
 * destructive button.
 */
import { ref } from 'vue'

withDefaults(
  defineProps<{
    title: string
    message?: string
    confirmLabel?: string
    processing?: boolean
  }>(),
  { message: undefined, confirmLabel: 'Confirmer', processing: false }
)
const emit = defineEmits<{ confirm: [] }>()

const dialog = ref<HTMLDialogElement>()

defineExpose({
  open: () => dialog.value?.showModal(),
  close: () => dialog.value?.close(),
})
</script>

<template>
  <dialog ref="dialog" class="dialog" @click.self="dialog?.close()">
    <h2 class="dialog__title">{{ title }}</h2>
    <p v-if="message" class="dialog__text">{{ message }}</p>
    <slot />
    <div class="dialog__actions">
      <button type="button" class="btn btn--secondary" @click="dialog?.close()">Annuler</button>
      <button
        type="button"
        class="btn btn--danger"
        :disabled="processing"
        autofocus
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </dialog>
</template>
