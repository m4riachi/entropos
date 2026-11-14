import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Entry from '#models/entry'
import { DEFAULT_DESTINATION, QUAIS } from '#constants/entries'

export const IMPORT_SOURCE = 'excel-origine'

type Attrs = {
  entrepot: number
  numeroOrdre: string | null
  dateReception: DateTime | null
  codeArticle: string | null
  designation: string | null
  fournisseur: string | null
  numeroBl: string | null
  numeroMarche: string | null
  numeroOrdreAffectation: string | null
  numeroLivraisonEntrante: string | null
  qteBl: number | null
  qteRecue: number | null
  zoneDest: string | null
  quai: string | null
  statut: string | null
  controleur: string | null
  matricule: string | null
  chauffeur: string | null
  cne: string | null
  telephone: string | null
  depart: string | null
  destination: string | null
  transporteur: string | null
  importSource: string
}

type Column = keyof Attrs | 'ecart'

/**
 * Header text (normalised) → field. Matched with startsWith so small
 * variations like "Qté Recus" / "Qté Commandée" both land in Qté reçue.
 */
const HEADERS: [string, Column][] = [
  ['n° ordre', 'numeroOrdre'],
  ['date reception', 'dateReception'],
  ['code article', 'codeArticle'],
  ['designation', 'designation'],
  ['fournisseur', 'fournisseur'],
  ['n° bl', 'numeroBl'],
  ['n° marche', 'numeroMarche'],
  ['n° order affectation', 'numeroOrdreAffectation'],
  ['n° ordre affectation', 'numeroOrdreAffectation'],
  ['n° de livraison entrante', 'numeroLivraisonEntrante'],
  ['qte recu', 'qteRecue'],
  ['qte commandee', 'qteRecue'],
  ['zone dest', 'zoneDest'],
  ['quai', 'quai'],
  ['statut', 'statut'],
  ['ecart', 'ecart'],
  ['controleur', 'controleur'],
  ['matricule', 'matricule'],
  ['nom du chauffeur', 'chauffeur'],
  ['cne', 'cne'],
  ['n° tel', 'telephone'],
]

function normalise(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isFormula(value: ExcelJS.CellValue) {
  return (
    typeof value === 'object' && value !== null && ('formula' in value || 'sharedFormula' in value)
  )
}

/**
 * Plain value of a cell, unwrapping formulas, rich text and hyperlinks.
 */
function plain(value: ExcelJS.CellValue): string | number | Date | boolean | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    if ('result' in value) return plain(value.result as ExcelJS.CellValue)
    if ('richText' in value) return value.richText.map((t) => t.text).join('')
    if ('text' in value) return String(value.text)
    if ('error' in value) return null
    return null
  }
  return value
}

function text(value: ExcelJS.CellValue): string | null {
  const v = plain(value)
  if (v === null) return null
  if (v instanceof Date) return DateTime.fromJSDate(v, { zone: 'utc' }).toISODate()
  const s = String(v).replace(/\s+/g, ' ').trim()
  if (s === '' || s === '0') return null
  return s
}

function integer(value: ExcelJS.CellValue): number | null {
  const v = plain(value)
  if (v === null || v instanceof Date || typeof v === 'boolean') return null
  if (typeof v === 'number') return Math.round(v)
  const digits = v.replace(/[\s\u00a0]/g, '').replace(',', '.')
  const n = Number(digits)
  return digits !== '' && Number.isFinite(n) ? Math.round(n) : null
}

function date(value: ExcelJS.CellValue): DateTime | null {
  const v = plain(value)
  if (v instanceof Date) {
    const d = DateTime.fromJSDate(v, { zone: 'utc' })
    return DateTime.fromObject({ year: d.year, month: d.month, day: d.day })
  }
  if (typeof v === 'string') {
    for (const format of ['dd/MM/yyyy', 'd/M/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy']) {
      const d = DateTime.fromFormat(v.trim(), format)
      if (d.isValid) return d
    }
  }
  return null
}

function telephone(value: ExcelJS.CellValue): string | null {
  const v = plain(value)
  if (typeof v === 'number') {
    const s = String(Math.round(v))
    return s.length === 9 ? `0${s}` : s
  }
  return text(value)
}

