import User from '#models/user'
import { errors as authErrors } from '@adonisjs/auth'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  async store({ request, auth, response, session }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    let user: User
    try {
      user = await User.verifyCredentials(email.trim().toLowerCase(), password)
    } catch (error) {
      // Only wrong credentials get the friendly message; anything else
      // (e.g. database down) must surface as a real error.
      if (!(error instanceof authErrors.E_INVALID_CREDENTIALS)) throw error
      session.flash('error', 'Email ou mot de passe incorrect')
      return response.redirect().back()
    }

    await auth.use('web').login(user)
    response.redirect().toRoute('entries.index')
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    response.redirect().toRoute('session.create')
  }
}
