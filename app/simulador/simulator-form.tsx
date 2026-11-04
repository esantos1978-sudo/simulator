'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  ACCEPTED_UPLOAD_TYPES,
  DEFAULT_DESIGN_POSITION,
  DEFAULT_LOGO_POSITION,
  DEFAULT_SHIRT_COLOR,
  DEFAULT_VIEW,
  LOGO_POSITIONS,
  MAX_UPLOAD_BYTES,
  SHIRT_COLORS,
  VIEWS,
  getDesignPosition,
  getDesignPositions,
  getPlacementWarning,
  getShirtColor,
  getView,
  isDesignPositionForView,
  isDesignlessPosition,
  resolveDesignPositionForView,
  type DesignPositionId,
  type LogoPositionId,
  type Option,
  type ShirtColorId,
  type ShirtViewId,
} from '@/lib/mockup/options'
import { isMockupSuccess, type MockupResponse } from '@/lib/mockup/types'
import { ShirtSchematic } from './shirt-schematic'

export type SimulatorAccess = 'open' | 'password' | 'locked'

type Status = 'idle' | 'loading'

type GeneratedMockup = {
  dataUrl: string
  mimeType: string
  fileName: string
  prompt: string
  model: string
  /** Parámetros con los que se generó: cada imagen se etiqueta con ellos. */
  color: ShirtColorId
  view: ShirtViewId
  designPosition: DesignPositionId
}

/** La otra cara de la prenda (frontal ⇄ trasera). */
function oppositeViewOf(view: ShirtViewId): ShirtViewId {
  return view === 'frontal' ? 'trasera' : 'frontal'
}

function mockupCaption(mockup: GeneratedMockup): string {
  return `${getView(mockup.view).label} · ${getDesignPosition(mockup.designPosition).label}`
}

function mockupAlt(mockup: GeneratedMockup): string {
  // Con «Sin diseño» la posición no describe ningún estampado.
  const artwork = isDesignlessPosition(mockup.designPosition)
    ? 'sin estampado'
    : `con el diseño ${getDesignPosition(mockup.designPosition).label.toLowerCase()}`

  return [
    `Mockup de camiseta ${getShirtColor(mockup.color).label.toLowerCase()}`,
    getView(mockup.view).label.toLowerCase(),
    artwork,
  ].join(', ')
}

const ACCEPT_ATTRIBUTE = ACCEPTED_UPLOAD_TYPES.join(',')
const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`
  return `${(kilobytes / 1024).toFixed(1).replace('.', ',')} MB`
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return 'png'
}

function buildFileName(
  color: ShirtColorId,
  view: ShirtViewId,
  designPosition: DesignPositionId,
  mimeType: string,
): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `patio-mockup-${color}-${view}-${designPosition}-${stamp}.${extensionForMime(mimeType)}`
}

/** Crea (y libera) una URL de objeto para previsualizar el archivo elegido. */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return url
}

function FormSection({
  index,
  title,
  description,
  children,
}: {
  index: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-b border-line px-5 py-6 last:border-b-0 sm:px-6">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] text-line-strong">{index}</span>
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
      </div>
      {description ? (
        <p className="mt-1 pl-7 text-xs leading-5 text-ink-soft">{description}</p>
      ) : null}
      <div className="mt-5 space-y-5 sm:pl-7">{children}</div>
    </section>
  )
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: T
  options: readonly Option<T>[]
  disabled?: boolean
  onChange: (value: T) => void
}) {
  const active = options.find((option) => option.id === value)

  return (
    <div>
      <label htmlFor={id} className="patio-label">
        {label}
      </label>
      <div className="relative mt-2">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange(event.target.value as T)
          }
          className="patio-field appearance-none pr-10"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 12 8"
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 h-2 w-3 -translate-y-1/2 fill-none stroke-ink"
          strokeWidth={1.5}
        >
          <path d="M1 1.5 6 6.5l5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {active ? (
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-line-strong">
          {active.description}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Selector de opciones excluyentes en botones contiguos (estilo monocromo
 * PATIO). Se usa para la vista de la prenda.
 */
function SegmentedField<T extends string>({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: T
  options: readonly Option<T>[]
  disabled?: boolean
  onChange: (value: T) => void
}) {
  const active = options.find((option) => option.id === value)

  return (
    <div>
      <span id={`${id}-label`} className="patio-label block">
        {label}
      </span>
      <div
        id={id}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="mt-2 flex w-full border border-line bg-surface"
      >
        {options.map((option, index) => {
          const selected = option.id === value
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={`flex-1 px-3 py-2.5 text-[10px] uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed ${
                index > 0 ? 'border-l border-line' : ''
              } ${
                selected
                  ? 'bg-ink text-paper'
                  : 'text-ink-soft hover:bg-paper hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {active ? (
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-line-strong">
          {active.description}
        </p>
      ) : null}
    </div>
  )
}

