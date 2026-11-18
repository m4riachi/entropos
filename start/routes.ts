/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router
  .group(() => {
    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.on('/').redirectToPath('/entrees').as('home')

    router.get('entrees', [controllers.Entries, 'index']).as('entries.index')
    router.get('entrees/nouvelle', [controllers.Entries, 'create']).as('entries.create')
    router.post('entrees', [controllers.Entries, 'store']).as('entries.store')
    router.get('entrees/:id/modifier', [controllers.Entries, 'edit']).as('entries.edit')
    router.put('entrees/:id', [controllers.Entries, 'update']).as('entries.update')
    router.delete('entrees/:id', [controllers.Entries, 'destroy']).as('entries.destroy')

    router.get('exports/situation-stock', [controllers.Exports, 'stock']).as('exports.stock')
    router.get('exports/fiche-entree', [controllers.Exports, 'fiche']).as('exports.fiche')
    router.get('exports/registre', [controllers.Exports, 'registre']).as('exports.registre')

    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())
