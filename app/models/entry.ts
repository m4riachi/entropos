import { EntrySchema } from '#database/schema'

export default class Entry extends EntrySchema {
  /**
   * Écart réception = Qté reçue − Qté BL. Only meaningful
   * when both quantities are known.
   */
  get ecart(): number | null {
    if (this.qteRecue === null || this.qteBl === null) return null
    return this.qteRecue - this.qteBl
  }
}
