import Anthropic from '@anthropic-ai/sdk'
import env from '#start/env'

const MODEL = 'claude-opus-5-5'

export type BlMediaType =
  'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'

/**
 * Fields of the entry form that a bon de livraison can fill. Values are
 * copied as written on the document; null when absent or unreadable.
 */
export type BlFields = {
  fournisseur: string | null
  numeroBl: string | null
  numeroMarche: string | null
  numeroOrdreAffectation: string | null
  numeroLivraisonEntrante: string | null
  matricule: string | null
  chauffeur: string | null
  cne: string | null
  telephone: string | null
  transporteur: string | null
  depart: string | null
  destination: string | null
}

export type BlArticle = {
  codeArticle: string | null
  designation: string | null
  quantite: number | null
}

export type BlExtraction = {
  fields: BlFields
  articles: BlArticle[]
  remarques: string | null
}

export class BlExtractionError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const nullableInteger = { anyOf: [{ type: 'integer' }, { type: 'null' }] }

const FIELD_DESCRIPTIONS: Record<keyof BlFields, string> = {
  fournisseur: 'Supplier / sender company name',
  numeroBl: 'Delivery note number (N° BL, N° bon de livraison)',
  numeroMarche: 'Contract number (N° marché), often like "47FS/2026"',
  numeroOrdreAffectation: "Assignment order number (N° ordre d'affectation)",
  numeroLivraisonEntrante: 'Inbound delivery number (N° de livraison entrante)',
  matricule: 'Truck licence plate (matricule), e.g. "67890/E/1"',
  chauffeur: 'Driver full name',
  cne: 'Driver national ID card number (CIN / CNE)',
  telephone: 'Driver phone number, digits only',
  transporteur: 'Transport / carrier company',
  depart: 'Departure city (lieu de départ / chargement)',
  destination: 'Destination city (lieu de livraison)',
}

const SCHEMA = {
  type: 'object',
  properties: {
    fields: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(FIELD_DESCRIPTIONS).map(([key, description]) => [
          key,
          { ...nullableString, description },
        ])
      ),
      required: Object.keys(FIELD_DESCRIPTIONS),
      additionalProperties: false,
    },
    articles: {
      type: 'array',
      description: 'One item per product line on the delivery note',
      items: {
        type: 'object',
        properties: {
          codeArticle: { ...nullableString, description: 'Article code' },
          designation: { ...nullableString, description: 'Product description' },
          quantite: { ...nullableInteger, description: 'Quantity delivered on the note' },
        },
        required: ['codeArticle', 'designation', 'quantite'],
        additionalProperties: false,
      },
    },
    remarques: {
      ...nullableString,
      description:
        'Short note in French for the user about anything unreadable or uncertain, or null',
    },
  },
  required: ['fields', 'articles', 'remarques'],
  additionalProperties: false,
}

const SYSTEM = `You read photos and scans of "bons de livraison" (delivery notes) received at a humanitarian warehouse in Morocco and extract the data needed to register the delivery.

Rules:
- Copy values as written on the document. Do not invent anything: use null for a field that is absent, illegible, or that you are unsure about, and mention it in "remarques".
- Documents are mostly in French, sometimes with Arabic. Keep French/Latin spellings for names when both exist.
- When a supplier or article matches one of the known values listed by the user (same name with a different spelling, case or abbreviation), return the known value exactly.
- For a known article code, use its known désignation.
- Quantities are whole numbers of units; remove thousands separators.
- Phone numbers: digits only, keep a leading 0.`

let client: Anthropic | undefined

function anthropic() {
  if (!env.get('ANTHROPIC_API_KEY')) {
    throw new BlExtractionError(
      "La lecture automatique des BL n'est pas configurée (clé ANTHROPIC_API_KEY manquante).",
      503
    )
  }
  client ??= new Anthropic({ apiKey: env.get('ANTHROPIC_API_KEY'), timeout: 120_000 })
  return client
}

/**
 * Reads one bon de livraison (image or PDF) with Claude and returns the
 * values found, ready to pre-fill the entry form. `known` lists values
 * already used in the app so names come back in the same spelling.
 */
export async function extractBonDeLivraison(
  file: { data: Buffer; mediaType: BlMediaType },
  known: { fournisseurs: string[]; articles: Record<string, string> }
): Promise<BlExtraction> {
  const document: Anthropic.Beta.BetaContentBlockParam =
    file.mediaType === 'application/pdf'
      ? {
          type: 'document',
          source: {
            type: 'base64',
            media_type: file.mediaType,
            data: file.data.toString('base64'),
          },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.mediaType,
            data: file.data.toString('base64'),
          },
        }

  const knownArticles = Object.entries(known.articles)
    .map(([code, designation]) => `${code} = ${designation}`)
    .join('\n')

  let response: Anthropic.Beta.BetaMessage
  try {
    response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Retries a safety-classifier decline on Anthropic's recommended model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            document,
            {
              type: 'text',
              text: [
                'Known suppliers:',
                known.fournisseurs.join('\n') || '(none yet)',
                '',
                'Known articles (code = désignation):',
                knownArticles || '(none yet)',
                '',
                'Extract the delivery note above.',
              ].join('\n'),
            },
          ],
        },
      ],
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new BlExtractionError('Trop de demandes, réessayez dans une minute.', 429)
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new BlExtractionError(
        "Le fichier n'a pas pu être lu. Essayez une photo plus nette ou un autre format.",
        422
      )
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new BlExtractionError('Clé ANTHROPIC_API_KEY invalide.', 503)
    }
    if (error instanceof Anthropic.APIError) {
      throw new BlExtractionError('Le service de lecture est indisponible, réessayez.', 502)
    }
    throw error
  }

  if (response.stop_reason === 'refusal') {
    throw new BlExtractionError("Ce document n'a pas pu être analysé.", 422)
  }
  if (response.stop_reason === 'max_tokens') {
    throw new BlExtractionError('La lecture du BL a été interrompue, réessayez.', 502)
  }

  const text = response.content.find((block) => block.type === 'text')
  if (!text || text.type !== 'text') {
    throw new BlExtractionError('Aucune donnée lue sur le BL.', 502)
  }
  return JSON.parse(text.text) as BlExtraction
}
