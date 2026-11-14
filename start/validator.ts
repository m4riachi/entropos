/*
|--------------------------------------------------------------------------
| Validator file
|--------------------------------------------------------------------------
|
| The validator file is used for configuring global transforms for VineJS.
| The transform below converts all VineJS date outputs from JavaScript
| Date objects to Luxon DateTime instances, so that validated dates are
| ready to use with Lucid models and other parts of the app that expect
| Luxon DateTime.
|
*/

import { DateTime } from 'luxon'
import vine, { SimpleMessagesProvider, VineDate } from '@vinejs/vine'

declare module '@vinejs/vine/types' {
  interface VineGlobalTransforms {
    date: DateTime
  }
}

VineDate.transform((value) => DateTime.fromJSDate(value))

/**
 * French validation messages.
 */
vine.messagesProvider = new SimpleMessagesProvider({
  'required': 'Ce champ est obligatoire',
  'string': 'Doit être un texte',
  'email': 'Adresse email invalide',
  'number': 'Doit être un nombre',
  'withoutDecimals': 'Doit être un nombre entier',
  'min': 'Doit être supérieur ou égal à {{ min }}',
  'max': 'Doit être inférieur ou égal à {{ max }}',
  'maxLength': '{{ max }} caractères maximum',
  'date': 'Date invalide',
  'enum': 'Valeur non autorisée',
  'in': 'Valeur non autorisée',
  'regex': 'Format invalide',
  'telephone.regex': 'Chiffres, espaces et + uniquement',
})
