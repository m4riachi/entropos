export const ENTREPOTS = [1, 2, 3, 4] as const

export const STATUTS = ['RÉCEPTIONNÉ', 'ENTRÉE MARCHANDISE', 'RANGÉE'] as const

export const QUAIS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const

export const DEFAULT_DESTINATION = 'Marrakech'

/**
 * Contrôleurs listed in the original Excel validation list, offered as
 * suggestions alongside every value already typed in the app.
 */
export const CONTROLEURS_INITIAUX = [
  'ALOUI',
  'LAHMER',
  'EL AOUZI',
  'KARFAL',
  'BOUDHIR',
  'EL MQADEM',
  'ERACHKLOU',
  'BOUALAM',
  'NASSER',
  'BENAZUN',
  'EL MAOUASY',
  'KEDDAR',
  'BAKKALI',
  'AALIOUATE',
  'SAY',
  'EL BOUKHARI',
  'EREGAL',
  'JBILOU',
  'BENAYAD',
  'EL KHO',
  'BEN DAOUD',
  'ROUEJEL',
  'KOURCHI',
  'MARHOUM',
]

/**
 * Pure-number N° ordre values, as a number. Anything else is NULL, so
 * "2" sorts before "10" even though the column is free text.
 */
export const NUMERO_ORDRE_NUMERIC_SQL =
  "(CASE WHEN numero_ordre ~ '^\\s*[0-9]{1,15}\\s*$' THEN trim(numero_ordre)::bigint END)"

/**
 * Columns the list can be sorted by, mapped to their SQL expressions.
 */
export const SORTABLE_COLUMNS = {
  dateReception: ['date_reception'],
  entrepot: ['entrepot'],
  numeroOrdre: [NUMERO_ORDRE_NUMERIC_SQL, 'numero_ordre'],
  codeArticle: ['code_article'],
  fournisseur: ['fournisseur'],
  numeroMarche: ['numero_marche'],
  qteRecue: ['qte_recue'],
  statut: ['statut'],
  quai: ['quai'],
} as const

export type SortableColumn = keyof typeof SORTABLE_COLUMNS

/**
 * Text columns covered by the list's search box.
 */
export const SEARCH_COLUMNS = [
  'numero_bl',
  'numero_marche',
  'matricule',
  'chauffeur',
  'cne',
  'telephone',
  'code_article',
  'designation',
  'numero_ordre_affectation',
  'numero_livraison_entrante',
] as const

/**
 * Text columns whose past values are offered as suggestions in the form.
 */
export const SUGGESTION_COLUMNS = {
  codeArticle: 'code_article',
  designation: 'designation',
  fournisseur: 'fournisseur',
  numeroMarche: 'numero_marche',
  zoneDest: 'zone_dest',
  controleur: 'controleur',
  depart: 'depart',
  destination: 'destination',
  transporteur: 'transporteur',
} as const