const STATUT_MAP: Record<string, string> = {
  'RECEPTIONNE': 'RÉCEPTIONNÉ',
  'RECEPTIONNEE': 'RÉCEPTIONNÉ',
  'ENTRE MARCHANDISE': 'ENTRÉE MARCHANDISE',
  'ENTREE MARCHANDISE': 'ENTRÉE MARCHANDISE',
  'RANGE': 'RANGÉE',
  'RANGEE': 'RANGÉE',
}

/**
 * Old free-text écart → Qté BL, using the rule agreed for the migration:
 *   - plain number X (surplus):  BL = reçue − X
 *   - "MOIN(S) X" (shortage):    BL = reçue + X
 *   - empty, or a result < 0:     BL = reçue
 */
function qteBlFromEcart(
  qteRecue: number | null,
  ecart: ExcelJS.CellValue,
  where: string,
  warnings: string[]
): number | null {
  if (qteRecue === null) return null
  const v = plain(ecart)
  if (v === null || v === '') return qteRecue

  let bl: number | null = null
  if (typeof v === 'number') {
    bl = qteRecue - Math.round(v)
  } else if (typeof v === 'string') {
    const s = normalise(v)
    const minus = s.match(/^(moins?|-)\s*(\d+)$/)
    const plus = s.match(/^(plus|\+)?\s*(\d+)$/)
    if (minus) bl = qteRecue + Number(minus[2])
    else if (plus) bl = qteRecue - Number(plus[2])
  }

  if (bl === null) {
    warnings.push(`${where}: écart "${String(v)}" non reconnu, Qté BL = Qté reçue`)
    return qteRecue
  }
  if (bl < 0) {
    warnings.push(`${where}: écart ${String(v)} donne une Qté BL négative, Qté BL = Qté reçue`)
    return qteRecue
  }
  return bl
}

function matriculeKey(day: DateTime | null, matricule: string | null) {
  if (!day || !matricule) return null
  return `${day.toISODate()}|${matricule.toUpperCase().replace(/[\s\-/]/g, '')}`
}

type FicheInfo = { depart: string | null; destination: string | null; transporteur: string | null }

/**
 * Reads "FICHE D'entree" workbooks: finds the header row (the one with
 * MATRICULE and DATE DECHARGEMENT) and indexes rows by date + matricule.
 */
async function readFiches(files: string[]) {
  const index = new Map<string, FicheInfo>()
  for (const file of files) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(file)
    workbook.eachSheet((ws) => {
      let columns: Record<string, number> | null = null
      ws.eachRow((row) => {
        if (!columns) {
          const found: Record<string, number> = {}
          row.eachCell((cell, col) => {
            const h = normalise(String(plain(cell.value) ?? ''))
            if (h.startsWith('date dechargement')) found.date = col
            else if (h.startsWith('matricule')) found.matricule = col
            else if (h.startsWith('depart')) found.depart = col
            else if (h.startsWith('destination')) found.destination = col
            else if (h.startsWith('transporteur')) found.transporteur = col
          })
          if (found.date && found.matricule) columns = found
          return
        }
        const key = matriculeKey(
          date(row.getCell(columns.date).value),
          text(row.getCell(columns.matricule).value)
        )
        if (!key) return
        const get = (name: string) =>
          columns![name] ? text(row.getCell(columns![name]).value) : null
        index.set(key, {
          depart: get('depart'),
          destination: get('destination'),
          transporteur: get('transporteur'),
        })
      })
    })
  }
  return index
}

