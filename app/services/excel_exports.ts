import ExcelJS from 'exceljs'
import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Entry from '#models/entry'
import { ENTREPOTS, NUMERO_ORDRE_NUMERIC_SQL } from '#constants/entries'

const NAVY = 'FF1F3864'
const PALE_BLUE = 'FFD9E1F2'
const FICHE_BLUE = 'FF8EA9DB'
const WHITE = 'FFFFFFFF'
const BLACK = 'FF000000'

const thin: Partial<ExcelJS.Border> = { style: 'thin' }
const medium: Partial<ExcelJS.Border> = { style: 'medium' }
const allThin: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin }

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

/**
 * Excel stores dates as local wall-clock values: build a Date whose UTC
 * parts are the calendar day, so it never shifts by a day.
 */
function excelDate(date: DateTime) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day))
}

/**
 * Codes like "200001" are written as numbers, like in the original sheets.
 */
function codeValue(code: string | null) {
  if (!code) return null
  return /^\d{1,15}$/.test(code) ? Number(code) : code
}

type StockLine = { code: string | null; designation: string | null; total: number }

async function stockLines(asOf: DateTime) {
  const result = await db.rawQuery<{
    rows: { entrepot: number; code: string | null; designation: string | null; total: string }[]
  }>(
    `SELECT entrepot,
            NULLIF(trim(code_article), '') AS code,
            (array_agg(designation ORDER BY id DESC)
               FILTER (WHERE designation IS NOT NULL AND trim(designation) <> ''))[1] AS designation,
            COALESCE(SUM(qte_recue), 0) AS total
       FROM entries
      WHERE entrepot IS NOT NULL
        AND (date_reception IS NULL OR date_reception <= ?)
      GROUP BY entrepot,
               NULLIF(trim(code_article), ''),
               CASE WHEN NULLIF(trim(code_article), '') IS NULL THEN upper(trim(designation)) END
      ORDER BY entrepot, code NULLS LAST`,
    [asOf.toISODate()]
  )

  const byEntrepot = new Map<number, StockLine[]>()
  for (const e of ENTREPOTS) byEntrepot.set(e, [])
  for (const row of result.rows) {
    byEntrepot.get(row.entrepot)?.push({
      code: row.code,
      designation: row.designation,
      total: Number(row.total),
    })
  }
  return byEntrepot
}

/**
 * Export A: "SITUATION DU STOCK", laid out like Classeur1.xlsx.
 * Two warehouse blocks side by side (columns A–C and E–G), two rows of
 * blocks, then the signature boxes.
 */
