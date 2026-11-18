<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import { ArrowLeft, Save, SaveAll } from 'lucide-vue-next'
import type { Data } from '@generated/data'
import Page from '~/components/page.vue'
import AppLayout from '~/layouts/app.vue'
import { formatNumber, todayIso } from '~/lib/format'

type SuggestionKey =
  | 'codeArticle'
  | 'designation'
  | 'fournisseur'
  | 'numeroMarche'
  | 'zoneDest'
  | 'controleur'
  | 'depart'
  | 'destination'
  | 'transporteur'

const props = defineProps<{
  entry: Data.Entry | null
  /** The list with the filters it had when the form was opened. */
  backUrl: string
  options: { entrepots: number[]; statuts: string[]; quais: string[] }
  suggestions: Record<SuggestionKey, string[]>
  designationsByCode: Record<string, string>
  nextOrdre: Record<string, number>
  defaults: { destination: string }
}>()

const isEdit = computed(() => props.entry !== null)
const LAST_ENTREPOT_KEY = 'entropos:lastEntrepot'

function readLastEntrepot(): string {
  try {
    const value = window.localStorage.getItem(LAST_ENTREPOT_KEY)
    return value && props.options.entrepots.includes(Number(value)) ? value : '1'
  } catch {
    return '1'
  }
}
function saveLastEntrepot(value: string) {
  try {
    if (value) window.localStorage.setItem(LAST_ENTREPOT_KEY, value)
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

const str = (v: string | number | null | undefined) =>
  v === null || v === undefined ? '' : String(v)
const e = props.entry

/**
 * All inputs are kept as strings; `transform` turns empty strings into
 * null and quantities into numbers before sending.
 */
const form = useForm({
  entrepot: e ? str(e.entrepot) : '',
  numeroOrdre: str(e?.numeroOrdre),
  dateReception: e ? str(e.dateReception) : todayIso(),
  codeArticle: str(e?.codeArticle),
  designation: str(e?.designation),
  fournisseur: str(e?.fournisseur),
  numeroBl: str(e?.numeroBl),
  numeroMarche: str(e?.numeroMarche),
  numeroOrdreAffectation: str(e?.numeroOrdreAffectation),
  numeroLivraisonEntrante: str(e?.numeroLivraisonEntrante),
  qteBl: str(e?.qteBl),
  qteRecue: str(e?.qteRecue),
  zoneDest: str(e?.zoneDest),
  quai: str(e?.quai),
  statut: str(e?.statut),
  controleur: str(e?.controleur),
  matricule: str(e?.matricule),
  chauffeur: str(e?.chauffeur),
  cne: str(e?.cne),
  telephone: str(e?.telephone),
  depart: str(e?.depart),
  transporteur: str(e?.transporteur),
  destination: e ? str(e.destination) : props.defaults.destination,
})

/* --- N° ordre: next number of the selected entrepôt (new entries only) --- */
let autoOrdre = ''
function applyNextOrdre() {
  if (isEdit.value) return
  const next = form.entrepot ? String(props.nextOrdre[form.entrepot] ?? 1) : ''
  if (form.numeroOrdre === '' || form.numeroOrdre === autoOrdre) {
    form.numeroOrdre = next
  }
  autoOrdre = next
}

onMounted(() => {
  if (!isEdit.value) {
    form.entrepot = readLastEntrepot()
    applyNextOrdre()
  }
})
watch(
  () => form.entrepot,
  () => applyNextOrdre()
)

/* --- Désignation: pre-filled from a known code article when empty --- */
watch(
  () => form.codeArticle,
  (code) => {
    const known = props.designationsByCode[code.trim()]
    if (known && form.designation.trim() === '') form.designation = known
  }
)

const ecart = computed(() => {
  if (form.qteRecue === '' || form.qteBl === '') return null
  const recue = Number(form.qteRecue)
  const bl = Number(form.qteBl)
  return Number.isFinite(recue) && Number.isFinite(bl) ? recue - bl : null
})

function payload(data: Record<string, unknown>) {
  const out: Record<string, string | number | null> = {}
  for (const [key, value] of Object.entries(data)) {
    const v = typeof value === 'string' ? value.trim() : String(value ?? '')
    out[key] = v === '' ? null : v
  }
  for (const key of ['entrepot', 'qteBl', 'qteRecue']) {
    if (out[key] !== null) out[key] = Number(out[key])
  }
  return out
}

function submit(andNew = false) {
  saveLastEntrepot(form.entrepot)
  // Keep the typed values only when the server sends back validation errors;
  // after a successful "save and new" the page remounts with a fresh form.
  const options = { preserveScroll: 'errors' as const, preserveState: 'errors' as const }
  if (isEdit.value) {
    form.transform((data) => payload(data)).put(`/entrees/${props.entry!.id}`, options)
  } else {
    form.transform((data) => ({ ...payload(data), andNew })).post('/entrees', options)
  }
}

const errorCount = computed(() => Object.keys(form.errors).length)

/**
 * Loosely-typed views of the form for the fields rendered in a loop.
 */
const textFields = form as unknown as Record<string, string>
function fieldError(key: string): string | undefined {
  return (form.errors as Record<string, string | undefined>)[key]
}

type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'number' | 'date' | 'tel'
  list?: SuggestionKey
  mono?: boolean
  inputmode?: 'numeric' | 'text' | 'tel'
}

const sections: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Marchandise',
    fields: [
      { key: 'codeArticle', label: 'Code article', list: 'codeArticle', mono: true },
      { key: 'designation', label: 'Désignation', list: 'designation' },
      { key: 'fournisseur', label: 'Fournisseur', list: 'fournisseur' },
      { key: 'numeroBl', label: 'N° BL', mono: true },
      { key: 'numeroMarche', label: 'N° marché', list: 'numeroMarche', mono: true },
      { key: 'numeroOrdreAffectation', label: "N° ordre d'affectation", mono: true },
      { key: 'numeroLivraisonEntrante', label: 'N° de livraison entrante', mono: true },
    ],
  },
  {
    title: 'Transport',
    fields: [
      { key: 'matricule', label: 'Matricule', mono: true },
      { key: 'chauffeur', label: 'Nom du chauffeur' },
      { key: 'cne', label: 'CNE', mono: true },
      { key: 'telephone', label: 'N° téléphone', type: 'tel', inputmode: 'tel', mono: true },
      { key: 'transporteur', label: 'Transporteur', list: 'transporteur' },
      { key: 'depart', label: 'Départ', list: 'depart' },
      { key: 'destination', label: 'Destination', list: 'destination' },
    ],
  },
]

