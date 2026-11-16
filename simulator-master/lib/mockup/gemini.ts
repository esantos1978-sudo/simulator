/**
 * Cliente mínimo de la API de generación de imágenes de Gemini.
 *
 * Usamos la API REST directamente (sin SDK) para poder enviar el prompt y las
 * imágenes adjuntas (`inlineData`) en una sola petición y recibir la imagen
 * generada en base64.
 *
 * El catálogo de modelos de imagen de Google cambia a menudo, así que probamos
 * una cadena de modelos conocidos y nos quedamos con el primero que responda.
 * Cada petición va a `models/{model}:generateContent` con
 * `responseModalities: ['TEXT','IMAGE']`, que es el endpoint que devuelve la
 * imagen en un `inlineData`.
 *
 * Documentación: https://ai.google.dev/gemini-api/docs/image-generation
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 90_000

/**
 * Cadena de modelos de imagen, del más reciente al más antiguo:
 *  1. `gemini-nano-banana-2.1` — «Nano Banana 2.1», el recomendado ahora.
 *  2. `gemini-3.1-flash-image` — «Nano Banana 2», estable y hasta 4K.
 *  3. `gemini-2.5-flash-image` — «Nano Banana», el modelo legacy.
 */
const MODEL_CANDIDATES = [
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
] as const

/** Variables de entorno aceptadas como clave, por orden de prioridad. */
export const API_KEY_ENV_NAMES = ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] as const

export type ApiKeyInfo = {
  /** Clave ya normalizada: sin espacios, comillas ni el prefijo `GEMINI_API_KEY=`. */
  key: string | null
  /** Variable de la que se ha leído la clave. */
  source: (typeof API_KEY_ENV_NAMES)[number] | null
  /** Rarezas detectadas al leerla (se imprimen por consola al generar). */
  warnings: string[]
}

/** `AQ.Ab8RN6K…CGkQ`: permite reconocer la clave sin volcarla en los logs. */
export function maskSecret(value: string): string {
  if (value.length <= 14) return '••••'
  return `${value.slice(0, 10)}…${value.slice(-4)}`
}

