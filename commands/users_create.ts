import { randomInt } from 'node:crypto'
import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

const ALPHABETS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%^&*-_=+?',
]

/**
 * 20 random characters with at least one of each kind.
 */
function generatePassword(length = 20) {
  const all = ALPHABETS.join('')
  const chars = ALPHABETS.map((set) => set[randomInt(set.length)])
  while (chars.length < length) chars.push(all[randomInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export default class UsersCreate extends BaseCommand {
  static commandName = 'users:create'
  static description =
    'Create a login account, or reset its password if it exists. Prints the password.'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Email used to log in' })
  declare email: string

  @flags.string({ description: 'Password to set (a strong one is generated if omitted)' })
  declare password?: string

  @flags.string({ description: 'Display name' })
  declare name?: string

  async run() {
    const { default: User } = await import('#models/user')
    const password = this.password ?? generatePassword()
    const email = this.email.trim().toLowerCase()

    const user = await User.updateOrCreate(
      { email },
      { email, password, fullName: this.name ?? null }
    )

    this.logger.success(`Compte prêt : ${user.email}`)
    this.logger.log(`Mot de passe : ${password}`)
  }
}
