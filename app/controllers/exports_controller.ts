import { DateTime } from 'luxon'
import {
  buildFicheWorkbook,
  buildRegistreWorkbook,
  buildStockWorkbook,
} from '#services/excel_exports'
import {
  ficheExportValidator,
  registreExportValidator,
  stockExportValidator,
} from '#validators/entry'
import type { HttpContext } from '@adonisjs/core/http'
import type ExcelJS from 'exceljs'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

async function sendWorkbook(
  response: HttpContext['response'],
  workbook: ExcelJS.Workbook,
  name: string
) {
  const buffer = await workbook.xlsx.writeBuffer()
  response.header('Content-Type', XLSX_MIME)
  response.header('Content-Disposition', `attachment; filename="${name}"`)
  response.header('Cache-Control', 'no-store')
  return response.send(Buffer.from(buffer))
}

function day(date: DateTime | undefined) {
  return (date ?? DateTime.now()).startOf('day')
}

export default class ExportsController {
  async stock({ request, response }: HttpContext) {
    const { date } = await stockExportValidator.validate(request.qs())
    const asOf = day(date)
    const workbook = await buildStockWorkbook(asOf)
    return sendWorkbook(response, workbook, `Situation_stock_${asOf.toISODate()}.xlsx`)
  }

  async fiche({ request, response }: HttpContext) {
    const { date, entrepot } = await ficheExportValidator.validate(request.qs())
    const target = day(date)
    const workbook = await buildFicheWorkbook(target, entrepot)
    const suffix = entrepot ? `_E${entrepot}` : ''
    return sendWorkbook(response, workbook, `Fiche_entree_${target.toISODate()}${suffix}.xlsx`)
  }

  async registre({ request, response }: HttpContext) {
    const { from, date } = await registreExportValidator.validate(request.qs())
    const to = day(date)
    const start = from ? day(from) : undefined
    const workbook = await buildRegistreWorkbook({ from: start, to })
    const name = start
      ? `Registre_entrees_${start.toISODate()}_${to.toISODate()}.xlsx`
      : `Registre_entrees_${to.toISODate()}.xlsx`
    return sendWorkbook(response, workbook, name)
  }
}
