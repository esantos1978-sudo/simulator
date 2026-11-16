'use client'

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import {
  getDesignPosition,
  type DesignPositionId,
  type LogoPositionId,
  type ShirtColorId,
  type ShirtViewId,
} from '@/lib/mockup/options'
import { getClosestPosition } from '@/lib/mockup/placement'
import { ShirtSchematic } from './shirt-schematic'

/** Límites y paso del zoom interactivo. */
const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.5
/** Píxeles de arrastre a partir de los que el gesto es pan y no clic. */
const DRAG_THRESHOLD = 4
/** Sensibilidad de la rueda (Ctrl/Cmd + rueda o pinza del trackpad). */
const WHEEL_ZOOM_FACTOR = 0.0025

type Point = { x: number; y: number }
type Pan = { x: number; y: number }

type PickedPoint = Point & {
  position: DesignPositionId
  view: ShirtViewId
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  panX: number
  panY: number
  moved: boolean
}

type InteractiveShirtMapProps = {
  colorId: ShirtColorId
  view: ShirtViewId
  designPosition: DesignPositionId
  /** Giro (0-360º) elegido en el slider; orienta visualmente el marcador. */
  rotation?: number
  logoPosition: LogoPositionId
  /** Mientras se genera o el simulador está bloqueado no se aceptan clics. */
  disabled?: boolean
  /** Posición válida más cercana al punto pulsado (en % del esquema). */
  onPick: (position: DesignPositionId, point: Point) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function InteractiveShirtMap({
  colorId,
  view,
  designPosition,
  rotation = 0,
  logoPosition,
  disabled = false,
  onPick,
}: InteractiveShirtMapProps) {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 })
  const [picked, setPicked] = useState<PickedPoint | null>(null)
  const [dragging, setDragging] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)

  // Cada cara tiene su propio mapa: al cambiar de vista volvemos al encuadre
  // inicial para no arrastrar el zoom/pan de la cara anterior.
  useEffect(() => {
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
    setDragging(false)
    dragRef.current = null
  }, [view])

  // La rueda solo hace zoom con Ctrl/Cmd (o pinza del trackpad) para no
  // secuestrar el scroll de la página al pasar por encima del esquema.
  // El listener es nativo y no pasivo para poder llamar a preventDefault.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    function handleWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()

      setZoom((currentZoom) =>
        clamp(
          currentZoom - event.deltaY * WHEEL_ZOOM_FACTOR,
          MIN_ZOOM,
          MAX_ZOOM,
        ),
      )
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [])

  // Al alejar, el desplazamiento permitido se reduce; al volver al 100 % se
  // centra de nuevo.
  useEffect(() => {
    setPan((currentPan) => clampPanForZoom(currentPan, zoom))
  }, [zoom])

  /** Limita el desplazamiento a lo que sobresale el lienzo ampliado. */
  function clampPanForZoom(nextPan: Pan, zoomLevel: number): Pan {
    const viewport = viewportRef.current
    if (!viewport) return nextPan

    const maxX = (viewport.clientWidth * (zoomLevel - 1)) / 2
    const maxY = (viewport.clientHeight * (zoomLevel - 1)) / 2
    const x = clamp(nextPan.x, -maxX, maxX)
    const y = clamp(nextPan.y, -maxY, maxY)

    // Devolver el mismo objeto evita un render extra cuando no hay nada que
    // limitar (por ejemplo, al montar el mapa al 100 %).
    if (x === nextPan.x && y === nextPan.y) return nextPan

    return { x, y }
  }

  function changeZoom(nextZoom: number) {
    setZoom(clamp(nextZoom, MIN_ZOOM, MAX_ZOOM))
  }

  function resetView() {
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // Un gesto nuevo invalida la supresión pendiente del arrastre anterior.
    suppressClickRef.current = false

    if (event.button !== 0 || zoom <= MIN_ZOOM) return

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    }
    setDragging(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY

    if (!drag.moved) {
      if (Math.hypot(dx, dy) <= DRAG_THRESHOLD) return
      // Capturamos solo cuando el gesto ya es un arrastre: si se captura en
      // `pointerdown`, el `click` posterior se redirige al contenedor y el SVG
      // nunca recibiría el clic de colocación.
      drag.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    setPan(clampPanForZoom({ x: drag.panX + dx, y: drag.panY + dy }, zoom))
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    dragRef.current = null
    setDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!drag.moved) return

    // Tras un arrastre el navegador también emite `click`: lo ignoramos para
    // que mover el mapa no coloque el estampado. La marca se limpia en el
    // siguiente `pointerdown` (el clic posterior puede llegar o no).
    suppressClickRef.current = true
  }

  function handleSvgClick(event: MouseEvent<SVGSVGElement>) {
    if (disabled) return

    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    // El rectángulo ya incluye escala y desplazamiento: los porcentajes siguen
    // siendo correctos con zoom y pan aplicados.
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
    const position = getClosestPosition(x, y, view)

    setPicked({ x, y, position, view })
    onPick(position, { x, y })
  }

  // El marcador solo se ve si sigue correspondiendo a la cara y a la posición
  // elegidas: si el usuario cambia el desplegable, deja de tener sentido.
  const marker =
    picked && picked.view === view && picked.position === designPosition
      ? picked
      : null

  const cursorClass =
    zoom > MIN_ZOOM
      ? 'cursor-grab active:cursor-grabbing'
      : disabled
        ? 'cursor-default'
        : 'cursor-crosshair'

  // El giro del marcador se normaliza igual que en el prompt: 360º = 0º.
  const markerRotation = Number.isFinite(rotation)
    ? ((Math.round(rotation) % 360) + 360) % 360
    : 0

  const resetDisabled = zoom === MIN_ZOOM && pan.x === 0 && pan.y === 0

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="patio-label">Colocación interactiva</span>
        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label="Zoom del esquema"
        >
          <button
            type="button"
            onClick={() => changeZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Alejar el esquema"
            className="grid h-7 w-7 place-items-center border border-line text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-10 text-center font-mono text-[10px] text-ink-soft">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => changeZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Acercar el esquema"
            className="grid h-7 w-7 place-items-center border border-line text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
          <button
            type="button"
            onClick={resetView}
            disabled={resetDisabled}
            className="ml-1 border border-line px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reiniciar
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={() => {
          dragRef.current = null
          setDragging(false)
        }}
        className={`relative mx-auto w-full max-w-[300px] touch-pan-y select-none overflow-hidden ${
          zoom > MIN_ZOOM ? 'touch-none' : ''
        } ${cursorClass}`}
      >
        <ShirtSchematic
          colorId={colorId}
          view={view}
          designPosition={designPosition}
          logoPosition={logoPosition}
          showLegend={false}
          frameStyle={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 160ms ease-out',
          }}
          onSvgClick={handleSvgClick}
          overlay={
            marker ? (
              // El contenedor es de tamaño 0 y gira sobre el punto pulsado: el
              // punto marca la posición y la aguja hace visible el ángulo.
              <span
                aria-hidden="true"
                className="absolute block h-0 w-0"
                style={{
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  transform: `rotate(${markerRotation}deg)`,
                  transition: 'transform 120ms ease-out',
                }}
              >
                <span className="absolute -left-1.5 -top-1.5 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-paper" />
                <span className="absolute -top-5 left-0 block h-3.5 w-px -translate-x-1/2 bg-red-500" />
                <span className="absolute -top-[22px] left-0 block h-0 w-0 -translate-x-1/2 border-x-[3px] border-b-[5px] border-x-transparent border-b-red-500" />
              </span>
            ) : null
          }
        />
      </div>

      <p className="mt-3 text-[10px] uppercase leading-4 tracking-[0.14em] text-ink-soft">
        {disabled
          ? 'La colocación se bloquea mientras el simulador está ocupado o bloqueado.'
          : 'Haz clic sobre la camiseta para colocar el estampado · Ctrl + rueda para zoom · arrastra para mover'}
      </p>

      {marker ? (
        <p className="mt-1.5 text-[10px] uppercase leading-4 tracking-[0.14em] text-line-strong">
          Punto {Math.round(marker.x)}% / {Math.round(marker.y)}% ·{' '}
          {getDesignPosition(marker.position).label}
          {markerRotation > 0 ? ` · ${markerRotation}º` : ''}
        </p>
      ) : null}
    </div>
  )
}
