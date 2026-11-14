<script setup lang="ts">
/**
 * Download dialog for one of the two Excel exports. The file is fetched
 * with a plain link (not Inertia) so the browser downloads it.
 */
import { computed, ref } from 'vue'
import { FileSpreadsheet } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  description: string
  url: string
  dateLabel: string
  withEntrepot?: boolean
  entrepots?: number[]
}>()

function today() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const dialog = ref<HTMLDialogElement>()
const date = ref(today())
const entrepot = ref<string>('')

const href = computed(() => {
  const qs = new URLSearchParams()
  if (date.value) qs.set('date', date.value)
  if (props.withEntrepot && entrepot.value) qs.set('entrepot', entrepot.value)
  return `${props.url}?${qs.toString()}`
})

defineExpose({
  open: () => {
    date.value = today()
    dialog.value?.showModal()
  },
})
</script>

<template>
  <dialog ref="dialog" class="dialog" @click.self="dialog?.close()">
    <h2 class="dialog__title">{{ title }}</h2>
    <p class="dialog__text">{{ description }}</p>
    <div class="dialog__body">
      <div class="field">
        <label class="field__label" :for="`${url}-date`">{{ dateLabel }}</label>
        <input :id="`${url}-date`" v-model="date" type="date" class="field__input" />
      </div>
      <div v-if="withEntrepot" class="field">
        <label class="field__label" :for="`${url}-entrepot`">Entrepôt</label>
        <select :id="`${url}-entrepot`" v-model="entrepot" class="field__input">
          <option value="">Tous les entrepôts</option>
          <option v-for="e in entrepots" :key="e" :value="String(e)">Entrepôt {{ e }}</option>
        </select>
      </div>
    </div>
    <div class="dialog__actions">
      <button type="button" class="btn btn--secondary" @click="dialog?.close()">Fermer</button>
      <a :href="href" class="btn btn--primary" download @click="dialog?.close()">
        <FileSpreadsheet :size="16" /> Télécharger
      </a>
    </div>
  </dialog>
</template>
