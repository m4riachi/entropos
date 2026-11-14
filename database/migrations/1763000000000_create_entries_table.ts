import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'entries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      table.smallint('entrepot').nullable()
      table.string('numero_ordre', 50).nullable()
      table.date('date_reception').nullable()
      table.string('code_article', 100).nullable()
      table.string('designation', 255).nullable()
      table.string('fournisseur', 255).nullable()
      table.string('numero_bl', 100).nullable()
      table.string('numero_marche', 100).nullable()
      table.string('numero_ordre_affectation', 100).nullable()
      table.string('numero_livraison_entrante', 100).nullable()
      table.integer('qte_bl').nullable()
      table.integer('qte_recue').nullable()
      table.string('zone_dest', 100).nullable()
      table.string('quai', 20).nullable()
      table.string('statut', 50).nullable()
      table.string('controleur', 255).nullable()
      table.string('matricule', 100).nullable()
      table.string('chauffeur', 255).nullable()
      table.string('cne', 50).nullable()
      table.string('telephone', 50).nullable()
      table.string('depart', 255).nullable()
      table.string('destination', 255).nullable()
      table.string('transporteur', 255).nullable()

      /**
       * Marks rows created by the Excel import, so re-running the
       * import replaces them instead of duplicating.
       */
      table.string('import_source', 100).nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['entrepot'])
      table.index(['date_reception'])
      table.index(['import_source'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
