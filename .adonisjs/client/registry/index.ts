/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

export type { Route, Path } from './schema.d.ts'

const placeholder: any = {}

const routes = {
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [[0,"login"]],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [[0,"login"]],
    types: placeholder as Registry['session.store']['types'],
  },
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [[0,"/"]],
    types: placeholder as Registry['home']['types'],
  },
  'entries.index': {
    methods: ["GET","HEAD"],
    pattern: '/entrees',
    tokens: [[0,"entrees"]],
    types: placeholder as Registry['entries.index']['types'],
  },
  'entries.create': {
    methods: ["GET","HEAD"],
    pattern: '/entrees/nouvelle',
    tokens: [[0,"entrees"],[0,"nouvelle"]],
    types: placeholder as Registry['entries.create']['types'],
  },
  'entries.store': {
    methods: ["POST"],
    pattern: '/entrees',
    tokens: [[0,"entrees"]],
    types: placeholder as Registry['entries.store']['types'],
  },
  'entries.edit': {
    methods: ["GET","HEAD"],
    pattern: '/entrees/:id/modifier',
    tokens: [[0,"entrees"],[1,"id"],[0,"modifier"]],
    types: placeholder as Registry['entries.edit']['types'],
  },
  'entries.update': {
    methods: ["PUT"],
    pattern: '/entrees/:id',
    tokens: [[0,"entrees"],[1,"id"]],
    types: placeholder as Registry['entries.update']['types'],
  },
  'entries.destroy': {
    methods: ["DELETE"],
    pattern: '/entrees/:id',
    tokens: [[0,"entrees"],[1,"id"]],
    types: placeholder as Registry['entries.destroy']['types'],
  },
  'exports.stock': {
    methods: ["GET","HEAD"],
    pattern: '/exports/situation-stock',
    tokens: [[0,"exports"],[0,"situation-stock"]],
    types: placeholder as Registry['exports.stock']['types'],
  },
  'exports.fiche': {
    methods: ["GET","HEAD"],
    pattern: '/exports/fiche-entree',
    tokens: [[0,"exports"],[0,"fiche-entree"]],
    types: placeholder as Registry['exports.fiche']['types'],
  },
  'exports.daily': {
    methods: ["GET","HEAD"],
    pattern: '/exports/entrees-du-jour',
    tokens: [[0,"exports"],[0,"entrees-du-jour"]],
    types: placeholder as Registry['exports.daily']['types'],
  },
  'exports.registre': {
    methods: ["GET","HEAD"],
    pattern: '/exports/registre',
    tokens: [[0,"exports"],[0,"registre"]],
    types: placeholder as Registry['exports.registre']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [[0,"logout"]],
    types: placeholder as Registry['session.destroy']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
