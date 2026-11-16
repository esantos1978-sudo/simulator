/**
 * Catálogo de opciones del simulador de mockups de PATIO.
 *
 * Este módulo lo consumen tanto la página (cliente) como la API (servidor),
 * así que solo contiene datos serializables: ids, etiquetas, descripciones y
 * colores de muestra. Los textos que se envían al modelo viven en
 * `lib/mockup/prompt.ts`.
 */

export const SHIRT_COLOR_IDS = [
  'blanca',
  'negra',
  'rosa-palo',
  'crema',
  'azul-marino',
  'verde-salvia',
  'rosa-empolvado',
  'azul-polvo',
] as const

export type ShirtColorId = (typeof SHIRT_COLOR_IDS)[number]

/**
 * Vistas de la prenda. `frontal` muestra el delantero; `trasera` la espalda,
 * con el cuello cerrado y sin escote delantero visible.
 */
export const VIEW_IDS = ['frontal', 'trasera'] as const

export type ShirtViewId = (typeof VIEW_IDS)[number]

/**
 * Posiciones del estampado. `manga-derecha`, `arriba-nuca`… solo se ofrecen en
 * una de las dos vistas: `DESIGN_POSITIONS_BY_VIEW` decide cuáles.
 * `sin-diseno` no es una zona, sino la ausencia de estampado principal: la cara
 * se genera lisa (solo la tela y, si se pide, el logo).
 */
export const DESIGN_POSITION_IDS = [
  'centrado-grande',
  'centrado-pequeno',
  'bolsillo',
  'izquierda-bolsillo',
  'abajo-izquierda',
  'abajo-derecha',
  'manga-izquierda',
  'manga-derecha',
  'arriba-nuca',
  'abajo-bajo',
  'sin-diseno',
] as const

export type DesignPositionId = (typeof DESIGN_POSITION_IDS)[number]

/** Posiciones disponibles en cada vista, en el orden en que se listan. */
export const DESIGN_POSITIONS_BY_VIEW: Record<
  ShirtViewId,
  readonly DesignPositionId[]
> = {
  frontal: [
    'centrado-grande',
    'centrado-pequeno',
    'bolsillo',
    'izquierda-bolsillo',
    'abajo-izquierda',
    'abajo-derecha',
    'manga-izquierda',
    'manga-derecha',
    'sin-diseno',
  ],
  trasera: [
    'centrado-grande',
    'centrado-pequeno',
    'arriba-nuca',
    'abajo-bajo',
    'sin-diseno',
  ],
}

export const LOGO_POSITION_IDS = [
  'manga-izquierda',
  'pecho-izquierdo',
  'bajo-derecho',
  'sin-logo',
] as const

export type LogoPositionId = (typeof LOGO_POSITION_IDS)[number]

export type Option<T extends string> = {
  id: T
  label: string
  description: string
}

export type ShirtColorOption = Option<ShirtColorId> & {
  /** Color de muestra para la previsualización (no es el color exacto de la tela). */
  swatch: string
  /** La tela es oscura: los trazos del esquema deben ir en claro. */
  isDark: boolean
  /**
   * Nombre del color en inglés y en mayúsculas (`SAGE GREEN`, `DUSTY ROSE`…).
   * Es el que se escribe en el prompt: los modelos de imagen identifican mejor
   * los tonos por su nombre inglés que por la etiqueta en español.
   */
  promptKeyword: string
}

export const SHIRT_COLORS: readonly ShirtColorOption[] = [
  {
    id: 'blanca',
    label: 'Blanca',
    description: 'Algodón blanco suave',
    swatch: '#f3f1eb',
    isDark: false,
    promptKeyword: 'SOFT WHITE',
  },
  {
    id: 'negra',
    label: 'Negra',
    description: 'Negro lavado',
    swatch: '#171717',
    isDark: true,
    promptKeyword: 'WASHED BLACK',
  },
  {
    id: 'rosa-palo',
    label: 'Rosa palo',
    description: 'Rosa empolvado',
    swatch: '#e8c9c3',
    isDark: false,
    promptKeyword: 'DUSTY PALE PINK',
  },
  {
    id: 'crema',
    label: 'Crema',
    description: 'Crudo cálido',
    swatch: '#ede3d2',
    isDark: false,
    promptKeyword: 'WARM CREAM',
  },
  {
    id: 'azul-marino',
    label: 'Azul marino',
    description: 'Azul profundo',
    swatch: '#1e2a3c',
    isDark: true,
    promptKeyword: 'DEEP NAVY',
  },
  {
    id: 'verde-salvia',
    label: 'Verde Salvia',
    description: 'Verde grisáceo suave, tono natural y orgánico.',
    swatch: '#9caf88',
    isDark: false,
    promptKeyword: 'SAGE GREEN',
  },
  {
    id: 'rosa-empolvado',
    label: 'Rosa Empolvado',
    description: 'Rosa apagado y elegante, tono cálido suave.',
    swatch: '#d4a5a5',
    isDark: false,
    promptKeyword: 'DUSTY ROSE',
  },
  {
    id: 'azul-polvo',
    label: 'Azul Polvo',
    description: 'Azul cielo lavado, tono fresco y relajado.',
    swatch: '#a8c8e8',
    isDark: false,
    promptKeyword: 'POWDER BLUE',
  },
]

