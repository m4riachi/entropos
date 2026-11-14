import Entry from '#models/entry'
import EntryTransformer from '#transformers/entry_transformer'
import { entryFormData } from '#services/entry_form_data'
import { entryListValidator, entryValidator } from '#validators/entry'
import {
  ENTREPOTS,
  NUMERO_ORDRE_NUMERIC_SQL,
  SEARCH_COLUMNS,
  SORTABLE_COLUMNS,
  STATUTS,
  type SortableColumn,
} from '#constants/entries'
import type { HttpContext } from '@adonisjs/core/http'
import type { Infer } from '@vinejs/vine/types'

const PER_PAGE = 25

type EntryPayload = Infer<typeof entryValidator>

/**
 * Turns validated form data into model attributes. Missing fields become
 * NULL so clearing a field in the form clears it in the database.
 */
function toAttributes(data: EntryPayload) {
  const { dateReception, ...rest } = data
  const attributes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    attributes[key] = value === undefined || value === '' ? null : value
  }
  attributes.dateReception = dateReception ?? null
  return attributes as Partial<Entry>
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export default class EntriesController {
  async index({ request, inertia }: HttpContext) {
    const [, parsed] = await entryListValidator.tryValidate(request.qs())
    const filters = parsed ?? {}

    const sort: SortableColumn =
      filters.sort && filters.sort in SORTABLE_COLUMNS
        ? (filters.sort as SortableColumn)
        : 'dateReception'
    const order = filters.order ?? 'desc'

    const query = Entry.query()

    if (filters.entrepot) query.where('entrepot', filters.entrepot)
    if (filters.from) query.where('date_reception', '>=', filters.from.toISODate()!)
    if (filters.to) query.where('date_reception', '<=', filters.to.toISODate()!)
    if (filters.fournisseur) {
      query.whereILike('fournisseur', `%${escapeLike(filters.fournisseur)}%`)
    }
    if (filters.statut === 'none') query.whereNull('statut')
    else if (filters.statut) query.where('statut', filters.statut)
    if (filters.q) {
      const term = `%${escapeLike(filters.q)}%`
      query.where((sub) => {
        for (const column of SEARCH_COLUMNS) sub.orWhereILike(column, term)
      })
    }

    const totals = await query.clone().sum('qte_recue as qteRecue').count('* as count').first()

    for (const expression of SORTABLE_COLUMNS[sort]) {
      query.orderByRaw(`${expression} ${order === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`)
    }
    /**
     * Tie-breakers: newest day first, then within a day by entrepôt and
     * N° ordre, so a day reads in the same order as the paper sheets.
     */
    if (sort !== 'dateReception') query.orderByRaw('date_reception DESC NULLS LAST')
    if (sort !== 'entrepot') query.orderByRaw('entrepot ASC NULLS LAST')
    if (sort !== 'numeroOrdre') {
      query.orderByRaw(`${NUMERO_ORDRE_NUMERIC_SQL} ASC NULLS LAST`).orderBy('numero_ordre', 'asc')
    }
    query.orderBy('id', 'asc')

    const paginator = await query.paginate(filters.page ?? 1, PER_PAGE)

    return inertia.render('entries/index', {
      entries: EntryTransformer.transform(paginator.all()),
      meta: {
        total: paginator.total,
        perPage: paginator.perPage,
        currentPage: paginator.currentPage,
        lastPage: paginator.lastPage,
      },
      totals: {
        count: Number(totals?.$extras.count ?? 0),
        qteRecue: Number(totals?.$extras.qteRecue ?? 0),
      },
      filters: {
        sort,
        order,
        entrepot: filters.entrepot ?? null,
        from: filters.from ? filters.from.toISODate() : null,
        to: filters.to ? filters.to.toISODate() : null,
        fournisseur: filters.fournisseur ?? null,
        statut: filters.statut ?? null,
        q: filters.q ?? null,
      },
      options: {
        entrepots: [...ENTREPOTS],
        statuts: [...STATUTS],
      },
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('entries/form', {
      entry: null,
      ...(await entryFormData()),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(entryValidator)
    const entry = await Entry.create(toAttributes(data))

    session.flash('success', `Entrée N° ${entry.numeroOrdre ?? entry.id} enregistrée`)
    if (request.input('andNew')) {
      return response.redirect().withQs(false).toRoute('entries.create')
    }
    return response.redirect().withQs(false).toRoute('entries.index')
  }

  async edit({ params, inertia }: HttpContext) {
    const entry = await Entry.findOrFail(params.id)
    return inertia.render('entries/form', {
      entry: EntryTransformer.transform(entry),
      ...(await entryFormData()),
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const entry = await Entry.findOrFail(params.id)
    const data = await request.validateUsing(entryValidator)
    entry.merge(toAttributes(data))
    await entry.save()

    session.flash('success', 'Entrée mise à jour')
    return response.redirect().withQs(false).toRoute('entries.index')
  }

  async destroy({ params, response, session }: HttpContext) {
    const entry = await Entry.findOrFail(params.id)
    await entry.delete()

    session.flash('success', 'Entrée supprimée')
    return response.redirect().back()
  }
}
