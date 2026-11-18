import { readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import type { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import Entry from '#models/entry'
import {
  CONTROLEURS_INITIAUX,
  ENTREPOTS,
  NUMERO_ORDRE_NUMERIC_SQL,
  QUAIS,
  STATUTS,
} from '#constants/entries'

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

/**
 * Official letterhead (from ENTITE.pdf) on top of every sheet: the French
 * block on the left, the emblem in the middle and the Arabic / Tifinagh
 * block on the right. Kept as images so the scripts print exactly as in
 * the PDF whatever fonts the computer has.
 */
const LETTERHEAD_ROWS = 2
/**
 * In the PDF the three blocks span 2127 px for 427 px of height (300 dpi
 * crops). The letterhead keeps that shape and covers 92% of the sheet's
 * width, so it prints at the same relative size on narrow and wide sheets.
 */
const LETTERHEAD_SOURCE = { width: 2127, height: 427 }
const LETTERHEAD_SPAN = 0.92
const LETTERHEAD_PARTS = ['left', 'emblem', 'right'] as const

type LetterheadPart = (typeof LETTERHEAD_PARTS)[number]
type LetterheadFile = { buffer: Buffer; width: number; height: number }
let letterheadFiles: Promise<Record<LetterheadPart, LetterheadFile>> | undefined

function loadLetterhead() {
  letterheadFiles ??= Promise.all(
    LETTERHEAD_PARTS.map(async (part) => {
      const buffer = await readFile(app.makePath('resources/letterhead', `${part}.png`))
      // PNG header: width and height are the big-endian ints at bytes 16 and 20.
      const file = { buffer, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
      return [part, file] as const
    })
  ).then((parts) => Object.fromEntries(parts) as Record<LetterheadPart, LetterheadFile>)
  return letterheadFiles
}

const letterheadIds = new WeakMap<ExcelJS.Workbook, Record<LetterheadPart, number>>()

/**
 * Draws the letterhead over the first LETTERHEAD_ROWS rows of `ws`,
 * spread across columns `firstCol`–`lastCol` (1-based). Sheet content
 * starts at row LETTERHEAD_ROWS + 1.
 */
async function addLetterhead(
  workbook: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  firstCol: number,
  lastCol: number
) {
  const files = await loadLetterhead()
  let ids = letterheadIds.get(workbook)
  if (!ids) {
    const added = {} as Record<LetterheadPart, number>
    for (const part of LETTERHEAD_PARTS) {
      // exceljs types expect the older global Buffer type.
      const buffer = files[part].buffer as unknown as ExcelJS.Buffer
      added[part] = workbook.addImage({ buffer, extension: 'png' })
    }
    ids = added
    letterheadIds.set(workbook, ids)
  }

  // Column widths in pixels (≈ 7 px per character at Calibri 11).
  const widths: number[] = []
  for (let c = firstCol; c <= lastCol; c++) widths.push((ws.getColumn(c).width ?? 9) * 7)
  const total = widths.reduce((a, b) => a + b, 0)

  /** Fractional, 0-based column position `x` pixels right of firstCol. */
  const colAt = (x: number) => {
    let left = 0
    for (const [i, w] of widths.entries()) {
      if (x < left + w) return firstCol - 1 + i + (x - left) / w
      left += w
    }
    return lastCol
  }

  const span = total * LETTERHEAD_SPAN
  const height = Math.round((span * LETTERHEAD_SOURCE.height) / LETTERHEAD_SOURCE.width)
  const size = (part: LetterheadPart) => ({
    width: Math.round((files[part].width * height) / files[part].height),
    height,
  })
  const start = (total - span) / 2
  const positions: Record<LetterheadPart, number> = {
    left: start,
    emblem: (total - size('emblem').width) / 2,
    right: start + span - size('right').width,
  }

  // Row 1 holds the images (px → pt is ×0.75), row 2 is a small gap.
  ws.getRow(1).height = Math.ceil(height * 0.75) + 4
  ws.getRow(2).height = 8

  for (const part of LETTERHEAD_PARTS) {
    ws.addImage(ids[part], {
      tl: { col: colAt(positions[part]), row: 0 },
      ext: size(part),
      editAs: 'oneCell',
    })
  }
}

type StockLine = { code: string | null; designation: string | null; total: number }

/**
 * Quantities received per entrepôt and article: everything up to `date`
 * (entries without a date included), or only that day when `onlyThatDay`.
 */
async function stockLines(date: DateTime, onlyThatDay = false) {
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
        AND ${onlyThatDay ? 'date_reception = ?' : '(date_reception IS NULL OR date_reception <= ?)'}
      GROUP BY entrepot,
               NULLIF(trim(code_article), ''),
               CASE WHEN NULLIF(trim(code_article), '') IS NULL THEN upper(trim(designation)) END
      ORDER BY entrepot, code NULLS LAST`,
    [date.toISODate()]
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
  await addLetterhead(workbook, ws, 1, 7)
  const font = (size = 11, bold = false, color?: string): Partial<ExcelJS.Font> => ({
    name: 'Calibri',
    size,
    bold,
    ...(color ? { color: { argb: color } } : {}),
  })

  const titleRow = LETTERHEAD_ROWS + 1
  const dateRow = titleRow + 1
  ws.getCell(`A${titleRow}`).value = 'SITUATION DU STOCK'
  ws.getCell(`A${titleRow}`).font = font(16, true)
  ws.getRow(titleRow).height = 21

  ws.getCell(`A${dateRow}`).value = 'Situation au :'
  ws.getCell(`A${dateRow}`).font = font(10)
  ws.getCell(`B${dateRow}`).value = excelDate(asOf)
  ws.getCell(`B${dateRow}`).numFmt = 'dd/mm/yyyy'
  ws.getCell(`B${dateRow}`).font = font(10, true)
  ws.getCell(`B${dateRow}`).alignment = { horizontal: 'left' }

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

  let top = titleRow + 3
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

  await addTotalsByArticleSheet(workbook, lines, {
    sheetName: 'TOTAL PAR ARTICLE',
    title: 'SITUATION DU STOCK — TOTAL PAR ARTICLE',
    dateLabel: 'Situation au :',
    date: asOf,
  })

  return workbook
}

/**
 * Export D: "ENTRÉES DU JOUR", what was received on one day, per article
 * and entrepôt, with totals.
 */
export async function buildDailyWorkbook(day: DateTime) {
  const lines = await stockLines(day, true)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Entropos'
  await addTotalsByArticleSheet(workbook, lines, {
    sheetName: 'ENTREES DU JOUR',
    title: 'ENTRÉES DU JOUR PAR ARTICLE ET PAR ENTREPÔT',
    dateLabel: 'Date :',
    date: day,
  })
  return workbook
}

/**
 * One row per article with its quantity in each entrepôt and the grand
 * total across all of them. Articles are matched by code, or by
 * designation when they have no code. Used as the second sheet of the
 * stock export and as the daily export.
 */
async function addTotalsByArticleSheet(
  workbook: ExcelJS.Workbook,
  lines: Map<number, StockLine[]>,
  sheet: { sheetName: string; title: string; dateLabel: string; date: DateTime }
) {
  type Article = { code: string | null; designation: string | null; qty: Map<number, number> }
  const articles = new Map<string, Article>()
  const normalised = (designation: string | null) => (designation ?? '').trim().toUpperCase()
  /**
   * Coded lines first, so a line typed without a code joins the coded
   * article with the same designation (e.g. "LIT DE CAMPS" with and
   * without 100123) instead of becoming a separate row.
   */
  const byDesignation = new Map<string, string>()
  const all = [...lines].flatMap(([entrepot, items]) => items.map((item) => ({ entrepot, item })))
  all.sort((a, b) => Number(!a.item.code) - Number(!b.item.code))
  for (const { entrepot, item } of all) {
    const name = normalised(item.designation)
    const key = item.code ?? byDesignation.get(name) ?? `designation:${name}`
    let article = articles.get(key)
    if (!article) {
      article = { code: item.code, designation: item.designation, qty: new Map() }
      articles.set(key, article)
      if (name && !byDesignation.has(name)) byDesignation.set(name, key)
    }
    article.designation ??= item.designation
    article.qty.set(entrepot, (article.qty.get(entrepot) ?? 0) + item.total)
  }
  const rows = [...articles.values()].sort((a, b) => {
    if (a.code && b.code) return a.code.localeCompare(b.code, 'fr', { numeric: true })
    if (a.code || b.code) return a.code ? -1 : 1
    return (a.designation ?? '').localeCompare(b.designation ?? '', 'fr')
  })

  const ws = workbook.addWorksheet(sheet.sheetName, {
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
    { width: 34 },
    ...ENTREPOTS.map(() => ({ width: 14 })),
    { width: 18 },
  ]
  await addLetterhead(workbook, ws, 1, ENTREPOTS.length + 3)

  const font = (size = 11, bold = false, color?: string): Partial<ExcelJS.Font> => ({
    name: 'Calibri',
    size,
    bold,
    ...(color ? { color: { argb: color } } : {}),
  })
  // Zeros show as a dash so the article's warehouses stand out.
  const qtyFormat = '#,##0;-#,##0;"–"'

  const titleRow = LETTERHEAD_ROWS + 1
  const dateRow = titleRow + 1
  ws.getCell(`A${titleRow}`).value = sheet.title
  ws.getCell(`A${titleRow}`).font = font(16, true)
  ws.getRow(titleRow).height = 21
  ws.getCell(`A${dateRow}`).value = sheet.dateLabel
  ws.getCell(`A${dateRow}`).font = font(10)
  ws.getCell(`B${dateRow}`).value = excelDate(sheet.date)
  ws.getCell(`B${dateRow}`).numFmt = 'dd/mm/yyyy'
  ws.getCell(`B${dateRow}`).font = font(10, true)
  ws.getCell(`B${dateRow}`).alignment = { horizontal: 'left' }

  const headerRow = titleRow + 3
  const headers = [
    'Code Article',
    'Désignation',
    ...ENTREPOTS.map((e) => `Entrepôt ${e}`),
    'Quantité totale',
  ]
  const totalCol = headers.length
  headers.forEach((label, i) => {
    const cell = ws.getCell(headerRow, i + 1)
    cell.value = label
    cell.font = font(11, true, WHITE)
    cell.fill = fill(NAVY)
    cell.border = allThin
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
  ws.getRow(headerRow).height = 30

  const firstData = headerRow + 1
  rows.forEach((article, index) => {
    const r = firstData + index
    const code = ws.getCell(r, 1)
    code.value = codeValue(article.code)
    code.alignment = { horizontal: 'center' }
    ws.getCell(r, 2).value = article.designation
    ENTREPOTS.forEach((e, i) => {
      const cell = ws.getCell(r, 3 + i)
      cell.value = article.qty.get(e) ?? 0
      cell.numFmt = qtyFormat
      cell.alignment = { horizontal: 'center' }
    })
    const first = ws.getColumn(3).letter
    const lastQty = ws.getColumn(totalCol - 1).letter
    const total = ws.getCell(r, totalCol)
    total.value = {
      formula: `SUM(${first}${r}:${lastQty}${r})`,
      result: [...article.qty.values()].reduce((acc, n) => acc + n, 0),
    }
    total.numFmt = '#,##0'
    total.font = font(11, true)
    total.fill = fill(PALE_BLUE)
    total.alignment = { horizontal: 'center' }
    for (let c = 1; c <= totalCol; c++) ws.getCell(r, c).border = allThin
  })

  const totalRow = firstData + rows.length
  ws.getCell(totalRow, 1).value = 'TOTAL'
  for (let c = 1; c <= totalCol; c++) {
    const cell = ws.getCell(totalRow, c)
    cell.fill = fill(PALE_BLUE)
    cell.font = font(12, true)
    cell.border = allThin
    if (c < 3) continue
    const letter = ws.getColumn(c).letter
    const result = rows.reduce(
      (acc, a) =>
        acc +
        (c === totalCol
          ? [...a.qty.values()].reduce((s, n) => s + n, 0)
          : (a.qty.get(ENTREPOTS[c - 3]) ?? 0)),
      0
    )
    cell.value = rows.length
      ? { formula: `SUM(${letter}${firstData}:${letter}${totalRow - 1})`, result }
      : 0
    cell.numFmt = '#,##0'
    cell.alignment = { horizontal: 'center' }
  }
  ws.getRow(totalRow).height = 18

  ws.pageSetup.printArea = `A1:${ws.getColumn(totalCol).letter}${totalRow}`
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
  await addLetterhead(workbook, ws, 2, widths.length)

  const font = (size = 11, bold = false): Partial<ExcelJS.Font> => ({
    name: 'Calibri',
    size,
    bold,
    color: { argb: BLACK },
  })

  const titleRow = LETTERHEAD_ROWS + 2
  ws.getCell(`B${titleRow}`).value = "FICHE D'ENTRÉE"
  ws.getCell(`B${titleRow}`).font = font(16, true)
  ws.getCell(`B${titleRow + 1}`).value =
    `Date : ${day.toFormat('dd/MM/yyyy')}${entrepot ? ` — Entrepôt ${entrepot}` : ''}`
  ws.getCell(`B${titleRow + 1}`).font = font(11, true)

  const headerRow = titleRow + 3
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

  ws.pageSetup.printArea = `B1:${ws.getColumn(lastCol).letter}${totalRow}`

  return workbook
}

const GREEN = 'FF00B050'
const DARK_BLUE = 'FF1F497D'
const OLIVE = 'FF4F6228'
const RED = 'FFFF0000'
const LIGHT_GREY = 'FFF2F2F2'

type RegistreColumn = {
  header: string
  width: number
  value: (entry: Entry) => ExcelJS.CellValue
  font?: { size: number; bold?: boolean; color?: string }
  numFmt?: string
  fill?: string
}

/**
 * Columns A–S of the "ENTREPOT n" sheets, in the order, widths and fonts
 * of "FICHE D'ENTRE 13-11-2026 ORIGINE.xlsx". Headers are kept verbatim
 * so the file can be imported back with `import:excel`.
 */
const REGISTRE_COLUMNS: RegistreColumn[] = [
  { header: 'N° ORDRE', width: 11.4, value: (e) => codeValue(e.numeroOrdre) },
  {
    header: 'Date Réception',
    width: 15.6,
    value: (e) => (e.dateReception ? excelDate(e.dateReception) : null),
    font: { size: 12 },
    numFmt: 'dd/mm/yyyy',
  },
  {
    header: 'Code Article',
    width: 14,
    value: (e) => codeValue(e.codeArticle),
    font: { size: 13, color: DARK_BLUE },
  },
  { header: 'Désignation (auto)', width: 24.6, value: (e) => e.designation, font: { size: 12 } },
  { header: 'Fournisseur', width: 19.7, value: (e) => e.fournisseur, font: { size: 12 } },
  {
    header: 'N° BL ',
    width: 26,
    value: (e) => e.numeroBl,
    font: { size: 13, color: DARK_BLUE },
  },
  { header: 'N° MARCHE', width: 13.3, value: (e) => e.numeroMarche, font: { size: 12 } },
  {
    header: 'N° Order Affectation',
    width: 13.6,
    value: (e) => codeValue(e.numeroOrdreAffectation),
  },
  {
    header: ' N° de livraison entrante',
    width: 16.7,
    value: (e) => codeValue(e.numeroLivraisonEntrante),
  },
  {
    header: 'Qté Recus',
    width: 13.1,
    value: (e) => e.qteRecue,
    font: { size: 12 },
    numFmt: '#,##0',
  },
  {
    header: 'Zone Dest',
    width: 10.9,
    value: (e) => e.zoneDest,
    font: { size: 13 },
    fill: LIGHT_GREY,
  },
  { header: 'Quai Attribué', width: 16.6, value: (e) => e.quai },
  {
    header: 'Statut Commande',
    width: 24,
    value: (e) => e.statut,
    font: { size: 13, bold: true, color: OLIVE },
  },
  {
    header: 'Écart Réception (auto)',
    width: 13.3,
    value: (e) => e.ecart,
    // Shortages read "MOINS 5" like in the original, but stay numbers.
    numFmt: '#,##0;"MOINS "#,##0;0',
  },
  { header: 'Contrôleur', width: 13.7, value: (e) => e.controleur },
  { header: 'Matricule', width: 18.6, value: (e) => e.matricule, font: { size: 12 } },
  { header: 'Nom du Chauffeur', width: 25.6, value: (e) => e.chauffeur, font: { size: 12 } },
  { header: 'CNE', width: 13.9, value: (e) => e.cne },
  {
    header: 'N° TELE',
    width: 13.9,
    value: (e) => e.telephone,
    font: { size: 12 },
    numFmt: '@',
  },
]

/**
 * Export C: the entry register, laid out like
 * "FICHE D'ENTRE 13-11-2026 ORIGINE.xlsx": one "ENTREPOT n" sheet per
 * warehouse, every entry received between `from` and `to` (both optional,
 * inclusive), then a totals row.
 */
export async function buildRegistreWorkbook(range: { from?: DateTime; to?: DateTime }) {
  const query = Entry.query()
  if (range.from) query.where('date_reception', '>=', range.from.toISODate()!)
  if (range.to) query.where('date_reception', '<=', range.to.toISODate()!)
  const entries = await query
    .orderByRaw('date_reception ASC NULLS LAST')
    .orderByRaw(`${NUMERO_ORDRE_NUMERIC_SQL} ASC NULLS LAST`)
    .orderBy('id', 'asc')

  const sheets: { name: string; entries: Entry[] }[] = ENTREPOTS.map((e) => ({
    name: `ENTREPOT ${e}`,
    entries: entries.filter((entry) => entry.entrepot === e),
  }))
  const unassigned = entries.filter((entry) => !entry.entrepot)
  if (unassigned.length) sheets.push({ name: 'SANS ENTREPOT', entries: unassigned })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Entropos'

  const font = (size: number, bold = false, color = BLACK): Partial<ExcelJS.Font> => ({
    name: 'Calibri',
    size,
    bold,
    color: { argb: color },
  })
  const position = (header: string) => REGISTRE_COLUMNS.findIndex((c) => c.header === header) + 1
  const col = (header: string) => columnLetter(position(header))
  const last = columnLetter(REGISTRE_COLUMNS.length)

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name, {
      views: [{ zoomScale: 90 }],
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    })
    ws.columns = REGISTRE_COLUMNS.map((c) => ({ width: c.width }))
    await addLetterhead(workbook, ws, 1, REGISTRE_COLUMNS.length)

    const headerNumber = LETTERHEAD_ROWS + 1
    const headerRow = ws.getRow(headerNumber)
    headerRow.height = 60
    REGISTRE_COLUMNS.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = c.header
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = allThin
      // N° ORDRE has no fill in the original; Statut is written in red.
      if (i === 0) {
        cell.font = font(14)
      } else {
        cell.font = font(14, true, c.header === 'Statut Commande' ? RED : DARK_BLUE)
        cell.fill = fill(GREEN)
      }
    })

    sheet.entries.forEach((entry, index) => {
      const row = ws.getRow(headerNumber + 1 + index)
      row.height = 36
      REGISTRE_COLUMNS.forEach((c, i) => {
        const cell = row.getCell(i + 1)
        cell.value = c.value(entry) ?? null
        cell.font = font(c.font?.size ?? 11, c.font?.bold, c.font?.color)
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = allThin
        if (c.numFmt) cell.numFmt = c.numFmt
        if (c.fill) cell.fill = fill(c.fill)
      })
    })

    const firstData = headerNumber + 1
    const lastData = Math.max(firstData, headerNumber + sheet.entries.length)

    /**
     * Totals row, as in the original. Only written when there are entries:
     * its SUM formulas are what makes `import:excel` skip it.
     */
    let lastRow = lastData
    if (sheet.entries.length) {
      const totalRow = lastData + 1
      lastRow = totalRow
      // "TOTAL" sits just left of the Qté column.
      const label = ws.getCell(totalRow, position('Qté Recus') - 1)
      label.value = 'TOTAL'
      label.font = font(12, true)
      label.alignment = { horizontal: 'center', vertical: 'middle' }
      for (const [name, result] of [
        ['Qté Recus', sheet.entries.reduce((acc, e) => acc + (e.qteRecue ?? 0), 0)],
        ['Écart Réception (auto)', sheet.entries.reduce((acc, e) => acc + (e.ecart ?? 0), 0)],
      ] as const) {
        const letter = col(name)
        const cell = ws.getCell(`${letter}${totalRow}`)
        cell.value = { formula: `SUM(${letter}${firstData}:${letter}${lastData})`, result }
        cell.font = font(12, true)
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.numFmt = REGISTRE_COLUMNS[position(name) - 1].numFmt!
      }
    }

    /**
     * Drop-down lists like the original's, on the data rows plus some
     * room below for rows typed by hand.
     */
    const list = (name: string, values: readonly string[], strict: boolean) => {
      const column = ws.getColumn(position(name))
      for (let r = firstData; r <= lastData + 200; r++) {
        ws.getCell(r, column.number).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${values.join(',')}"`],
          showErrorMessage: strict,
        }
      }
    }
    list('Quai Attribué', QUAIS, true)
    list('Statut Commande', STATUTS, true)
    list('Contrôleur', CONTROLEURS_INITIAUX, false)

    ws.autoFilter = `A${headerNumber}:${last}${lastData}`
    ws.pageSetup.printArea = `A1:${last}${lastRow}`
    // The column headers repeat on every printed page.
    ws.pageSetup.printTitlesRow = `${headerNumber}:${headerNumber}`
  }

  return workbook
}

/**
 * 1 → A, 19 → S, 27 → AA.
 */
function columnLetter(index: number) {
  let n = index
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
