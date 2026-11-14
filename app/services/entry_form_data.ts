import db from '@adonisjs/lucid/services/db'
import {
  CONTROLEURS_INITIAUX,
  DEFAULT_DESTINATION,
  ENTREPOTS,
  NUMERO_ORDRE_NUMERIC_SQL,
  QUAIS,
  STATUTS,
  SUGGESTION_COLUMNS,
} from '#constants/entries'

type SuggestionKey = keyof typeof SUGGESTION_COLUMNS

/**
 * Everything the entry form needs besides the entry itself: dropdown
 * options, suggestions from past values, and the next N° ordre per entrepôt.
 */
export async function entryFormData() {
  const suggestions = {} as Record<SuggestionKey, string[]>

  await Promise.all(
    (Object.entries(SUGGESTION_COLUMNS) as [SuggestionKey, string][]).map(async ([key, col]) => {
      const rows = await db
        .from('entries')
        .distinct(col)
        .whereNotNull(col)
        .whereRaw(`trim(${col}) <> ''`)
        .orderBy(col)
        .limit(1000)
      suggestions[key] = rows.map((r) => String(r[col]))
    })
  )

  suggestions.controleur = [...new Set([...suggestions.controleur, ...CONTROLEURS_INITIAUX])].sort(
    (a, b) => a.localeCompare(b, 'fr')
  )
  if (!suggestions.destination.includes(DEFAULT_DESTINATION)) {
    suggestions.destination.unshift(DEFAULT_DESTINATION)
  }

  /**
   * Last désignation typed for each code article, used to pre-fill the
   * désignation when a known code is entered.
   */
  const designationRows = await db.rawQuery<{ rows: { code: string; designation: string }[] }>(
    `SELECT DISTINCT ON (trim(code_article)) trim(code_article) AS code, designation
       FROM entries
      WHERE code_article IS NOT NULL AND designation IS NOT NULL AND trim(designation) <> ''
      ORDER BY trim(code_article), id DESC`
  )
  const designationsByCode: Record<string, string> = {}
  for (const row of designationRows.rows) designationsByCode[row.code] = row.designation

  const maxRows = await db.rawQuery<{ rows: { entrepot: number; max: string | null }[] }>(
    `SELECT entrepot, MAX(${NUMERO_ORDRE_NUMERIC_SQL}) AS max
       FROM entries
      WHERE entrepot IS NOT NULL
      GROUP BY entrepot`
  )
  const nextOrdre: Record<string, number> = {}
  for (const e of ENTREPOTS) nextOrdre[e] = 1
  for (const row of maxRows.rows) nextOrdre[row.entrepot] = Number(row.max ?? 0) + 1

  return {
    options: {
      entrepots: [...ENTREPOTS],
      statuts: [...STATUTS],
      quais: [...QUAIS],
    },
    suggestions,
    designationsByCode,
    nextOrdre,
    defaults: {
      destination: DEFAULT_DESTINATION,
    },
  }
}
