import vine from '@vinejs/vine'
import { ENTREPOTS, QUAIS, STATUTS } from '#constants/entries'

/**
 * Every field is optional: the form must accept partial entries.
 */
const text = (max = 255) => vine.string().trim().maxLength(max).nullable().optional()
const quantity = () => vine.number().withoutDecimals().min(0).max(100_000_000).nullable().optional()

export const entryValidator = vine.create({
  entrepot: vine
    .number()
    .in([...ENTREPOTS])
    .nullable()
    .optional(),
  numeroOrdre: text(50),
  dateReception: vine
    .date({ formats: ['YYYY-MM-DD'] })
    .nullable()
    .optional(),
  codeArticle: text(100),
  designation: text(),
  fournisseur: text(),
  numeroBl: text(100),
  numeroMarche: text(100),
  numeroOrdreAffectation: text(100),
  numeroLivraisonEntrante: text(100),
  qteBl: quantity(),
  qteRecue: quantity(),
  zoneDest: text(100),
  quai: vine
    .enum([...QUAIS])
    .nullable()
    .optional(),
  statut: vine
    .enum([...STATUTS])
    .nullable()
    .optional(),
  controleur: text(),
  matricule: text(100),
  chauffeur: text(),
  cne: text(50),
  telephone: vine
    .string()
    .trim()
    .maxLength(50)
    .regex(/^[0-9+ .\-/]*$/)
    .nullable()
    .optional(),
  depart: text(),
  destination: text(),
  transporteur: text(),
})

/**
 * A photo or PDF of a bon de livraison to read.
 */
export const blExtractionValidator = vine.create({
  bon: vine.file({ size: '20mb', extnames: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'] }),
})

export const entryListValidator = vine.create({
  page: vine.number().withoutDecimals().min(1).optional(),
  sort: vine.string().optional(),
  order: vine.enum(['asc', 'desc']).optional(),
  entrepot: vine
    .number()
    .in([...ENTREPOTS])
    .optional(),
  from: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
  to: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
  fournisseur: vine.string().trim().optional(),
  statut: vine.string().trim().optional(),
  q: vine.string().trim().optional(),
})

export const stockExportValidator = vine.create({
  date: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
})

export const registreExportValidator = vine.create({
  from: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
  date: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
})

export const ficheExportValidator = vine.create({
  date: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
  entrepot: vine
    .number()
    .in([...ENTREPOTS])
    .optional(),
})