export const VIEWS: readonly Option<ShirtViewId>[] = [
  {
    id: 'frontal',
    label: 'Frontal',
    description: 'Delantero de la prenda, con el escote a la vista',
  },
  {
    id: 'trasera',
    label: 'Trasera',
    description: 'Espalda de la prenda, con el cuello cerrado',
  },
]

export const DESIGN_POSITIONS: readonly (Option<DesignPositionId> & {
  /** Vistas en las que esta posición tiene sentido. */
  views: readonly ShirtViewId[]
})[] = [
  {
    id: 'centrado-grande',
    label: 'Centrado grande',
    description: 'Estampado principal, grande y centrado',
    views: ['frontal', 'trasera'],
  },
  {
    id: 'centrado-pequeno',
    label: 'Centrado pequeño',
    description: 'Versión reducida, centrada',
    views: ['frontal', 'trasera'],
  },
  {
    id: 'bolsillo',
    label: 'Bolsillo',
    description: 'Pequeño, sobre el pecho izquierdo, tipo bolsillo',
    views: ['frontal'],
  },
  {
    id: 'izquierda-bolsillo',
    label: 'Izquierda del bolsillo',
    description: 'Pequeño, al lado de donde iría un bolsillo',
    views: ['frontal'],
  },
  {
    id: 'abajo-izquierda',
    label: 'Abajo izquierda',
    description: 'Pequeño, en el bajo del lado izquierdo',
    views: ['frontal'],
  },
  {
    id: 'abajo-derecha',
    label: 'Abajo derecha',
    description: 'Pequeño, en el bajo del lado derecho',
    views: ['frontal'],
  },
  {
    id: 'manga-izquierda',
    label: 'Manga izquierda',
    description: 'Pequeño/medio, en la manga izquierda',
    views: ['frontal'],
  },
  {
    id: 'manga-derecha',
    label: 'Manga derecha',
    description: 'Pequeño/medio, en la manga derecha',
    views: ['frontal'],
  },
  {
    id: 'arriba-nuca',
    label: 'Arriba (nuca)',
    description: 'Pequeño, bajo el cuello de la espalda',
    views: ['trasera'],
  },
  {
    id: 'abajo-bajo',
    label: 'Abajo (bajo)',
    description: 'Grande, junto al bajo de la espalda',
    views: ['trasera'],
  },
  {
    id: 'sin-diseno',
    label: 'Sin diseño',
    description: 'Camiseta lisa, solo con el logo si lo hay',
    views: ['frontal', 'trasera'],
  },
]

export const LOGO_POSITIONS: readonly Option<LogoPositionId>[] = [
  {
    id: 'manga-izquierda',
    label: 'Manga izquierda',
    description: 'Logo pequeño en el exterior de la manga',
  },
  {
    id: 'pecho-izquierdo',
    label: 'Pecho izquierdo',
    description: 'Logo de pecho, estilo polo',
  },
  {
    id: 'bajo-derecho',
    label: 'Bajo derecho',
    description: 'Logo junto al bajo, lado derecho',
  },
  {
    id: 'sin-logo',
    label: 'Sin logo',
    description: 'Solo el estampado principal',
  },
]

export const DEFAULT_SHIRT_COLOR: ShirtColorId = 'blanca'
export const DEFAULT_VIEW: ShirtViewId = 'frontal'
export const DEFAULT_DESIGN_POSITION: DesignPositionId = 'centrado-grande'
export const DEFAULT_LOGO_POSITION: LogoPositionId = 'manga-izquierda'

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const ACCEPTED_UPLOAD_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
]