export async function buildStockWorkbook(asOf: DateTime) {
  const lines = await stockLines(asOf)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Entropos'
  const ws = workbook.addWorksheet('SITUATION STOCK', {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  })

  ws.columns = [
    { width: 14 },
    { width: 30 },
    { width: 16 },
    { width: 3 },
    { width: 14 },
    { width: 30 },
    { width: 16 },
  ]
  const font = (size = 11, bold = false, color?: string): Partial<ExcelJS.Font> => ({
    name: 'Calibri',
    size,
    bold,
    ...(color ? { color: { argb: color } } : {}),
  })

  ws.getCell('A1').value = 'SITUATION DU STOCK'
  ws.getCell('A1').font = font(16, true)
  ws.getRow(1).height = 21

  ws.getCell('A2').value = 'Situation au :'
  ws.getCell('A2').font = font(10)
  ws.getCell('B2').value = excelDate(asOf)
  ws.getCell('B2').numFmt = 'dd/mm/yyyy'
  ws.getCell('B2').font = font(10, true)
  ws.getCell('B2').alignment = { horizontal: 'left' }

  /**
   * Writes one warehouse block starting at `startCol` (1 = A, 5 = E) and
   * returns nothing; rows are reserved by the caller so both blocks of a
   * pair line up.
   */
  function writeBlock(entrepot: number, startCol: number, top: number, dataRows: number) {
    const col = (offset: number) => ws.getColumn(startCol + offset).letter
    const items = lines.get(entrepot) ?? []

    ws.mergeCells(`${col(0)}${top}:${col(2)}${top}`)
    const title = ws.getCell(`${col(0)}${top}`)
    title.value = `ENTREPOT ${entrepot}`
    title.font = font(13, true, WHITE)
    title.fill = fill(NAVY)
    title.alignment = { horizontal: 'center', vertical: 'middle' }

    const headers = ['Code Article', 'Désignation', 'Quantité totale']
    headers.forEach((label, i) => {
      const cell = ws.getCell(`${col(i)}${top + 1}`)
      cell.value = label
      cell.font = font(11, true, WHITE)
      cell.fill = fill(NAVY)
      cell.border = allThin
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    })

    const firstData = top + 2
    for (let i = 0; i < dataRows; i++) {
      const r = firstData + i
      const item = items[i]
      const code = ws.getCell(`${col(0)}${r}`)
      const designation = ws.getCell(`${col(1)}${r}`)
      const total = ws.getCell(`${col(2)}${r}`)
      code.value = item ? codeValue(item.code) : null
      designation.value = item?.designation ?? null
      total.value = item ? item.total : null
      code.alignment = { horizontal: 'center' }
      total.numFmt = '#,##0'
      total.font = font(11, true)
      for (const cell of [code, designation, total]) cell.border = allThin
    }

    const totalRow = firstData + dataRows
    const sum = items.reduce((acc, item) => acc + item.total, 0)
    for (let i = 0; i < 3; i++) {
      const cell = ws.getCell(`${col(i)}${totalRow}`)
      cell.fill = fill(PALE_BLUE)
      cell.font = font(12, true)
      cell.border = allThin
    }
    ws.getCell(`${col(0)}${totalRow}`).value = 'TOTAL'
    const totalCell = ws.getCell(`${col(2)}${totalRow}`)
    totalCell.value = {
      formula: `SUM(${col(2)}${firstData}:${col(2)}${totalRow - 1})`,
      result: sum,
    }
    totalCell.numFmt = '#,##0'
  }

  let top = 4
  for (const [left, right] of [
    [1, 2],
    [3, 4],
  ]) {
    const dataRows = Math.max(lines.get(left)!.length, lines.get(right)!.length, 1)
    writeBlock(left, 1, top, dataRows)
    writeBlock(right, 5, top, dataRows)
    ws.getRow(top).height = 17.4
    ws.getRow(top + 2 + dataRows).height = 15.6
    top += 2 + dataRows + 3
  }

  /**
   * Signature boxes: a labelled header row, then a 3-row box to sign in.
   */
  function signature(row: number, boxes: [string, string, string][]) {
    for (const [from, to, label] of boxes) {
      ws.mergeCells(`${from}${row}:${to}${row}`)
      const head = ws.getCell(`${from}${row}`)
      head.value = label
      head.font = font(13, true)
      head.fill = fill(PALE_BLUE)
      head.alignment = { horizontal: 'center', vertical: 'middle' }
      head.border = allThin

      ws.mergeCells(`${from}${row + 1}:${to}${row + 3}`)
      ws.getCell(`${from}${row + 1}`).border = allThin
    }
    ws.getRow(row).height = 17.4
  }

  signature(top, [
    ['A', 'B', 'Coordinateur WMS'],
    ['C', 'E', 'Gestionnaire de flux'],
    ['F', 'G', 'Gestionnaire de stock'],
  ])
  signature(top + 4, [
    ['A', 'B', 'Adjoint Responsable Plateforme'],
    ['C', 'E', 'Responsable Plateforme'],
  ])

  ws.pageSetup.printArea = `A1:G${top + 7}`

  return workbook
}

/**
 * Export B: "FICHE D'ENTRÉE" for one day, laid out like
 * "FICHE D'entree 12-11-2026.xlsx".
 */
