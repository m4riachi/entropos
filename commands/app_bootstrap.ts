import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import { importOrigineWorkbook } from '#services/excel_import'

/**
 * Optional one-off setup run before each deploy (see railway.json), driven
 * by environment variables so it works without shell access to the server:
 *
 * - ADMIN_EMAIL + ADMIN_PASSWORD: creates that account if it does not exist
 *   yet (an existing account is never modified). Remove ADMIN_PASSWORD
 *   once the account exists.
 * - IMPORT_ORIGINE_B64 (+ optional IMPORT_FICHE_B64): base64 of the Excel
 *   workbooks (optionally gzipped), imported with the same rules as
 *   `import:excel`. Re-importing replaces the previous import. Remove the
 *   variables once the import is done.
 *
 * With none of these variables set, the command does nothing.
 */
export default class AppBootstrap extends BaseCommand {
  static commandName = 'app:bootstrap'
  static description = 'Create the admin account / import Excel data from environment variables'
  static options: CommandOptions = { startApp: true }

  async run() {
    await this.ensureAdmin()
    await this.importFromEnv()
  }

  private async ensureAdmin() {
    const email = env.get('ADMIN_EMAIL')?.trim().toLowerCase()
    const password = env.get('ADMIN_PASSWORD')
    if (!email || !password) return

    const { default: User } = await import('#models/user')
    const existing = await User.findBy('email', email)
    if (existing) {
      this.logger.info(`Compte ${email} déjà présent, inchangé`)
      return
    }
    await User.create({ email, password })
    this.logger.success(`Compte ${email} créé`)
  }

  private async importFromEnv() {
    const origine = env.get('IMPORT_ORIGINE_B64')
    if (!origine) return

    const dir = await mkdtemp(join(tmpdir(), 'entropos-import-'))
    try {
      const decode = (value: string) => {
        const buffer = Buffer.from(value.replace(/\s+/g, ''), 'base64')
        // gzip magic number: 1f 8b
        return buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer
      }

      const origineFile = join(dir, 'origine.xlsx')
      await writeFile(origineFile, decode(origine))

      const ficheFiles: string[] = []
      const fiche = env.get('IMPORT_FICHE_B64')
      if (fiche) {
        const ficheFile = join(dir, 'fiche.xlsx')
        await writeFile(ficheFile, decode(fiche))
        ficheFiles.push(ficheFile)
      }

      const report = await importOrigineWorkbook(origineFile, { ficheFiles, dryRun: false })
      for (const line of report.perSheet) {
        this.logger.info(`${line.sheet}: ${line.imported} lignes`)
      }
      for (const warning of report.warnings) this.logger.warning(warning)
      this.logger.success(
        `${report.total} entrées importées (${report.deleted} remplacées, ${report.backfilled} complétées depuis la fiche)`
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
}