export function getShirtColor(id: ShirtColorId): ShirtColorOption {
  return SHIRT_COLORS.find((option) => option.id === id) ?? SHIRT_COLORS[0]
}

export function getView(id: ShirtViewId): Option<ShirtViewId> {
  return VIEWS.find((option) => option.id === id) ?? VIEWS[0]
}

export function getDesignPosition(
  id: DesignPositionId,
): Option<DesignPositionId> & { views: readonly ShirtViewId[] } {
  return DESIGN_POSITIONS.find((option) => option.id === id) ?? DESIGN_POSITIONS[0]
}

export function getLogoPosition(id: LogoPositionId): Option<LogoPositionId> {
  return LOGO_POSITIONS.find((option) => option.id === id) ?? LOGO_POSITIONS[0]
}

/** Posiciones ofrecidas para una vista, en el orden de `DESIGN_POSITIONS_BY_VIEW`. */
export function getDesignPositions(
  view: ShirtViewId,
): readonly (Option<DesignPositionId> & { views: readonly ShirtViewId[] })[] {
  return DESIGN_POSITIONS_BY_VIEW[view].map(getDesignPosition)
}

/** `true` si la posición pertenece a esa vista (p. ej. «Bolsillo» solo en frontal). */
export function isDesignPositionForView(
  view: ShirtViewId,
  id: DesignPositionId,
): boolean {
  return DESIGN_POSITIONS_BY_VIEW[view].includes(id)
}

/**
 * Devuelve la posición pedida si es válida para la vista; si no lo es (o falta),
 * cae en la primera posición de esa vista.
 */
export function resolveDesignPositionForView(
  view: ShirtViewId,
  id: DesignPositionId | null,
): DesignPositionId {
  if (id && isDesignPositionForView(view, id)) return id
  return DESIGN_POSITIONS_BY_VIEW[view][0]
}

export function isShirtColorId(value: unknown): value is ShirtColorId {
  return typeof value === 'string' && SHIRT_COLOR_IDS.includes(value as ShirtColorId)
}

export function isShirtViewId(value: unknown): value is ShirtViewId {
  return typeof value === 'string' && VIEW_IDS.includes(value as ShirtViewId)
}

export function isDesignPositionId(value: unknown): value is DesignPositionId {
  return (
    typeof value === 'string' &&
    DESIGN_POSITION_IDS.includes(value as DesignPositionId)
  )
}

/**
 * `true` cuando la cara elegida no lleva estampado principal («Sin diseño»): el
 * PNG del diseño deja de ser obligatorio y la prenda se genera lisa.
 */
export function isDesignlessPosition(id: DesignPositionId): boolean {
  return id === 'sin-diseno'
}

export function isLogoPositionId(value: unknown): value is LogoPositionId {
  return (
    typeof value === 'string' && LOGO_POSITION_IDS.includes(value as LogoPositionId)
  )
}

/**
 * Avisos de colocación: combinaciones en las que el estampado y el logo
 * compiten por la misma zona de la camiseta. Se muestran en el formulario y el
 * prompt le pide al modelo que reescale para que no se solapen.
 */
export function getPlacementWarning(
  designPosition: DesignPositionId,
  logoPosition: LogoPositionId,
  view: ShirtViewId,
): string | null {
  if (logoPosition === 'sin-logo') return null

  // Sin estampado principal no hay nada que pueda chocar con el logo.
  if (isDesignlessPosition(designPosition)) return null

  if (view === 'trasera' && logoPosition === 'pecho-izquierdo') {
    return 'El logo del pecho queda en la cara delantera: en la vista trasera no se verá en el mockup.'
  }

  if (
    designPosition === 'manga-izquierda' &&
    logoPosition === 'manga-izquierda'
  ) {
    return 'El estampado y el logo comparten manga: se reducirán para no solaparse.'
  }

  if (
    (designPosition === 'bolsillo' || designPosition === 'izquierda-bolsillo') &&
    logoPosition === 'pecho-izquierdo'
  ) {
    return 'El estampado y el logo de pecho comparten zona: se reescalarán para que quepan ambos.'
  }

  if (
    (designPosition === 'centrado-grande' ||
      designPosition === 'centrado-pequeno') &&
    logoPosition === 'pecho-izquierdo'
  ) {
    return 'El estampado centrado cubre el pecho: el logo se colocará sobre el borde superior sin taparlo.'
  }

  return null
}
