import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import {
  SHIRT_COLORS,
  type DesignPositionId,
  type LogoPositionId,
  type ShirtColorId,
  type ShirtViewId,
} from '@/lib/mockup/options'
import {
  DESIGN_RECTS,
  SCHEMATIC_HEIGHT,
  SCHEMATIC_WIDTH,
  type SchematicRect,
  type SchematicSide,
} from '@/lib/mockup/placement'

/** Cara de la camiseta que dibuja el esquema. */
type Side = SchematicSide

type ShirtSchematicProps = {
  colorId: ShirtColorId
  view: ShirtViewId
  designPosition: DesignPositionId
  logoPosition: LogoPositionId
  /** Estilo del lienzo del SVG: el mapa interactivo lo transforma para el zoom. */
  frameStyle?: CSSProperties
  /** Capa HTML superpuesta al SVG (por ejemplo, el marcador del clic). */
  overlay?: ReactNode
  /** Clic sobre el SVG; el mapa interactivo lo usa para colocar el estampado. */
  onSvgClick?: (event: MouseEvent<SVGSVGElement>) => void
  /** La leyenda inferior se omite cuando el padre ya da su propio contexto. */
  showLegend?: boolean
}

/** Silueta de camiseta en un lienzo de 400 x 440. */
const BODY =
  'M150 34 L100 48 L58 104 L96 168 L120 156 L112 404 H288 L280 156 L304 168 L342 104 L300 48 L252 34'

const COLLARS: Record<Side, string> = {
  front: 'C238 52 220 62 200 62 C180 62 162 52 150 34 Z',
  back: 'C238 46 220 50 200 50 C180 50 162 46 150 34 Z',
}

const COLLAR_RIBS: Record<Side, string> = {
  front: 'M162 38 C172 50 184 55 200 55 C216 55 228 50 238 38',
  back: 'M162 36 C174 44 186 47 200 47 C214 47 226 44 238 36',
}

/**
 * Zona del logo. `back` se usa para la vista trasera; `null` significa que el
 * elemento no se ve desde esa cara de la camiseta.
 */
const LOGO_RECTS: Record<LogoPositionId, Record<Side, SchematicRect | null>> = {
  'manga-izquierda': {
    front: { x: 306, y: 100, width: 22, height: 22 },
    back: { x: 70, y: 100, width: 22, height: 22 },
  },
  'pecho-izquierdo': {
    front: { x: 232, y: 116, width: 22, height: 22 },
    back: null,
  },
  'bajo-derecho': {
    front: { x: 128, y: 352, width: 22, height: 22 },
    back: { x: 250, y: 352, width: 22, height: 22 },
  },
  'sin-logo': {
    front: null,
    back: null,
  },
}

export function ShirtSchematic({
  colorId,
  view,
  designPosition,
  logoPosition,
  frameStyle,
  overlay,
  onSvgClick,
  showLegend = true,
}: ShirtSchematicProps) {
  const color = SHIRT_COLORS.find((option) => option.id === colorId) ?? SHIRT_COLORS[0]
  const side: Side = view === 'trasera' ? 'back' : 'front'
  const design = DESIGN_RECTS[designPosition][side]
  const logo = LOGO_RECTS[logoPosition][side]

  // En telas oscuras los trazos del esquema van en claro.
  const detail = color.isDark ? '#f3f1eb' : '#111110'
  const viewLabel = side === 'back' ? 'Vista trasera' : 'Vista frontal'

  return (
    <div>
      <div
        className="relative mx-auto block w-full max-w-[300px]"
        style={frameStyle}
      >
        <svg
          viewBox={`0 0 ${SCHEMATIC_WIDTH} ${SCHEMATIC_HEIGHT}`}
          role="img"
          aria-label={`Esquema de camiseta ${color.label.toLowerCase()}, ${viewLabel.toLowerCase()}${
            onSvgClick ? '. Haz clic para colocar el estampado' : ''
          }`}
          onClick={onSvgClick}
          className="block h-auto w-full"
        >
        <defs>
          <pattern
            id="patio-hatch"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="7"
              stroke={detail}
              strokeWidth="1.25"
              opacity="0.7"
            />
          </pattern>
        </defs>

        {/* Cuerpo de la camiseta */}
        <path
          d={`${BODY} ${COLLARS[side]}`}
          fill={color.swatch}
          stroke={detail}
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Costuras: cuello, bajos de manga y bajo */}
        <path
          d={COLLAR_RIBS[side]}
          fill="none"
          stroke={detail}
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />
        <path
          d="M68 112 L101 166 M332 112 L299 166"
          fill="none"
          stroke={detail}
          strokeOpacity="0.22"
          strokeWidth="1.5"
        />
        <path
          d="M120 392 H280"
          fill="none"
          stroke={detail}
          strokeOpacity="0.22"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />

        {/* Zona del estampado */}
        {design ? (
          <rect
            x={design.x}
            y={design.y}
            width={design.width}
            height={design.height}
            fill="url(#patio-hatch)"
            stroke={detail}
            strokeOpacity="0.85"
            strokeWidth="1.5"
          />
        ) : null}

        {/* Zona del logo */}
        {logo ? (
          <rect
            x={logo.x}
            y={logo.y}
            width={logo.width}
            height={logo.height}
            fill={detail}
          />
        ) : null}
        </svg>

        {overlay ? (
          <div className="pointer-events-none absolute inset-0">{overlay}</div>
        ) : null}
      </div>

      {showLegend ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.16em] text-ink-soft">
          {design ? (
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 border border-ink/50"
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, ${detail} 0 1px, transparent 1px 4px)`,
                }}
              />
              Diseño
            </span>
          ) : null}
          {logo ? (
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3"
                style={{ backgroundColor: detail }}
              />
              Logo
            </span>
          ) : null}
          <span>{viewLabel}</span>
        </div>
      ) : null}
    </div>
  )
}
