/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  home: typeof routes['home']
  entries: {
    index: typeof routes['entries.index']
    create: typeof routes['entries.create']
    store: typeof routes['entries.store']
    readBl: typeof routes['entries.readBl']
    edit: typeof routes['entries.edit']
    update: typeof routes['entries.update']
    destroy: typeof routes['entries.destroy']
  }
  exports: {
    stock: typeof routes['exports.stock']
    fiche: typeof routes['exports.fiche']
    daily: typeof routes['exports.daily']
    registre: typeof routes['exports.registre']
  }
}
