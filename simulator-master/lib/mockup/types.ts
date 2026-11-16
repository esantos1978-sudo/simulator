/**
 * Contratos de datos compartidos entre la API y el cliente.
 */

export type MockupImage = {
  mimeType: string
  /** Imagen en base64, sin el prefijo `data:`. */
  data: string
  /** Imagen lista para usar en un `<img src="...">`. */
  dataUrl: string
}

export type MockupSuccessResponse = {
  image: MockupImage
  /** Prompt exacto enviado a Gemini (útil para depurar). */
  prompt: string
  model: string
}

export type MockupErrorResponse = {
  error: string
  detail?: string
}

export type MockupResponse = MockupSuccessResponse | MockupErrorResponse

export function isMockupSuccess(
  response: MockupResponse,
): response is MockupSuccessResponse {
  return 'image' in response
}
