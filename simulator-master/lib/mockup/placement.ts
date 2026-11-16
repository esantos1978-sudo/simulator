/**
 * Geometría de colocación del esquema de la camiseta.
 *
 * El SVG (`app/simulador/shirt-schematic.tsx`) y el mapa interactivo comparten
 * estas medidas: las mismas cajas que dibujan la zona del estampado sirven para
 * traducir un clic a la posición válida más cercana. El módulo solo contiene
 * datos y funciones puras, así que puede importarse desde cliente y servidor.
 */

import {
  DESIGN_POSITIONS_BY_VIEW,
  type DesignPositionId,
  type ShirtViewId,
} from './options'

/** Lienzo del esquema: unidades del `viewBox` (proporción 400 × 440). */
export const SCHEMATIC_WIDTH = 400
export const SCHEMATIC_HEIGHT = 440

/** Rectángulo en unidades del lienzo del esquema. */
export type SchematicRect = { x: number; y: number; width: number; height: number }

/** Cara de la camiseta que dibuja el esquema. */
export type SchematicSide = 'front' | 'back'

/**
 * Zona aproximada del estampado para cada posición y cara del esquema.
 * En la vista frontal, el lado izquierdo del espectador es el derecho de quien
 * lleva la prenda (y al revés); igual que en el prompt.
 * Las posiciones que solo existen en una cara guardan un rectángulo espejo en
 * la otra: el formulario nunca ofrece esas combinaciones cruzadas, pero así el
 * mapa cubre las dos caras y el componente no necesita ramificar.
 * `null` significa que esa cara no lleva estampado («Sin diseño»).
 */
export const DESIGN_RECTS: Record<
  DesignPositionId,
  Record<SchematicSide, SchematicRect | null>
> = {
  'centrado-grande': {
    front: { x: 138, y: 146, width: 124, height: 156 },
    back: { x: 138, y: 132, width: 124, height: 160 },
  },
  'centrado-pequeno': {
    front: { x: 168, y: 150, width: 64, height: 80 },
    back: { x: 168, y: 136, width: 64, height: 80 },
  },
  bolsillo: {
    front: { x: 228, y: 118, width: 34, height: 34 },
    back: { x: 138, y: 118, width: 34, height: 34 },
  },
  'izquierda-bolsillo': {
    front: { x: 190, y: 122, width: 22, height: 22 },
    back: { x: 176, y: 122, width: 22, height: 22 },
  },
  'abajo-izquierda': {
    front: { x: 132, y: 330, width: 30, height: 30 },
    back: { x: 238, y: 330, width: 30, height: 30 },
  },
  'abajo-derecha': {
    front: { x: 238, y: 330, width: 30, height: 30 },
    back: { x: 132, y: 330, width: 30, height: 30 },
  },
  'manga-izquierda': {
    front: { x: 300, y: 92, width: 34, height: 42 },
    back: { x: 66, y: 92, width: 34, height: 42 },
  },
  'manga-derecha': {
    front: { x: 66, y: 92, width: 34, height: 42 },
    back: { x: 300, y: 92, width: 34, height: 42 },
  },
  'arriba-nuca': {
    front: { x: 174, y: 70, width: 52, height: 34 },
    back: { x: 174, y: 70, width: 52, height: 34 },
  },
  'abajo-bajo': {
    front: { x: 140, y: 286, width: 120, height: 104 },
    back: { x: 140, y: 286, width: 120, height: 104 },
  },
  'sin-diseno': {
    front: null,
    back: null,
  },
}

/**
 * Caja de acierto de una posición, en porcentaje del esquema (0-100).
 * Se usa para saber si un clic cae dentro de la zona y a qué distancia está.
 */
export type PlacementBox = {
  position: DesignPositionId
  /** Rango horizontal: [borde izquierdo, borde derecho]. */
  x: readonly [number, number]
  /** Rango vertical: [borde superior, borde inferior]. */
  y: readonly [number, number]
}