export async function importOrigineWorkbook(
  file: string,
  options: { ficheFiles: string[]; dryRun: boolean }
) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(file)
  const fiches = await readFiches(options.ficheFiles)

  const warnings: string[] = []
  const perSheet: { sheet: string; imported: number; skipped: number }[] = []
  const rows: Attrs[] = []
  let backfilled = 0

  for (const ws of workbook.worksheets) {
    const match = ws.name.match(/entrepot\s*(\d+)/i)
    if (!match) continue
    const entrepot = Number(match[1])

    const columns = new Map<number, Column>()
    ws.getRow(1).eachCell((cell, col) => {
      const header = normalise(String(plain(cell.value) ?? ''))
      const hit = HEADERS.find(([prefix]) => header.startsWith(prefix))
      if (hit && ![...columns.values()].includes(hit[1])) columns.set(col, hit[1])
    })

    const sheetRows: Attrs[] = []
    let skipped = 0

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const cells = new Map<Column, ExcelJS.CellValue>()
      let hasFormula = false
      let hasValue = false
      for (const [col, field] of columns) {
        const value = row.getCell(col).value
        if (isFormula(value)) hasFormula = true
        if (plain(value) !== null && String(plain(value)).trim() !== '') hasValue = true
        cells.set(field, value)
      }
      if (!hasValue) return
      // Totals rows (=SUM(...)) are not entries.
      if (hasFormula) {
        skipped++
        return
      }

      const where = `${ws.name} ligne ${rowNumber}`
      const qteRecue = integer(cells.get('qteRecue') ?? null)
      const rawStatut = text(cells.get('statut') ?? null)
      const statut = rawStatut ? (STATUT_MAP[normalise(rawStatut).toUpperCase()] ?? null) : null
      if (rawStatut && !statut)
        warnings.push(`${where}: statut "${rawStatut}" inconnu, laissé vide`)
      const rawQuai = text(cells.get('quai') ?? null)?.toUpperCase() ?? null
      const quai = rawQuai && (QUAIS as readonly string[]).includes(rawQuai) ? rawQuai : null
      if (rawQuai && !quai) warnings.push(`${where}: quai "${rawQuai}" inconnu, laissé vide`)

      sheetRows.push({
        entrepot,
        numeroOrdre: text(cells.get('numeroOrdre') ?? null),
        dateReception: date(cells.get('dateReception') ?? null),
        codeArticle: text(cells.get('codeArticle') ?? null),
        designation: text(cells.get('designation') ?? null),
        fournisseur: text(cells.get('fournisseur') ?? null),
        numeroBl: text(cells.get('numeroBl') ?? null),
        numeroMarche: text(cells.get('numeroMarche') ?? null),
        numeroOrdreAffectation: text(cells.get('numeroOrdreAffectation') ?? null),
        numeroLivraisonEntrante: text(cells.get('numeroLivraisonEntrante') ?? null),
        qteRecue,
        qteBl: qteBlFromEcart(qteRecue, cells.get('ecart') ?? null, where, warnings),
        zoneDest: text(cells.get('zoneDest') ?? null),
        quai,
        statut,
        controleur: text(cells.get('controleur') ?? null),
        matricule: text(cells.get('matricule') ?? null),
        chauffeur: text(cells.get('chauffeur') ?? null),
        cne: text(cells.get('cne') ?? null),
        telephone: telephone(cells.get('telephone') ?? null),
        depart: null,
        destination: DEFAULT_DESTINATION,
        transporteur: null,
        importSource: IMPORT_SOURCE,
      })
    })

    /**
     * Rows typed without a N° ordre get the next number of their sheet.
     */
    let max = Math.max(
      0,
      ...sheetRows.map((r) =>
        r.numeroOrdre && /^\d+$/.test(r.numeroOrdre) ? Number(r.numeroOrdre) : 0
      )
    )
    for (const r of sheetRows) {
      if (!r.numeroOrdre) {
        r.numeroOrdre = String(++max)
        warnings.push(`${ws.name}: ligne sans N° ordre, numéro ${r.numeroOrdre} attribué`)
      }
    }

    for (const r of sheetRows) {
      const key = matriculeKey(r.dateReception, r.matricule)
      const info = key ? fiches.get(key) : undefined
      if (!info) continue
      r.depart = info.depart ?? r.depart
      r.transporteur = info.transporteur ?? r.transporteur
      r.destination = info.destination ?? r.destination
      backfilled++
    }

    perSheet.push({ sheet: ws.name, imported: sheetRows.length, skipped })
    rows.push(...sheetRows)
  }

  let deleted = 0
  if (!options.dryRun) {
    await db.transaction(async (trx) => {
      const removed = await Entry.query({ client: trx })
        .where('import_source', IMPORT_SOURCE)
        .delete()
      deleted = Array.isArray(removed) ? Number(removed[0] ?? 0) : Number(removed)
      await Entry.createMany(rows, { client: trx })
    })
  }

  return { perSheet, total: rows.length, deleted, backfilled, warnings, rows }
}
