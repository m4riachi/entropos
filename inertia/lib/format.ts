const numberFormat = new Intl.NumberFormat('fr-FR')

export function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : numberFormat.format(value)
}

/**
 * "2026-11-12" → "12/11/2026" without going through Date (no timezone shift).
 */
export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

export function todayIso() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
