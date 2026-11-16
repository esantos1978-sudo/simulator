import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  buildGenerateContentUrl,
  GeminiError,
  generateMockupImage,
  maskSecret,
  readApiKey,
  redactUrl,
  resolveGeminiModels,
  type InlineImage,
} from '@/lib/mockup/gemini'
import {
  ACCEPTED_UPLOAD_TYPES,
  DEFAULT_DESIGN_POSITION,
  DEFAULT_LOGO_POSITION,
  DEFAULT_SHIRT_COLOR,
  DEFAULT_VIEW,
  DESIGN_POSITION_IDS,
  LOGO_POSITION_IDS,
  MAX_UPLOAD_BYTES,
  SHIRT_COLOR_IDS,
  VIEW_IDS,
  isDesignlessPosition,
  resolveDesignPositionForView,
  type DesignPositionId,
  type LogoPositionId,
  type ShirtColorId,
  type ShirtViewId,
} from '@/lib/mockup/options'
import { buildMockupPrompt } from '@/lib/mockup/prompt'
import type { MockupErrorResponse, MockupSuccessResponse } from '@/lib/mockup/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))

function errorResponse(message: string, status: number, detail?: string) {
  return NextResponse.json(
    { error: message, detail } satisfies MockupErrorResponse,
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left, 'utf8').digest()
  const rightHash = createHash('sha256').update(right, 'utf8').digest()
  return timingSafeEqual(leftHash, rightHash)
}

/**
 * En desarrollo la ruta queda abierta. En producción exige `MOCKUP_PASSWORD`;
 * si esa variable no existe, el endpoint responde 401 y queda inutilizable.
 */
function isAuthorized(form: FormData): boolean {
  if (process.env.NODE_ENV === 'development') return true

  const expected = process.env.MOCKUP_PASSWORD
  if (!expected) return false

  const provided = form.get('password')
  if (typeof provided !== 'string' || provided.length === 0) return false

  return constantTimeEqual(provided, expected)
}

function parseOption<T extends string>(
  value: FormDataEntryValue | null,
  ids: readonly T[],
): T | null {
  if (typeof value !== 'string') return null
  return ids.includes(value as T) ? (value as T) : null
}

function readFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null
}

function resolveMimeType(file: File): string {
  if (file.type) return file.type

  const extension = file.name.toLowerCase().split('.').pop()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'

  return 'application/octet-stream'
}

function validateFile(file: File, label: string): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${label} ocupa demasiado: el máximo son ${MAX_UPLOAD_MB} MB.`
  }

  if (!ACCEPTED_UPLOAD_TYPES.includes(resolveMimeType(file))) {
    return `${label} debe ser PNG, JPG o WEBP.`
  }

  return null
}

async function toInlineImage(file: File): Promise<InlineImage> {
  const buffer = Buffer.from(await file.arrayBuffer())
  return { mimeType: resolveMimeType(file), data: buffer.toString('base64') }
}

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return errorResponse(
      'No hemos podido leer el formulario. Inténtalo de nuevo.',
      400,
    )
  }

  if (!isAuthorized(form)) {
    return errorResponse(
      'Acceso restringido: contraseña incorrecta o simulador deshabilitado.',
      401,
    )
  }

  const apiKeyInfo = readApiKey()

  if (!apiKeyInfo.key) {
    return errorResponse(
      'Falta GEMINI_API_KEY en el entorno del servidor: añádela a .env.local.',
      503,
    )
  }

  const apiKey = apiKeyInfo.key

  const color: ShirtColorId =
    parseOption(form.get('color'), SHIRT_COLOR_IDS) ?? DEFAULT_SHIRT_COLOR
  const view: ShirtViewId = parseOption(form.get('view'), VIEW_IDS) ?? DEFAULT_VIEW
  // La posición debe pertenecer a la vista elegida; si no, se usa la primera
  // disponible en esa vista (p. ej. «Bolsillo» no existe en la espalda).
  const designPosition: DesignPositionId = resolveDesignPositionForView(
    view,
    parseOption(form.get('designPosition'), DESIGN_POSITION_IDS) ??
      DEFAULT_DESIGN_POSITION,
  )
  const logoPosition: LogoPositionId =
    parseOption(form.get('logoPosition'), LOGO_POSITION_IDS) ??
    DEFAULT_LOGO_POSITION

  // Con «Sin diseño» la cara se genera lisa: el arte no se adjunta (si el
  // cliente lo manda, se ignora) y deja de ser obligatorio.
  const designless = isDesignlessPosition(designPosition)
  const designFile = designless ? null : readFile(form.get('design'))

  if (!designless && !designFile) {
    return errorResponse(
      'Sube el PNG del diseño o elige «Sin diseño» en la posición.',
      400,
    )
  }

  if (designFile) {
    const designFileError = validateFile(designFile, 'El diseño')
    if (designFileError) return errorResponse(designFileError, 400)
  }

  // Con «Sin logo» no se adjunta el archivo aunque el cliente lo envíe (p. ej.
  // al reutilizar el mismo logo en la vista contraria): el prompt pide
  // explícitamente no añadir ninguna marca.
  const logoFile = logoPosition === 'sin-logo' ? null : readFile(form.get('logo'))
  if (logoFile) {
    const logoFileError = validateFile(logoFile, 'El logo')
    if (logoFileError) return errorResponse(logoFileError, 400)
  }

  if (logoPosition !== 'sin-logo' && !logoFile) {
    return errorResponse(
      'Has elegido una posición para el logo: sube su PNG o selecciona «Sin logo».',
      400,
    )
  }

  // Con «Sin diseño» y «Sin logo» no queda ninguna imagen: el prompt basta para
  // generar la camiseta lisa.
  const images: InlineImage[] = []
  if (designFile) images.push(await toInlineImage(designFile))
  if (logoFile) images.push(await toInlineImage(logoFile))

  const prompt = buildMockupPrompt({
    color,
    view,
    designPosition,
    logoPosition,
    hasLogo: Boolean(logoFile),
  })

  // Diagnóstico de la elección de vista y posición.
  console.log(
    '🧭 VISTA:',
    view,
    '· POSICIÓN:',
    designPosition,
    '· LOGO:',
    logoPosition,
    '· IMÁGENES:',
    images.length,
  )

  // Diagnóstico de la clave (nunca se imprime entera, solo los 10 primeros caracteres).
  console.log(
    '🔑 CLAVE LEÍDA:',
    maskSecret(apiKey),
    `(origen: ${apiKeyInfo.source ?? 'desconocido'})`,
  )
  console.log('🔑 LONGITUD:', apiKey.length)
  console.log(
    '🔑 URL FINAL:',
    redactUrl(buildGenerateContentUrl(resolveGeminiModels()[0], apiKey)),
  )
  for (const warning of apiKeyInfo.warnings) {
    console.warn('⚠️  Clave de Gemini:', warning)
  }

  try {
    const generated = await generateMockupImage({ apiKey, prompt, images })

    return NextResponse.json(
      {
        image: {
          mimeType: generated.mimeType,
          data: generated.data,
          dataUrl: `data:${generated.mimeType};base64,${generated.data}`,
        },
        prompt,
        model: generated.model,
      } satisfies MockupSuccessResponse,
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (generationError) {
    if (generationError instanceof GeminiError) {
      return errorResponse(
        generationError.message,
        generationError.status,
        generationError.detail,
      )
    }

    const detail =
      generationError instanceof Error
        ? generationError.message
        : String(generationError)

    return errorResponse('Error inesperado al generar el mockup.', 500, detail)
  }
}
