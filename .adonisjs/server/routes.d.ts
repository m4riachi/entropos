import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'entries.index': { paramsTuple?: []; params?: {} }
    'entries.create': { paramsTuple?: []; params?: {} }
    'entries.store': { paramsTuple?: []; params?: {} }
    'entries.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'entries.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'entries.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'exports.stock': { paramsTuple?: []; params?: {} }
    'exports.fiche': { paramsTuple?: []; params?: {} }
    'exports.daily': { paramsTuple?: []; params?: {} }
    'exports.registre': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'session.create': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'entries.index': { paramsTuple?: []; params?: {} }
    'entries.create': { paramsTuple?: []; params?: {} }
    'entries.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'exports.stock': { paramsTuple?: []; params?: {} }
    'exports.fiche': { paramsTuple?: []; params?: {} }
    'exports.daily': { paramsTuple?: []; params?: {} }
    'exports.registre': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'session.create': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'entries.index': { paramsTuple?: []; params?: {} }
    'entries.create': { paramsTuple?: []; params?: {} }
    'entries.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'exports.stock': { paramsTuple?: []; params?: {} }
    'exports.fiche': { paramsTuple?: []; params?: {} }
    'exports.daily': { paramsTuple?: []; params?: {} }
    'exports.registre': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'session.store': { paramsTuple?: []; params?: {} }
    'entries.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'entries.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'entries.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}