function FileField({
  id,
  label,
  hint,
  file,
  previewUrl,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint: string
  file: File | null
  previewUrl: string | null
  disabled?: boolean
  onChange: (file: File | null) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="patio-label">
          {label}
        </label>
        {file ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="text-[10px] uppercase tracking-[0.16em] text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline disabled:opacity-50"
          >
            Quitar
          </button>
        ) : null}
      </div>

      <label
        htmlFor={id}
        className={`mt-2 flex cursor-pointer items-center gap-4 border border-dashed border-line bg-paper/60 p-3 transition-colors hover:border-ink ${
          disabled ? 'pointer-events-none opacity-55' : ''
        }`}
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden border border-line bg-surface">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4 fill-none stroke-line-strong"
              strokeWidth={1.5}
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">
            {file ? file.name : 'Seleccionar archivo'}
          </span>
          <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-ink-soft">
            {file ? formatBytes(file.size) : hint}
          </span>
        </span>
      </label>

      <input
        id={id}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        disabled={disabled}
        className="sr-only"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const nextFile = event.target.files?.[0] ?? null
          // Permite volver a elegir el mismo archivo y dispara `onChange`.
          event.target.value = ''
          onChange(nextFile)
        }}
      />
    </div>
  )
}

/**
 * Una imagen generada con su etiqueta de vista/posición.
 * `onDownload` opcional: en el par de vistas cada imagen lleva su propia
 * descarga; en la imagen única la descarga vive en la fila de acciones.
 */