function toPercent(value: number, size: number): number {
  return (value / size) * 100
}

function toPlacementBox(
  position: DesignPositionId,
  rect: SchematicRect,
): PlacementBox {
  return {
    position,
    x: [
      toPercent(rect.x, SCHEMATIC_WIDTH),
      toPercent(rect.x + rect.width, SCHEMATIC_WIDTH),
    ],
    y: [
      toPercent(rect.y, SCHEMATIC_HEIGHT),
      toPercent(rect.y + rect.height, SCHEMATIC_HEIGHT),
    ],
  }
}

/**
 * Cajas de acierto de cada vista, derivadas de las mismas zonas que dibuja el
 * esquema para que el clic y la previsualización nunca se desalineen.
 * «Sin diseño» no es una zona: no se puede elegir haciendo clic.
 */
export const DESIGN_PLACEMENT_BOXES: Record<
  ShirtViewId,
  readonly PlacementBox[]
> = {
  frontal: DESIGN_POSITIONS_BY_VIEW.frontal.flatMap((position) => {
    const rect = DESIGN_RECTS[position].front
    return rect ? [toPlacementBox(position, rect)] : []
  }),
  trasera: DESIGN_POSITIONS_BY_VIEW.trasera.flatMap((position) => {
    const rect = DESIGN_RECTS[position].back
    return rect ? [toPlacementBox(position, rect)] : []
  }),
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** Distancia (en unidades del lienzo) del punto a la caja; 0 si está dentro. */
function distanceToBox(
  xPercent: number,
  yPercent: number,
  box: PlacementBox,
): number {
  const dx =
    xPercent < box.x[0]
      ? box.x[0] - xPercent
      : xPercent > box.x[1]
        ? xPercent - box.x[1]
        : 0
  const dy =
    yPercent < box.y[0]
      ? box.y[0] - yPercent
      : yPercent > box.y[1]
        ? yPercent - box.y[1]
        : 0

  return Math.hypot(
    (dx * SCHEMATIC_WIDTH) / 100,
    (dy * SCHEMATIC_HEIGHT) / 100,
  )
}

/** Distancia (en unidades del lienzo) del punto al centro de la caja. */
function distanceToBoxCenter(
  xPercent: number,
  yPercent: number,
  box: PlacementBox,
): number {
  const centerX = (box.x[0] + box.x[1]) / 2
  const centerY = (box.y[0] + box.y[1]) / 2

  return Math.hypot(
    ((xPercent - centerX) * SCHEMATIC_WIDTH) / 100,
    ((yPercent - centerY) * SCHEMATIC_HEIGHT) / 100,
  )
}

/**
 * Traduce un punto del esquema (en % de ancho/alto) a la posición de estampado
 * válida más cercana para esa vista.
 *
 * Gana la caja cuya distancia al punto es menor; si el punto cae dentro de
 * varias (el centrado pequeño está contenido en el grande), se desempata por
 * el centro más cercano. Así el pecho alto elige «Centrado pequeño» y el
 * centro del pecho «Centrado grande».
 */
export function getClosestPosition(
  xPercent: number,
  yPercent: number,
  view: ShirtViewId,
): DesignPositionId {
  const boxes = DESIGN_PLACEMENT_BOXES[view]
  const x = clampPercent(xPercent)
  const y = clampPercent(yPercent)

  let best = boxes[0]
  let bestEdgeDistance = Number.POSITIVE_INFINITY
  let bestCenterDistance = Number.POSITIVE_INFINITY

  for (const box of boxes) {
    const edgeDistance = distanceToBox(x, y, box)
    const centerDistance = distanceToBoxCenter(x, y, box)

    if (
      edgeDistance < bestEdgeDistance - 1e-6 ||
      (Math.abs(edgeDistance - bestEdgeDistance) <= 1e-6 &&
        centerDistance < bestCenterDistance)
    ) {
      best = box
      bestEdgeDistance = edgeDistance
      bestCenterDistance = centerDistance
    }
  }

  return best.position
}