function goBack() {
  router.visit(props.backUrl)
}
</script>

<template>
  <AppLayout>
    <Page
      :title="
        isEdit ? `Modifier l'entrée N° ${entry?.numeroOrdre ?? entry?.id}` : 'Nouvelle entrée'
      "
    >
      <template #actions>
        <a :href="backUrl" class="btn btn--secondary" @click.prevent="goBack">
          <ArrowLeft :size="16" /> Retour à la liste
        </a>
      </template>

      <form class="form-card" novalidate @submit.prevent="submit(false)">
        <!-- Réception -->
        <section class="form-section">
          <h2 class="form-section__title">Réception</h2>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="entrepot">Entrepôt</label>
              <select
                id="entrepot"
                v-model="form.entrepot"
                class="field__input"
                :aria-invalid="form.errors.entrepot ? 'true' : 'false'"
              >
                <option value="">—</option>
                <option v-for="opt in options.entrepots" :key="opt" :value="String(opt)">
                  Entrepôt {{ opt }}
                </option>
              </select>
              <span v-if="form.errors.entrepot" class="field__error">{{
                form.errors.entrepot
              }}</span>
            </div>

            <div class="field">
              <label class="field__label" for="numeroOrdre">N° ordre</label>
              <input
                id="numeroOrdre"
                v-model="form.numeroOrdre"
                type="text"
                class="field__input mono"
                :aria-invalid="form.errors.numeroOrdre ? 'true' : 'false'"
              />
              <span v-if="!isEdit && form.entrepot" class="field__hint">
                Prochain numéro de l'entrepôt {{ form.entrepot }} :
                {{ nextOrdre[form.entrepot] ?? 1 }}
              </span>
              <span v-if="form.errors.numeroOrdre" class="field__error">{{
                form.errors.numeroOrdre
              }}</span>
            </div>

            <div class="field">
              <label class="field__label" for="dateReception">Date réception</label>
              <input
                id="dateReception"
                v-model="form.dateReception"
                type="date"
                class="field__input"
                :aria-invalid="form.errors.dateReception ? 'true' : 'false'"
              />
              <span v-if="form.errors.dateReception" class="field__error">{{
                form.errors.dateReception
              }}</span>
            </div>

            <div class="field">
              <label class="field__label" for="statut">Statut commande</label>
              <select id="statut" v-model="form.statut" class="field__input">
                <option value="">—</option>
                <option v-for="opt in options.statuts" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <span v-if="form.errors.statut" class="field__error">{{ form.errors.statut }}</span>
            </div>

            <div class="field">
              <label class="field__label" for="quai">Quai attribué</label>
              <select id="quai" v-model="form.quai" class="field__input">
                <option value="">—</option>
                <option v-for="opt in options.quais" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <span v-if="form.errors.quai" class="field__error">{{ form.errors.quai }}</span>
            </div>

            <div class="field">
              <label class="field__label" for="zoneDest">Zone dest</label>
              <input
                id="zoneDest"
                v-model="form.zoneDest"
                list="dl-zoneDest"
                class="field__input mono"
              />
              <span v-if="form.errors.zoneDest" class="field__error">{{
                form.errors.zoneDest
              }}</span>
            </div>

            <div class="field">
              <label class="field__label" for="controleur">Contrôleur</label>
              <input
                id="controleur"
                v-model="form.controleur"
                list="dl-controleur"
                class="field__input"
              />
              <span v-if="form.errors.controleur" class="field__error">{{
                form.errors.controleur
              }}</span>
            </div>
          </div>
        </section>

        <section v-for="section in sections.slice(0, 1)" :key="section.title" class="form-section">
          <h2 class="form-section__title">{{ section.title }}</h2>
          <div class="form-grid">
            <div v-for="field in section.fields" :key="field.key" class="field">
              <label class="field__label" :for="field.key">{{ field.label }}</label>
              <input
                :id="field.key"
                v-model="textFields[field.key]"
                :type="field.type ?? 'text'"
                :list="field.list ? `dl-${field.list}` : undefined"
                :inputmode="field.inputmode"
                class="field__input"
                :class="{ mono: field.mono }"
                :aria-invalid="fieldError(field.key) ? 'true' : 'false'"
                autocomplete="off"
              />
              <span v-if="fieldError(field.key)" class="field__error">
                {{ fieldError(field.key) }}
              </span>
            </div>
          </div>
        </section>

        <!-- Quantités -->
        <section class="form-section">
          <h2 class="form-section__title">Quantités</h2>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="qteBl">Qté BL</label>
              <input
                id="qteBl"
                v-model="form.qteBl"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                class="field__input"
                :aria-invalid="form.errors.qteBl ? 'true' : 'false'"
              />
              <span class="field__hint">Quantité indiquée sur le bon de livraison</span>
              <span v-if="form.errors.qteBl" class="field__error">{{ form.errors.qteBl }}</span>
            </div>
            <div class="field">
              <label class="field__label" for="qteRecue">Qté reçue</label>
              <input
                id="qteRecue"
                v-model="form.qteRecue"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                class="field__input"
                :aria-invalid="form.errors.qteRecue ? 'true' : 'false'"
              />
              <span class="field__hint">Quantité comptée à la réception</span>
              <span v-if="form.errors.qteRecue" class="field__error">{{
                form.errors.qteRecue
              }}</span>
            </div>
            <div class="field">
              <span class="field__label">Écart réception (auto)</span>
              <div
                class="ecart-display"
                :class="{ 'ecart--neg': (ecart ?? 0) < 0, 'ecart--pos': (ecart ?? 0) > 0 }"
                aria-live="polite"
              >
                <template v-if="ecart !== null"
                  >{{ ecart > 0 ? '+' : '' }}{{ formatNumber(ecart) }}</template
                >
                <span v-else :style="{ color: 'var(--subtle)', fontWeight: 400 }">—</span>
              </div>
              <span class="field__hint">Qté reçue − Qté BL</span>
            </div>
          </div>
        </section>

        <section v-for="section in sections.slice(1)" :key="section.title" class="form-section">
          <h2 class="form-section__title">{{ section.title }}</h2>
          <div class="form-grid">
            <div v-for="field in section.fields" :key="field.key" class="field">
              <label class="field__label" :for="field.key">{{ field.label }}</label>
              <input
                :id="field.key"
                v-model="textFields[field.key]"
                :type="field.type ?? 'text'"
                :list="field.list ? `dl-${field.list}` : undefined"
                :inputmode="field.inputmode"
                class="field__input"
                :class="{ mono: field.mono }"
                :aria-invalid="fieldError(field.key) ? 'true' : 'false'"
                autocomplete="off"
              />
              <span v-if="fieldError(field.key)" class="field__error">
                {{ fieldError(field.key) }}
              </span>
            </div>
          </div>
        </section>

        <datalist v-for="(values, key) in suggestions" :id="`dl-${key}`" :key="key">
          <option v-for="v in values" :key="v" :value="v" />
        </datalist>

        <div class="form-actions">
          <span
            v-if="errorCount"
            class="field__error"
            :style="{ marginRight: 'auto', alignSelf: 'center' }"
          >
            Corrigez les champs en rouge.
          </span>
          <button type="button" class="btn btn--secondary" @click="goBack">Annuler</button>
          <button
            v-if="!isEdit"
            type="button"
            class="btn btn--secondary"
            :disabled="form.processing"
            @click="submit(true)"
          >
            <SaveAll :size="16" /> Enregistrer et nouvelle
          </button>
          <button type="submit" class="btn btn--primary" :disabled="form.processing">
            <Save :size="16" /> {{ form.processing ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </Page>
  </AppLayout>
</template>
