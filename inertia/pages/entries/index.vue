<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileSpreadsheet,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-vue-next'
import type { Data } from '@generated/data'
import Page from '~/components/page.vue'
import AppLayout from '~/layouts/app.vue'
import ConfirmDialog from '~/components/confirm_dialog.vue'
import ExportDialog from '~/components/export_dialog.vue'
import { formatDate, formatNumber } from '~/lib/format'

type Filters = {
  sort: string
  order: 'asc' | 'desc'
  entrepot: number | null
  from: string | null
  to: string | null
  fournisseur: string | null
  statut: string | null
  q: string | null
}

const props = defineProps<{
  entries: Data.Entry[]
  meta: { total: number; perPage: number; currentPage: number; lastPage: number }
  totals: { count: number; qteRecue: number }
  filters: Filters
  options: { entrepots: number[]; statuts: string[] }
}>()

/**
 * Filter form state. Text inputs reload the list after a short pause;
 * selects and dates reload immediately.
 */
const form = reactive({
  entrepot: props.filters.entrepot ? String(props.filters.entrepot) : '',
  from: props.filters.from ?? '',
  to: props.filters.to ?? '',
  fournisseur: props.filters.fournisseur ?? '',
  statut: props.filters.statut ?? '',
  q: props.filters.q ?? '',
})

function load(overrides: Record<string, string | number | null> = {}) {
  const params: Record<string, string | number> = {}
  const merged = {
    ...form,
    sort: props.filters.sort,
    order: props.filters.order,
    page: 1 as number | null,
    ...overrides,
  }
  for (const [key, value] of Object.entries(merged)) {
    if (value !== '' && value !== null && value !== undefined) params[key] = value
  }
  if (params.page === 1) delete params.page
  router.get('/entrees', params, { preserveState: true, preserveScroll: true, replace: true })
}

let debounce: ReturnType<typeof setTimeout> | undefined
watch(
  () => [form.q, form.fournisseur],
  () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => load(), 350)
  }
)
watch(
  () => [form.entrepot, form.from, form.to, form.statut],
  () => load()
)

const hasFilters = computed(
  () => !!(form.entrepot || form.from || form.to || form.fournisseur || form.statut || form.q)
)
function resetFilters() {
  Object.assign(form, { entrepot: '', from: '', to: '', fournisseur: '', statut: '', q: '' })
}

function sortBy(column: string) {
  const order =
    props.filters.sort === column ? (props.filters.order === 'asc' ? 'desc' : 'asc') : 'asc'
  load({ sort: column, order, page: 1 })
}

const columns: { key: string; label: string; sortable?: boolean; num?: boolean }[] = [
  { key: 'entrepot', label: 'Entrepôt', sortable: true },
  { key: 'numeroOrdre', label: 'N° ordre', sortable: true },
  { key: 'dateReception', label: 'Date réception', sortable: true },
  { key: 'codeArticle', label: 'Code article', sortable: true },
  { key: 'designation', label: 'Désignation' },
  { key: 'fournisseur', label: 'Fournisseur', sortable: true },
  { key: 'numeroBl', label: 'N° BL' },
  { key: 'numeroMarche', label: 'N° marché', sortable: true },
  { key: 'qteBl', label: 'Qté BL', num: true },
  { key: 'qteRecue', label: 'Qté reçue', sortable: true, num: true },
  { key: 'ecart', label: 'Écart', num: true },
  { key: 'zoneDest', label: 'Zone' },
  { key: 'quai', label: 'Quai', sortable: true },
  { key: 'statut', label: 'Statut', sortable: true },
  { key: 'matricule', label: 'Matricule' },
  { key: 'chauffeur', label: 'Chauffeur' },
  { key: 'telephone', label: 'Téléphone' },
  { key: 'transporteur', label: 'Transporteur' },
]

const pages = computed(() => {
  const { currentPage, lastPage } = props.meta
  const set = new Set([1, lastPage, currentPage - 1, currentPage, currentPage + 1])
  return [...set].filter((p) => p >= 1 && p <= lastPage).sort((a, b) => a - b)
})

function goTo(page: number) {
  load({ page })
}

/* --- delete --- */
const confirmRef = ref<InstanceType<typeof ConfirmDialog>>()
const toDelete = ref<Data.Entry | null>(null)
const deleting = ref(false)

function askDelete(entry: Data.Entry) {
  toDelete.value = entry
  confirmRef.value?.open()
}
function doDelete() {
  if (!toDelete.value) return
  deleting.value = true
  router.delete(`/entrees/${toDelete.value.id}`, {
    preserveScroll: true,
    onFinish: () => {
      deleting.value = false
      confirmRef.value?.close()
      toDelete.value = null
    },
  })
}