/** Limpia lo que se cuela al copiar y pegar la clave en el `.env`. */
function normalizeApiKey(raw: string): { key: string; warnings: string[] } {
  const warnings: string[] = []

  if (/\r|\n/.test(raw)) warnings.push('contenía saltos de línea')
  if (/^\s|\s$/.test(raw)) warnings.push('tenía espacios al principio o al final')
  if (/^\s*['"]|['"]\s*$/.test(raw)) warnings.push('venía entre comillas')
  if (/^\s*(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY)\s*=/i.test(raw)) {
    warnings.push('incluía el prefijo «GEMINI_API_KEY=»')
  }

  const key = raw
    .replace(/^(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*/i, '')
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, '')

  const looksLikeGoogleKey =
    /^AIza[0-9A-Za-z_-]{30,}$/.test(key) || /^AQ\.[0-9A-Za-z._-]{20,}$/.test(key)

  if (!looksLikeGoogleKey) {
    warnings.push(
      'el formato no es el habitual de Google AI Studio (AIza… o AQ.…); puede ser una clave de otro servicio',
    )
  }

  return { key, warnings }
}

/** Lee `GEMINI_API_KEY` (o `GOOGLE_API_KEY`) del entorno y la normaliza. */
export function readApiKey(): ApiKeyInfo {
  for (const name of API_KEY_ENV_NAMES) {
    const raw = process.env[name]
    if (!raw || raw.trim().length === 0) continue

    const { key, warnings } = normalizeApiKey(raw)
    return { key: key.length > 0 ? key : null, source: name, warnings }
  }

  return { key: null, source: null, warnings: [] }
}

/** URL exacta del endpoint; la clave va en `?key=`, igual que en la documentación. */
export function buildGenerateContentUrl(model: string, apiKey: string): string {
  return `${API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
}

/** Misma URL pero con la clave enmascarada, segura para imprimir. */
export function redactUrl(url: string): string {
  return url.replace(/([?&]key=)([^&]*)/, (_match, prefix: string, value: string) => {
    let decoded = value
    try {
      decoded = decodeURIComponent(value)
    } catch {
      // Si no se puede decodificar, enmascaramos el valor tal cual.
    }
    return `${prefix}${maskSecret(decoded)}`
  })
}


export type InlineImage = {
  mimeType: string
  /** Contenido del archivo en base64. */
  data: string
}

export type GeminiImageResult = {
  mimeType: string
  data: string
  model: string
  /** Texto que el modelo devuelva junto a la imagen (suele ser descriptivo). */
  text?: string
}

export class GeminiError extends Error {
  readonly status: number
  readonly detail?: string
  /** El modelo no existe o la clave no tiene acceso: merece la pena probar otro. */
  readonly modelUnavailable: boolean

  constructor(
    message: string,
    status = 502,
    detail?: string,
    modelUnavailable = false,
  ) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
    this.detail = detail
    this.modelUnavailable = modelUnavailable
  }
}

type GeminiPart = {
  text?: string
  inlineData?: { mimeType?: string; data?: string }
}

type GeminiCandidate = {
  content?: { parts?: GeminiPart[] }
  finishReason?: string
}

type GeminiResponse = {
  candidates?: GeminiCandidate[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

/** Modelos a probar, en orden. `GEMINI_IMAGE_MODEL` fuerza uno concreto. */
export function resolveGeminiModels(): string[] {
  const configured = process.env.GEMINI_IMAGE_MODEL?.trim()
  return configured ? [configured] : [...MODEL_CANDIDATES]
}

/** Gemini avisa con 400 o 404 cuando el modelo no existe o no admite la llamada. */
function looksLikeMissingModel(detail?: string): boolean {
  if (!detail) return false
  return /not found|not supported|unsupported|does not exist|not available|no longer/i.test(
    detail,
  )
}

/** Google responde así cuando la clave enviada no existe, ha caducado o es de otro servicio. */
function looksLikeBadApiKey(detail?: string): boolean {
  if (!detail) return false
  return /api key not valid|api_key_invalid|api key expired|invalid api key|api key is invalid/i.test(
    detail,
  )
}

function readErrorDetail(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  try {
    const parsed = JSON.parse(trimmed) as GeminiResponse
    if (parsed.error?.message) return parsed.error.message
  } catch {
    // La respuesta no es JSON: devolvemos el texto en bruto recortado.
  }

  return trimmed.slice(0, 600)
}

/** Una única petición a `:generateContent` con un modelo concreto. */
async function requestGeneratedImage({
  apiKey,
  prompt,
  images,
  model,
}: {
  apiKey: string
  prompt: string
  images: InlineImage[]
  model: string
}): Promise<GeminiImageResult> {
  const url = buildGenerateContentUrl(model, apiKey)

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          ...images.map((image) => ({
            inlineData: { mimeType: image.mimeType, data: image.data },
          })),
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.4,
    },
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new GeminiError(
      'No hemos podido conectar con Gemini. Revisa la conexión e inténtalo de nuevo.',
      502,
      detail,
    )
  }

  if (!response.ok) {
    const detail = readErrorDetail(await response.text())
    const status =
      response.status === 400 || response.status === 429 || response.status === 404
        ? response.status
        : 502
    const modelUnavailable =
      response.status === 404 || looksLikeMissingModel(detail)

    if (looksLikeBadApiKey(detail)) {
      throw new GeminiError(
        'Gemini no reconoce la clave enviada (HTTP 400). Comprueba qué valor llega al servidor: si tienes GEMINI_API_KEY exportada en la terminal o en el sistema, tapa a la de .env.local y el servidor usará la equivocada.',
        400,
        detail,
      )
    }

    throw new GeminiError(
      `Gemini rechazó la petición (HTTP ${response.status}).`,
      status,
      detail,
      modelUnavailable,
    )
  }

  const body = (await response.json()) as GeminiResponse
  const candidate = body.candidates?.[0]
  const parts = candidate?.content?.parts ?? []
  const imagePart = parts.find((part) => Boolean(part.inlineData?.data))
  const text = parts
    .map((part) => part.text?.trim())
    .filter((value): value is string => Boolean(value))
    .join('\n')

  if (!imagePart?.inlineData?.data) {
    const reason = body.promptFeedback?.blockReason ?? candidate?.finishReason
    const detail = [reason ? `Motivo: ${reason}` : null, text || null]
      .filter(Boolean)
      .join(' · ')

    throw new GeminiError(
      'Gemini no devolvió ninguna imagen. Prueba con otro PNG o vuelve a intentarlo.',
      502,
      detail || undefined,
    )
  }

  return {
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    data: imagePart.inlineData.data,
    model,
    text: text || undefined,
  }
}

/**
 * Genera el mockup: recorre `resolveGeminiModels()` y devuelve la imagen del
 * primer modelo que responda. Si un modelo no existe o la clave no tiene acceso
 * (`404` o «not found»), pasamos al siguiente; el resto de errores se propagan.
 */
export async function generateMockupImage({
  apiKey,
  prompt,
  images,
}: {
  apiKey: string
  prompt: string
  images: InlineImage[]
}): Promise<GeminiImageResult> {
  const models = resolveGeminiModels()
  const tried: string[] = []
  let lastError: GeminiError | null = null

  for (const model of models) {
    tried.push(model)

    try {
      return await requestGeneratedImage({ apiKey, prompt, images, model })
    } catch (error) {
      if (!(error instanceof GeminiError)) throw error
      lastError = error
      if (!error.modelUnavailable) throw error

      const nextModel = models[tried.length]
      console.warn(
        `🔁 ${model} no está disponible (${error.detail ?? 'sin detalle'})`,
      )
      if (nextModel) console.warn(`   → probando ${nextModel}`)
    }
  }

  throw new GeminiError(
    `Ningún modelo de imagen respondió (${tried.join(', ')}). Revisa GEMINI_IMAGE_MODEL y que la clave tenga acceso a la generación de imágenes.`,
    502,
    lastError?.detail,
  )
}