export async function buildFicheWorkbook(day: DateTime, entrepot?: number) {
  const query = Entry.query().where('date_reception', day.toISODate()!)
  if (entrepot) query.where('entrepot', entrepot)
  const entries = await query
    .orderByRaw('entrepot ASC NULLS LAST')
    .orderByRaw(`${NUMERO_ORDRE_NUMERIC_SQL} ASC NULLS LAST`)
    .orderBy('id', 'asc')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Entropos'
  const ws = workbook.addWorksheet('FICHE ENTREE', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  })

  const widths = [3, 16.1, 21.6, 18.9, 21.1, 20.9, 22.1, 19.3, 20.7, 21.7, 21.3, 18.3, 14.7, 15.7]
  ws.columns = widths.map((width) => ({ width }))

  const font = (size = 11, bold = false): Partial<ExcelJS.Font> => ({
    name: 'Calibri',
    size,
    bold,
    color: { argb: BLACK },
  })

  ws.getCell('B2').value = "FICHE D'ENTRÉE"
  ws.getCell('B2').font = font(16, true)
  ws.getCell('B3').value =
    `Date : ${day.toFormat('dd/MM/yyyy')}${entrepot ? ` — Entrepôt ${entrepot}` : ''}`
  ws.getCell('B3').font = font(11, true)

  const headerRow = 5
  const headers = [
    '',
    'DATE DECHARGEMENT',
    'FOURNISSEUR',
    'DEPART',
    'DESTINATION',
    'TRANSPORTEUR',
    'ENTREPOT',
    'MATRICULE',
    'NOM CONDUCTEUR',
    'N° TEL',
    'TYPE MARCHANDISE',
    'NBR',
    'LOT',
  ]
  const firstCol = 2 // column B
  const lastCol = firstCol + headers.length - 1 // column N

  headers.forEach((label, i) => {
    const cell = ws.getCell(headerRow, firstCol + i)
    cell.value = label || null
    cell.font = font(12, true)
    cell.fill = fill(FICHE_BLUE)
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: medium,
      bottom: medium,
      left: i === 0 ? medium : thin,
      right: i === headers.length - 1 ? medium : thin,
    }
  })
  ws.getRow(headerRow).height = 45

  entries.forEach((entry, index) => {
    const r = headerRow + 1 + index
    const isLast = index === entries.length - 1
    const values = [
      index + 1,
      entry.dateReception ? excelDate(entry.dateReception) : null,
      entry.fournisseur,
      entry.depart,
      entry.destination,
      entry.transporteur,
      entry.entrepot ? `E${entry.entrepot}` : null,
      entry.matricule,
      entry.chauffeur,
      entry.telephone,
      entry.designation,
      entry.qteRecue,
      entry.numeroMarche,
    ]
    values.forEach((value, i) => {
      const cell = ws.getCell(r, firstCol + i)
      cell.value = value
      cell.font = font(11, i === 0)
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: thin,
        bottom: isLast ? medium : thin,
        left: i === 0 ? medium : thin,
        right: i === values.length - 1 || i === 0 ? medium : thin,
      }
      if (i === 0) cell.fill = fill(FICHE_BLUE)
    })
    ws.getCell(r, firstCol + 1).numFmt = 'dd/mm/yyyy'
    ws.getRow(r).height = 35.1
  })

  const totalRow = headerRow + 1 + entries.length
  const nbrCol = ws.getColumn(lastCol - 1).letter
  const total = entries.reduce((acc, e) => acc + (e.qteRecue ?? 0), 0)
  const label = ws.getCell(totalRow, lastCol - 2)
  label.value = 'TOTAL'
  label.font = font(11, true)
  label.alignment = { horizontal: 'center', vertical: 'middle' }
  const sum = ws.getCell(totalRow, lastCol - 1)
  sum.value = entries.length
    ? { formula: `SUM(${nbrCol}${headerRow + 1}:${nbrCol}${totalRow - 1})`, result: total }
    : 0
  sum.font = font(11, true)
  sum.alignment = { horizontal: 'center', vertical: 'middle' }

  ws.pageSetup.printArea = `B2:${ws.getColumn(lastCol).letter}${totalRow}`

  return workbook
}