function MockupFigure({
  mockup,
  alt,
  caption,
  onDownload,
}: {
  mockup: GeneratedMockup
  alt: string
  caption?: string
  onDownload?: () => void
}) {
  return (
    <figure className="flex min-w-0 flex-col border border-line bg-paper">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mockup.dataUrl} alt={alt} className="block h-auto w-full" />
      {caption || onDownload ? (
        <figcaption className="flex items-center justify-between gap-3 border-t border-line px-3 py-2">
          <span className="text-[10px] uppercase leading-4 tracking-[0.16em] text-ink-soft">
            {caption}
          </span>
          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="shrink-0 border border-line px-2.5 py-1.5 text-[9px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              Descargar
            </button>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  )
}

export function SimulatorForm({ access }: { access: SimulatorAccess }) {
  const [color, setColor] = useState<ShirtColorId>(DEFAULT_SHIRT_COLOR)
  const [view, setView] = useState<ShirtViewId>(DEFAULT_VIEW)
  const [designPosition, setDesignPosition] =
    useState<DesignPositionId>(DEFAULT_DESIGN_POSITION)
  const [logoPosition, setLogoPosition] =
    useState<LogoPositionId>(DEFAULT_LOGO_POSITION)
  const [designFile, setDesignFile] = useState<File | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<GeneratedMockup | null>(null)
  const [secondResult, setSecondResult] = useState<GeneratedMockup | null>(null)
  // Paso 2 opcional: tras generar una cara se ofrece la contraria.
  const [showSecondViewPrompt, setShowSecondViewPrompt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  const designPreview = useObjectUrl(designFile)
  const logoPreview = useObjectUrl(logoFile)

  const busy = status === 'loading'
  const locked = access === 'locked'
  const disabled = busy || locked
  // «Sin diseño»: la cara se genera lisa, sin PNG de estampado.
  const designless = isDesignlessPosition(designPosition)

  const selectedColor = useMemo(
    () => SHIRT_COLORS.find((option) => option.id === color) ?? SHIRT_COLORS[0],
    [color],
  )
  const selectedView = useMemo(
    () => VIEWS.find((option) => option.id === view) ?? VIEWS[0],
    [view],
  )
  // Las posiciones disponibles cambian con la vista (la espalda no tiene mangas
  // ni bolsillo en el formulario).
  const designOptions = useMemo(() => getDesignPositions(view), [view])
  const selectedDesign = useMemo(
    () => (designOptions.some((option) => option.id === designPosition)
      ? getDesignPosition(designPosition)
      : null),
    [designOptions, designPosition],
  )
  const selectedLogo = useMemo(
    () => LOGO_POSITIONS.find((option) => option.id === logoPosition),
    [logoPosition],
  )
  const placementWarning = useMemo(
    () => getPlacementWarning(designPosition, logoPosition, view),
    [designPosition, logoPosition, view],
  )

  // Resumen lateral: qué archivos viajan de verdad en la petición.
  const summaryFiles = useMemo(() => {
    const parts: string[] = []
    if (designFile && !designless) parts.push('diseño')
    if (logoFile && logoPosition !== 'sin-logo') parts.push('logo')
    return parts.length > 0 ? parts.join(' + ') : '—'
  }, [designFile, designless, logoFile, logoPosition])

  /** Al cambiar de vista, la posición se ajusta si no existe en esa cara. */
  function handleViewChange(nextView: ShirtViewId) {
    setView(nextView)
    // Si el usuario elige la cara a mano, la oferta del paso 2 deja de aplicar.
    setShowSecondViewPrompt(false)
    if (!isDesignPositionForView(nextView, designPosition)) {
      const [firstPosition] = getDesignPositions(nextView)
      setDesignPosition(firstPosition.id)
    }
  }

  /** Imágenes visibles en el panel de resultado: la primera y, si existe, la segunda. */
  const generatedResults = useMemo(
    () => [result, secondResult].filter((item): item is GeneratedMockup => item !== null),
    [result, secondResult],
  )

  // El formulario ya apunta a la cara que falta y todavía no se ha generado.
  const secondViewReady =
    result !== null && secondResult === null && view !== result.view

  // Cara y posición que propone el paso 2: siempre la contraria a la generada.
  // Si la cara generada iba lisa, la contraria también arranca lisa.
  const secondViewTarget = result ? oppositeViewOf(result.view) : DEFAULT_VIEW
  const secondViewPosition = resolveDesignPositionForView(
    secondViewTarget,
    designless ? 'sin-diseno' : DEFAULT_DESIGN_POSITION,
  )

  // Contador de segundos mientras Gemini genera la imagen (30-60 s habituales).
  useEffect(() => {
    if (!busy) {
      setElapsed(0)
      return
    }

    const timer = window.setInterval(() => {
      setElapsed((seconds) => seconds + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [busy])

  function validateForm(): string | null {
    // Con «Sin diseño» la cara se genera lisa y el PNG no es obligatorio.
    if (!designFile && !designless) {
      return 'Sube el PNG del diseño o elige «Sin diseño» en la posición.'
    }
    if (designFile && designFile.size > MAX_UPLOAD_BYTES) {
      return `El diseño ocupa ${formatBytes(designFile.size)}: el máximo son ${MAX_UPLOAD_MB} MB.`
    }
    if (logoPosition !== 'sin-logo' && !logoFile) {
      return 'Has elegido una posición para el logo: sube el PNG del logo o selecciona «Sin logo».'
    }
    if (logoFile && logoFile.size > MAX_UPLOAD_BYTES) {
      return `El logo ocupa ${formatBytes(logoFile.size)}: el máximo son ${MAX_UPLOAD_MB} MB.`
    }
    if (access === 'password' && password.trim().length === 0) {
      return 'Introduce la contraseña del simulador.'
    }
    return null
  }

  /**
   * Envía una generación al endpoint con los parámetros actuales del formulario.
   * La usan la primera vista y la segunda: en el paso 2 el formulario ya viene
   * pre-llenado, pero el arte puede ser distinto (logo pequeño delante, diseño
   * grande detrás).
   */
  async function requestMockup(
    targetView: ShirtViewId,
    targetDesignPosition: DesignPositionId,
  ): Promise<GeneratedMockup> {
    const body = new FormData()
    body.set('color', color)
    body.set('view', targetView)
    body.set('designPosition', targetDesignPosition)
    body.set('logoPosition', logoPosition)
    // Con «Sin diseño» no se envía el arte aunque siga elegido: la cara se
    // genera lisa (el servidor lo ignora igualmente).
    if (designFile && !isDesignlessPosition(targetDesignPosition)) {
      body.set('design', designFile)
    }
    // Con «Sin logo» no se envía el archivo, aunque siga elegido: así la segunda
    // vista puede quitar el logo que sí lleva la primera.
    if (logoFile && logoPosition !== 'sin-logo') body.set('logo', logoFile)
    if (access === 'password') body.set('password', password)

    const response = await fetch('/api/generate-mockup', {
      method: 'POST',
      body,
    })
    const payload = (await response.json().catch(() => null)) as
      | MockupResponse
      | null

    if (!response.ok || !payload || !isMockupSuccess(payload)) {
      const message =
        payload && 'error' in payload
          ? [payload.error, payload.detail].filter(Boolean).join(' · ')
          : `La generación ha fallado (HTTP ${response.status}).`
      throw new Error(message)
    }

    return {
      dataUrl: payload.image.dataUrl,
      mimeType: payload.image.mimeType,
      fileName: buildFileName(
        color,
        targetView,
        targetDesignPosition,
        payload.image.mimeType,
      ),
      prompt: payload.prompt,
      model: payload.model,
      color,
      view: targetView,
      designPosition: targetDesignPosition,
    }
  }

  function describeError(requestError: unknown): string {
    return requestError instanceof Error
      ? requestError.message
      : 'No hemos podido generar el mockup. Inténtalo de nuevo.'
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (locked || busy) return

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setStatus('loading')

    try {
      const generated = await requestMockup(view, designPosition)

      // Cada cara ocupa su hueco en el resultado: si ya había una imagen de esa
      // vista se reemplaza y, si el hueco estaba libre, la nueva imagen completa
      // el par (la primera generación delante, la segunda detrás).
      let nextFirst = result
      let nextSecond = secondResult

      if (!nextFirst || nextFirst.view === generated.view) {
        nextFirst = generated
      } else {
        nextSecond = generated
      }

      setResult(nextFirst)
      setSecondResult(nextSecond)
      // La oferta del paso 2 solo tiene sentido mientras falte una cara.
      setShowSecondViewPrompt(nextSecond === null)
    } catch (requestError) {
      setError(describeError(requestError))
    } finally {
      setStatus('idle')
    }
  }

  /**
   * Paso 2: prepara el formulario para la cara contraria, sin lanzar ninguna
   * petición. Cambia la vista y devuelve la posición a la de por defecto de esa
   * cara; el color y los archivos se mantienen, y el usuario puede cambiarlos
   * (por ejemplo, un logo pequeño delante y el estampado grande detrás) antes de
   * pulsar «Generar mockup».
   */
  function handlePrepareSecondView() {
    if (!result || busy || locked) return

    setShowSecondViewPrompt(false)
    setView(secondViewTarget)
    setDesignPosition(secondViewPosition)
    setError(null)

    // En móvil el resultado queda muy abajo: devolvemos la vista al formulario.
    const form = formRef.current
    if (form && form.getBoundingClientRect().top < 0) {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function handleDismissSecondView() {
    setShowSecondViewPrompt(false)
  }

  /** «Nuevo mockup» limpia el resultado y devuelve el formulario a su inicio. */
  function handleReset() {
    setResult(null)
    setSecondResult(null)
    setShowSecondViewPrompt(false)
    setError(null)
    setColor(DEFAULT_SHIRT_COLOR)
    setView(DEFAULT_VIEW)
    setDesignPosition(DEFAULT_DESIGN_POSITION)
    setLogoPosition(DEFAULT_LOGO_POSITION)
    setDesignFile(null)
    setLogoFile(null)
  }

  async function handleDownload(mockup: GeneratedMockup) {
    try {
      const blob = await (await fetch(mockup.dataUrl)).blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = mockup.fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch {
      setError(
        'No hemos podido descargar la imagen. Mantén pulsado sobre ella para guardarla.',
      )
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="border border-line bg-surface"
      >
        <FormSection
          index="01"
          title="Camiseta"
          description="El color de la prenda que verá el cliente en la ficha de producto."
        >
          <SelectField
            id="shirt-color"
            label="Color de camiseta"
            value={color}
            options={SHIRT_COLORS}
            disabled={disabled}
            onChange={setColor}
          />

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Atajos de color"
          >
            {SHIRT_COLORS.map((option) => {
              const active = option.id === color
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => setColor(option.id)}
                  className={`flex items-center gap-2 border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed ${
                    active
                      ? 'border-ink bg-ink text-paper'
                      : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 border border-black/20"
                    style={{ backgroundColor: option.swatch }}
                  />
                  {option.label}
                </button>
              )
            })}
          </div>
        </FormSection>

        <FormSection
          index="02"
          title="Vista"
          description="La cara de la prenda que verá el cliente en la ficha de producto."
        >
          <SegmentedField
            id="shirt-view"
            label="Vista de la camiseta"
            value={view}
            options={VIEWS}
            disabled={disabled}
            onChange={handleViewChange}
          />
        </FormSection>

        <FormSection
          index="03"
          title="Estampado"
          description={
            designless
              ? 'Camiseta lisa: esta cara se genera sin estampado principal.'
              : 'Posición sobre la vista elegida · PNG con transparencia y al menos 1000 px de ancho.'
          }
        >
          <SelectField
            id="design-position"
            label="Posición del diseño"
            value={designPosition}
            options={designOptions}
            disabled={disabled}
            onChange={setDesignPosition}
          />
          {designless ? (
            <p className="border border-dashed border-line px-3 py-4 text-[10px] uppercase leading-4 tracking-[0.14em] text-ink-soft">
              {logoPosition === 'sin-logo'
                ? 'Sin diseño y sin logo: la camiseta se genera completamente lisa.'
                : 'Sin diseño: la camiseta se genera lisa y el logo pasa a ser su única decoración.'}
              {designFile
                ? ' El archivo elegido se conserva por si vuelves a estampar.'
                : ''}
            </p>
          ) : (
            <FileField
              id="design-file"
              label="PNG del diseño"
              hint={`PNG, JPG o WEBP · máx. ${MAX_UPLOAD_MB} MB`}
              file={designFile}
              previewUrl={designPreview}
              disabled={disabled}
              onChange={setDesignFile}
            />
          )}
        </FormSection>

        <FormSection
          index="04"
          title="Logo de marca"
          description={
            designless
              ? 'Sin estampado, el logo se convierte en la única decoración.'
              : 'Se imprime como detalle secundario, sin tapar el estampado.'
          }
        >
          <SelectField
            id="logo-position"
            label="Posición del logo"
            value={logoPosition}
            options={LOGO_POSITIONS}
            disabled={disabled}
            onChange={setLogoPosition}
          />
          {logoPosition === 'sin-logo' ? (
            <p className="border border-dashed border-line px-3 py-4 text-[10px] uppercase leading-4 tracking-[0.14em] text-ink-soft">
              Sin logo: la camiseta solo llevará el estampado.
            </p>
          ) : (
            <FileField
              id="logo-file"
              label="PNG del logo (opcional)"
              hint={`PNG con transparencia · máx. ${MAX_UPLOAD_MB} MB`}
              file={logoFile}
              previewUrl={logoPreview}
              disabled={disabled}
              onChange={setLogoFile}
            />
          )}
        </FormSection>

        {access === 'password' ? (
          <FormSection
            index="05"
            title="Acceso"
            description="La contraseña se valida en el servidor en cada petición."
          >
            <div>
              <label htmlFor="mockup-password" className="patio-label">
                Contraseña
              </label>
              <input
                id="mockup-password"
                type="password"
                value={password}
                autoComplete="off"
                disabled={disabled}
                placeholder="••••••••"
                onChange={(event) => setPassword(event.target.value)}
                className="patio-field mt-2"
              />
            </div>
          </FormSection>
        ) : null}

        <div className="space-y-4 px-5 py-6 sm:px-6">
          {locked ? (
            <p
              role="status"
              className="border border-ink bg-paper px-4 py-3 text-xs leading-5"
            >
              Este entorno no tiene{' '}
              <code className="font-mono">MOCKUP_PASSWORD</code> definida, así que
              el simulador está bloqueado. En local (
              <code className="font-mono">npm run dev</code>) funciona sin
              contraseña.
            </p>
          ) : null}

          {placementWarning ? (
            <p className="border-l-2 border-line-strong bg-paper/70 px-3 py-2 text-[11px] leading-5 text-ink-soft">
              {placementWarning}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="border border-ink bg-paper px-4 py-3 text-xs leading-5"
            >
              <span aria-hidden="true" className="mr-2 font-mono">
                !
              </span>
              {error}
            </p>
          ) : null}

          {secondViewReady ? (
            <p className="border border-line bg-paper px-3 py-2.5 text-[10px] uppercase leading-4 tracking-[0.14em] text-ink-soft">
              Paso 2 · se sumará a la vista{' '}
              {getView(result.view).label.toLowerCase()} ya generada · ajusta
              diseño y logo antes de generar
            </p>
          ) : null}

          <button
            type="submit"
            disabled={disabled}
            className="inline-flex w-full items-center justify-center gap-3 border border-ink bg-ink px-6 py-3.5 text-[11px] uppercase tracking-[0.2em] text-paper transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:bg-line/50 disabled:text-ink-soft disabled:hover:bg-line/50 disabled:hover:text-ink-soft"
          >
            {busy ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                />
                Generando… {elapsed}s
              </>
            ) : (
              <>
                Generar mockup
                <svg
                  viewBox="0 0 16 12"
                  aria-hidden="true"
                  className="h-2.5 w-3.5 fill-none stroke-current"
                  strokeWidth={1.5}
                >
                  <path
                    d="M0 6h14M9 1l5 5-5 5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            )}
          </button>

          <p className="text-[10px] uppercase leading-4 tracking-[0.14em] text-line-strong">
            Tarda entre 20 y 60 segundos · Las imágenes no se almacenan en el
            servidor
          </p>
        </div>
      </form>

      <div className="grid gap-6 lg:sticky lg:top-8">
        <section className="border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[11px] uppercase tracking-[0.18em]">
              Previsualización
            </h2>
            <span className="font-mono text-[11px] text-ink-soft">esquema</span>
          </header>

          <div className="px-5 py-6">
            <ShirtSchematic
              colorId={color}
              view={view}
              designPosition={designPosition}
              logoPosition={logoPosition}
            />

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-[10px] uppercase tracking-[0.14em]">
              <div>
                <dt className="text-ink-soft">Camiseta</dt>
                <dd className="mt-1">{selectedColor.label}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Vista</dt>
                <dd className="mt-1">{selectedView.label}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Diseño</dt>
                <dd className="mt-1">{selectedDesign?.label ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Logo</dt>
                <dd className="mt-1">{selectedLogo?.label ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Archivos</dt>
                <dd className="mt-1">{summaryFiles}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[11px] uppercase tracking-[0.18em]">Resultado</h2>
            <span className="font-mono text-[11px] text-ink-soft">
              {busy
                ? `generando ${elapsed}s`
                : secondResult
                  ? '2 vistas'
                  : result
                    ? 'listo'
                    : 'en espera'}
            </span>
          </header>

          <div className="px-5 py-6">
            {busy && !result ? (
              <div className="space-y-3">
                <div className="aspect-square w-full animate-pulse border border-line bg-paper" />
                <p className="text-[10px] uppercase leading-4 tracking-[0.14em] text-ink-soft">
                  Gemini está componiendo la fotografía de producto · no cierres
                  la pestaña
                </p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div
                  className={
                    secondResult || busy ? 'grid gap-3 sm:grid-cols-2' : ''
                  }
                >
                  {generatedResults.map((mockup) => (
                    <MockupFigure
                      key={mockup.view}
                      mockup={mockup}
                      alt={mockupAlt(mockup)}
                      caption={mockupCaption(mockup)}
                      onDownload={
                        secondResult
                          ? () => handleDownload(mockup)
                          : undefined
                      }
                    />
                  ))}

                  {busy && !secondResult ? (
                    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 border border-dashed border-line bg-paper/60 px-4 py-10 text-center">
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 animate-spin rounded-full border border-line-strong border-t-transparent"
                      />
                      <p className="text-[10px] uppercase leading-4 tracking-[0.14em] text-ink-soft">
                        Generando {getView(view).label.toLowerCase()}
                        {` · ${elapsed}s`}
                      </p>
                    </div>
                  ) : null}
                </div>

                {showSecondViewPrompt && !secondResult ? (
                  <section
                    aria-label="Paso 2: preparar la vista contraria"
                    className="patio-fade-in border border-line bg-surface p-4"
                  >
                    <p className="flex items-center gap-2 text-[11px] uppercase leading-4 tracking-[0.18em]">
                      <span aria-hidden="true">✅</span>
                      Vista {getView(result.view).label.toLowerCase()} generada
                      con éxito
                    </p>
                    <p className="mt-2 text-xs leading-5 text-ink-soft">
                      ¿Preparamos la vista {getView(secondViewTarget).label.toLowerCase()}?
                      Cambiamos la vista y la posición en el formulario y tú
                      decides el arte de esa cara —por ejemplo, un logo pequeño
                      delante y el estampado grande detrás— antes de generar.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={handlePrepareSecondView}
                        className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-paper transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:bg-surface disabled:text-ink-soft"
                      >
                        Sí, preparar {getView(secondViewTarget).label}
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={handleDismissSecondView}
                        className="inline-flex items-center justify-center gap-2 border border-line px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        No, gracias
                      </button>
                    </div>
                    <p className="mt-3 text-[10px] uppercase leading-4 tracking-[0.14em] text-line-strong">
                      Solo cambia vista y posición a «
                      {getDesignPosition(secondViewPosition).label}»; color y
                      archivos se mantienen
                    </p>
                  </section>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  {secondResult ? null : (
                    <button
                      type="button"
                      onClick={() => handleDownload(result)}
                      className="inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-paper transition-colors hover:bg-surface hover:text-ink"
                    >
                      Descargar imagen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 border border-line px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
                  >
                    Nuevo mockup
                  </button>
                  <span className="ml-auto font-mono text-[10px] text-line-strong">
                    {secondResult
                      ? `2 vistas · ${result.mimeType}`
                      : result.mimeType}
                  </span>
                </div>

                {generatedResults.map((mockup) => (
                  <details key={mockup.view} className="border-t border-line pt-3">
                    <summary className="cursor-pointer text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                      Prompt enviado · {mockupCaption(mockup)} · {mockup.model}
                    </summary>
                    <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words bg-paper p-3 font-mono text-[11px] leading-5 text-ink-soft">
                      {mockup.prompt}
                    </pre>
                  </details>
                ))}
              </div>
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 border border-dashed border-line bg-paper/60 px-6 text-center">
                <svg
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                  className="h-8 w-8 fill-none stroke-line-strong"
                  strokeWidth={1.25}
                >
                  <path d="M24 4v40M4 24h40" strokeLinecap="round" />
                  <rect x="12" y="12" width="24" height="24" rx="1" />
                </svg>
                <p className="text-[10px] uppercase leading-4 tracking-[0.14em] text-ink-soft">
                  El mockup generado aparecerá aquí
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

