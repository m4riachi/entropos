<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import { ArrowLeft, Save, SaveAll, ScanLine } from 'lucide-vue-next'
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

/* --- Bon de livraison: read with Claude to pre-fill a new entry --- */
type BlArticle = { codeArticle: string | null; designation: string | null; quantite: number | null }
type BlExtraction = {
  fields: Record<string, string | null>
  articles: BlArticle[]
  remarques: string | null
}

const reading = ref(false)
const blError = ref<string | null>(null)
const blResult = ref<{ filled: number; articles: BlArticle[]; remarques: string | null } | null>(
  null
)
const activeArticle = ref(0)
/** Fields last filled from the BL, highlighted until the user edits them. */
const fromBl = ref(new Set<string>())

function xsrfToken() {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

/**
 * Phone photos are often 5–15 MB: shrink images to 2000 px / JPEG before
 * upload (the API takes up to 5 MB per image). PDFs are sent as they are.
 */
async function prepareUpload(file: File): Promise<{ blob: Blob; name: string }> {
  if (file.type === 'application/pdf' || !file.type.startsWith('image/')) {
    return { blob: file, name: file.name }
  }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 3_000_000 && file.type !== 'image/heic') {
      return { blob: file, name: file.name }
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    )
    if (!blob) return { blob: file, name: file.name }
    return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' }
  } catch {
    // The browser cannot decode it: let the server reject or accept it.
    return { blob: file, name: file.name }
  }
}

function applyArticle(index: number) {
  const article = blResult.value?.articles[index]
  if (!article) return
  activeArticle.value = index
  const values: Record<string, string> = {
    codeArticle: article.codeArticle ?? '',
    designation: article.designation ?? '',
    qteBl: article.quantite === null ? '' : String(article.quantite),
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === '') continue
    textFields[key] = value
    fromBl.value.add(key)
  }
}

async function readBl(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  reading.value = true
  blError.value = null
  try {
    const { blob, name } = await prepareUpload(file)
    const body = new FormData()
    body.append('bon', blob, name)
    const res = await fetch('/entrees/lecture-bl', {
      method: 'POST',
      body,
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': xsrfToken() },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      blError.value =
        data?.message ??
        data?.errors?.[0]?.message ??
        'La lecture du BL a échoué. Rechargez la page et réessayez.'
      return
    }

    const result = data as BlExtraction
    fromBl.value = new Set()
    for (const [key, value] of Object.entries(result.fields)) {
      if (value === null || value.trim() === '' || !(key in textFields)) continue
      textFields[key] = value.trim()
      fromBl.value.add(key)
    }
    const articles = result.articles.filter((a) => a.codeArticle || a.designation || a.quantite)
    blResult.value = { filled: 0, articles, remarques: result.remarques }
    applyArticle(0)
    blResult.value.filled = fromBl.value.size
  } catch {
    blError.value = 'Connexion impossible. Vérifiez le réseau et réessayez.'
  } finally {
    reading.value = false
  }
}

function clearFromBl(key: string) {
  if (fromBl.value.has(key)) fromBl.value.delete(key)
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
        <!-- Bon de livraison: pre-fill from a photo or PDF (new entries) -->
        <section v-if="!isEdit" class="form-section bl-import">
          <div class="bl-import__head">
            <div>
              <h2 class="form-section__title">Bon de livraison</h2>
              <p class="bl-import__text">
                Importez une photo ou un PDF du BL : les informations lues remplissent le
                formulaire. Vérifiez-les avant d'enregistrer.
              </p>
            </div>
            <label class="btn btn--secondary bl-import__button" :aria-disabled="reading">
              <ScanLine :size="16" />
              {{
                reading ? 'Lecture du BL…' : blResult ? 'Importer un autre BL' : 'Importer un BL'
              }}
              <input
                type="file"
                accept="image/*,application/pdf"
                class="sr-only"
                :disabled="reading"
                @change="readBl"
              />
            </label>
          </div>

          <p v-if="reading" class="bl-import__status" aria-live="polite">
            Lecture en cours, cela peut prendre quelques secondes…
          </p>
          <p v-else-if="blError" class="field__error" role="alert">{{ blError }}</p>
          <div v-else-if="blResult" class="bl-import__status" aria-live="polite">
            <p>
              <strong>{{ blResult.filled }} champ{{ blResult.filled > 1 ? 's' : '' }}</strong>
              rempli{{ blResult.filled > 1 ? 's' : '' }} depuis le BL (surlignés). Complétez
              l'entrepôt et la quantité reçue.
            </p>
            <p v-if="blResult.remarques" class="bl-import__remark">{{ blResult.remarques }}</p>
            <div v-if="blResult.articles.length > 1" class="bl-import__articles">
              <p>Le BL contient {{ blResult.articles.length }} articles. Article utilisé :</p>
              <div class="bl-import__choices">
                <button
                  v-for="(article, index) in blResult.articles"
                  :key="index"
                  type="button"
                  class="btn btn--secondary btn--sm"
                  :aria-pressed="index === activeArticle"
                  @click="applyArticle(index)"
                >
                  {{ article.codeArticle ?? '' }} {{ article.designation ?? '' }}
                  <template v-if="article.quantite !== null">— {{ article.quantite }}</template>
                </button>
              </div>
            </div>
          </div>
        </section>

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
            <div
              v-for="field in section.fields"
              :key="field.key"
              class="field"
              :class="{ 'field--from-bl': fromBl.has(field.key) }"
            >
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
                @input="clearFromBl(field.key)"
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
            <div class="field" :class="{ 'field--from-bl': fromBl.has('qteBl') }">
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
                @input="clearFromBl('qteBl')"
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
            <div
              v-for="field in section.fields"
              :key="field.key"
              class="field"
              :class="{ 'field--from-bl': fromBl.has(field.key) }"
            >
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
                @input="clearFromBl(field.key)"
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
