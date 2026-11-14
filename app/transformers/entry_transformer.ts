import type Entry from '#models/entry'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class EntryTransformer extends BaseTransformer<Entry> {
  toObject() {
    const e = this.resource
    return {
      id: e.id,
      entrepot: e.entrepot,
      numeroOrdre: e.numeroOrdre,
      dateReception: e.dateReception ? e.dateReception.toISODate() : null,
      codeArticle: e.codeArticle,
      designation: e.designation,
      fournisseur: e.fournisseur,
      numeroBl: e.numeroBl,
      numeroMarche: e.numeroMarche,
      numeroOrdreAffectation: e.numeroOrdreAffectation,
      numeroLivraisonEntrante: e.numeroLivraisonEntrante,
      qteBl: e.qteBl,
      qteRecue: e.qteRecue,
      ecart: e.ecart,
      zoneDest: e.zoneDest,
      quai: e.quai,
      statut: e.statut,
      controleur: e.controleur,
      matricule: e.matricule,
      chauffeur: e.chauffeur,
      cne: e.cne,
      telephone: e.telephone,
      depart: e.depart,
      destination: e.destination,
      transporteur: e.transporteur,
    }
  }
}
