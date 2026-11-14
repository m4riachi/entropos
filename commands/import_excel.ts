import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { importOrigineWorkbook } from '#services/excel_import'

export default class ImportExcel extends BaseCommand {
  static commandName = 'import:excel'
  static description =
    'Import the "FICHE D\'ENTRE … ORIGINE" workbook (sheets ENTREPOT 1–4). Re-running replaces the previous import.'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Path to the ORIGINE .xlsx file' })
  declare file: string

  @flags.array({
    description:
      'Optional "FICHE D\'entree" workbooks used to fill Départ / Destination / Transporteur by date + matricule',
  })
  declare fiche?: string[]

  @flags.boolean({ description: 'Parse and report without writing to the database' })
  declare dryRun?: boolean

  async run() {
    const report = await importOrigineWorkbook(this.file, {
      ficheFiles: this.fiche ?? [],
      dryRun: Boolean(this.dryRun),
    })

    for (const line of report.perSheet) {
      this.logger.info(`${line.sheet}: ${line.imported} lignes (${line.skipped} ignorées)`)
    }
    this.logger.info(`Départ/Transporteur complétés depuis les fiches : ${report.backfilled}`)
    if (report.warnings.length) {
      for (const w of report.warnings) this.logger.warning(w)
    }
    if (this.dryRun) {
      this.logger.info('Dry run: aucune donnée écrite')
    } else {
      this.logger.success(
        `${report.total} entrées importées (${report.deleted} entrées d'un import précédent remplacées)`
      )
    }
  }
}