/* --- exports --- */
const stockRef = ref<InstanceType<typeof ExportDialog>>()
const ficheRef = ref<InstanceType<typeof ExportDialog>>()
const registreRef = ref<InstanceType<typeof ExportDialog>>()

function editUrl(entry: Data.Entry) {
  return `/entrees/${entry.id}/modifier`
}
function openEdit(entry: Data.Entry) {
  router.visit(editUrl(entry))
}
</script>

<template>
  <AppLayout>
    <Page title="Entrées" class="page--wide">
      <template #actions>
        <button type="button" class="btn btn--secondary" @click="stockRef?.open()">
          <FileSpreadsheet :size="16" /> Situation du stock
        </button>
        <button type="button" class="btn btn--secondary" @click="ficheRef?.open()">
          <FileSpreadsheet :size="16" /> Fiche d'entrée
        </button>
        <button type="button" class="btn btn--secondary" @click="registreRef?.open()">
          <FileSpreadsheet :size="16" /> Registre des entrées
        </button>
        <a
          href="/entrees/nouvelle"
          class="btn btn--primary"
          @click.prevent="router.visit('/entrees/nouvelle')"
        >
          <Plus :size="16" /> Nouvelle entrée
        </a>
      </template>

      <div class="filters">
        <div class="field">
          <label class="field__label" for="f-entrepot">Entrepôt</label>
          <select id="f-entrepot" v-model="form.entrepot" class="field__input field__input--sm">
            <option value="">Tous</option>
            <option v-for="e in options.entrepots" :key="e" :value="String(e)">
              Entrepôt {{ e }}
            </option>
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="f-from">Du</label>
          <input
            id="f-from"
            v-model="form.from"
            type="date"
            class="field__input field__input--sm"
          />
        </div>
        <div class="field">
          <label class="field__label" for="f-to">Au</label>
          <input id="f-to" v-model="form.to" type="date" class="field__input field__input--sm" />
        </div>
        <div class="field">
          <label class="field__label" for="f-fournisseur">Fournisseur</label>
          <input
            id="f-fournisseur"
            v-model="form.fournisseur"
            type="text"
            class="field__input field__input--sm"
            placeholder="Nom…"
          />
        </div>
        <div class="field">
          <label class="field__label" for="f-statut">Statut</label>
          <select id="f-statut" v-model="form.statut" class="field__input field__input--sm">
            <option value="">Tous</option>
            <option v-for="s in options.statuts" :key="s" :value="s">{{ s }}</option>
            <option value="none">Sans statut</option>
          </select>
        </div>
        <div class="field filters__search">
          <label class="field__label" for="f-q">Recherche</label>
          <input
            id="f-q"
            v-model="form.q"
            type="search"
            class="field__input field__input--sm"
            placeholder="BL, marché, matricule, chauffeur, CNE, téléphone…"
          />
        </div>
      </div>

      <div class="toolbar">
        <span>
          <strong>{{ formatNumber(totals.count) }}</strong> entrée{{
            totals.count > 1 ? 's' : ''
          }}
          · Qté reçue totale <strong>{{ formatNumber(totals.qteRecue) }}</strong>
        </span>
        <button
          v-if="hasFilters"
          type="button"
          class="btn btn--ghost btn--sm"
          @click="resetFilters"
        >
          <RotateCcw :size="14" /> Réinitialiser les filtres
        </button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th v-for="col in columns" :key="col.key" :class="{ num: col.num }" scope="col">
                <button
                  v-if="col.sortable"
                  type="button"
                  class="table__sort"
                  :data-active="filters.sort === col.key"
                  :aria-sort="
                    filters.sort === col.key
                      ? filters.order === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  "
                  @click="sortBy(col.key)"
                >
                  {{ col.label }}
                  <ArrowUp v-if="filters.sort === col.key && filters.order === 'asc'" :size="13" />
                  <ArrowDown v-else-if="filters.sort === col.key" :size="13" />
                  <ArrowUpDown v-else :size="13" :style="{ opacity: 0.4 }" />
                </button>
                <template v-else>{{ col.label }}</template>
              </th>
              <th class="table__actions" scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!entries.length">
              <td :colspan="columns.length + 1" class="table__empty">
                Aucune entrée{{ hasFilters ? ' pour ces filtres' : '' }}.
              </td>
            </tr>
            <tr v-for="entry in entries" :key="entry.id" @dblclick="openEdit(entry)">
              <td>
                <span v-if="entry.entrepot" class="badge badge--entrepot"
                  >E{{ entry.entrepot }}</span
                >
                <span v-else class="muted">—</span>
              </td>
              <td class="mono">{{ entry.numeroOrdre ?? '—' }}</td>
              <td>{{ formatDate(entry.dateReception) }}</td>
              <td class="mono">{{ entry.codeArticle ?? '—' }}</td>
              <td>{{ entry.designation ?? '—' }}</td>
              <td>{{ entry.fournisseur ?? '—' }}</td>
              <td class="mono">{{ entry.numeroBl ?? '—' }}</td>
              <td class="mono">{{ entry.numeroMarche ?? '—' }}</td>
              <td class="num">{{ formatNumber(entry.qteBl) }}</td>
              <td class="num">
                <strong>{{ formatNumber(entry.qteRecue) }}</strong>
              </td>
              <td
                class="num"
                :class="{
                  'ecart--neg': (entry.ecart ?? 0) < 0,
                  'ecart--pos': (entry.ecart ?? 0) > 0,
                }"
              >
                <template v-if="entry.ecart !== null">
                  {{ entry.ecart > 0 ? '+' : '' }}{{ formatNumber(entry.ecart) }}
                </template>
                <span v-else class="muted">—</span>
              </td>
              <td>{{ entry.zoneDest ?? '—' }}</td>
              <td>{{ entry.quai ?? '—' }}</td>
              <td>
                <span v-if="entry.statut" class="badge">{{ entry.statut }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="mono">{{ entry.matricule ?? '—' }}</td>
              <td>{{ entry.chauffeur ?? '—' }}</td>
              <td class="mono">{{ entry.telephone ?? '—' }}</td>
              <td>{{ entry.transporteur ?? '—' }}</td>
              <td class="table__actions">
                <div class="table__actions-inner">
                  <a
                    :href="editUrl(entry)"
                    class="iconbtn"
                    title="Modifier"
                    aria-label="Modifier"
                    @click.prevent="openEdit(entry)"
                  >
                    <Pencil :size="15" />
                  </a>
                  <button
                    type="button"
                    class="iconbtn"
                    title="Supprimer"
                    aria-label="Supprimer"
                    @click="askDelete(entry)"
                  >
                    <Trash2 :size="15" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="meta.lastPage > 1" class="pager">
        <span>Page {{ meta.currentPage }} sur {{ meta.lastPage }}</span>
        <div class="pager__pages">
          <button
            type="button"
            class="pager__btn"
            :disabled="meta.currentPage <= 1"
            @click="goTo(meta.currentPage - 1)"
          >
            ‹
          </button>
          <template v-for="(p, i) in pages" :key="p">
            <span
              v-if="i > 0 && p - pages[i - 1] > 1"
              class="pager__btn"
              :style="{ border: 'none' }"
              >…</span
            >
            <button
              type="button"
              class="pager__btn"
              :aria-current="p === meta.currentPage ? 'page' : undefined"
              @click="goTo(p)"
            >
              {{ p }}
            </button>
          </template>
          <button
            type="button"
            class="pager__btn"
            :disabled="meta.currentPage >= meta.lastPage"
            @click="goTo(meta.currentPage + 1)"
          >
            ›
          </button>
        </div>
      </div>
    </Page>

    <ConfirmDialog
      ref="confirmRef"
      title="Êtes-vous sûr ?"
      :message="
        toDelete
          ? `L'entrée N° ${toDelete.numeroOrdre ?? toDelete.id}${toDelete.entrepot ? ` (Entrepôt ${toDelete.entrepot})` : ''} du ${formatDate(toDelete.dateReception)} sera supprimée définitivement.`
          : undefined
      "
      confirm-label="Supprimer"
      :processing="deleting"
      @confirm="doDelete"
    />

    <ExportDialog
      ref="stockRef"
      title="Situation du stock"
      description="Quantités reçues par article et par entrepôt, plus une feuille avec le total de chaque article tous entrepôts confondus, jusqu'à la date choisie."
      date-label="Situation au"
      url="/exports/situation-stock"
    />
    <ExportDialog
      ref="ficheRef"
      title="Fiche d'entrée"
      description="Tous les déchargements d'une journée."
      date-label="Date de déchargement"
      url="/exports/fiche-entree"
      with-entrepot
      :entrepots="options.entrepots"
    />
    <ExportDialog
      ref="registreRef"
      title="Registre des entrées"
      description="Toutes les entrées, une feuille par entrepôt, comme le fichier Excel d'origine. Laissez « Du » vide pour tout reprendre depuis le début."
      from-label="Du"
      date-label="Au"
      url="/exports/registre"
    />
  </AppLayout>
</template>
