/**
 * Plantillas de prompt para los mockups de camiseta de PATIO.
 *
 * Están destiladas de la conversación de referencia con Gemini
 * (`Camisetas/Mockup de Camiseta para Tienda - Google Gemini.pdf`), donde se
 * pedía una camiseta realista, el logo en pequeño, el logo centrado, líneas
 * negras al final de las mangas y del bajo, el cuello en negro y, sobre todo,
 * que el estampado pareciera «hecho de verdad, con más realismo».
 *
 * Reglas que se mantienen en todas las plantillas:
 *  - fotografía de producto realista, sin modelos ni maniquíes visibles;
 *  - el arte adjunto se reproduce EXACTO (sin redibujar ni recolorear);
 *  - el estampado se integra en la tela (pliegues, textura, relieve);
 *  - la vista (frontal/trasera) y la posición dependen de lo elegido en el
 *    formulario.
 *
 * El prompt arranca con la línea de vista en español porque es la instrucción
 * que el modelo debe leer primero; el resto de la plantilla sigue en inglés,
 * idioma en el que los modelos de imagen siguen mejor las indicaciones
 * técnicas. Se muestra tal cual en la interfaz.
 */

import {
  getDesignPosition,
  getLogoPosition,
  getShirtColor,
  isDesignlessPosition,
  type DesignPositionId,
  type LogoPositionId,
  type ShirtColorId,
  type ShirtColorOption,
  type ShirtViewId,
} from './options'

export type MockupPromptInput = {
  color: ShirtColorId
  /** Vista de la prenda: `frontal` o `trasera`. */
  view: ShirtViewId
  /** Posición del estampado; `sin-diseno` genera la cara lisa. */
  designPosition: DesignPositionId
  logoPosition: LogoPositionId
  hasLogo: boolean
}

/**
 * Descripción de la tela que se envía al modelo. Se construye con el
 * `promptKeyword` del color —su nombre en inglés, en mayúsculas: SAGE GREEN,
 * DUSTY ROSE, POWDER BLUE…— y con el `swatch` de `SHIRT_COLORS`, así que la
 * paleta del prompt y la del formulario salen siempre del mismo sitio.
 */
function fabricDescription(shirt: ShirtColorOption): string {
  return `plain ${shirt.promptKeyword} (approx. ${shirt.swatch.toUpperCase()}) heavyweight cotton jersey t-shirt`
}

/** Primera línea del prompt: la vista elegida, literal. */
const VIEW_OPENERS: Record<ShirtViewId, string> = {
  frontal: 'VISTA FRONTAL de la camiseta.',
  trasera:
    'VISTA TRASERA de la camiseta (mostrando la espalda, con el cuello cerrado sin escote delantero visible).',
}

/** Refuerzo en inglés de la vista: qué panel se ve y qué no debe aparecer. */
const VIEW_DIRECTIVES: Record<ShirtViewId, string> = {
  frontal:
    'The camera faces the front panel: the front crew neckline dip, the chest area and the front hem are visible.',
  trasera:
    'The camera faces the back panel: the round neckline looks closed from behind, with no front scoop, no front placket and no chest seam visible, and the back yoke, shoulder blades and back hem are clearly shown.',
}

/** Línea de colocación del estampado, literal, según lo elegido. */
const DESIGN_PLACEMENTS: Record<DesignPositionId, string> = {
  'centrado-grande':
    'En el pecho/espalda: el diseño impreso como estampado GRANDE centrado.',
  'centrado-pequeno':
    'En el pecho/espalda: el diseño impreso como estampado PEQUEÑO centrado.',
  bolsillo:
    'En el pecho izquierdo: el diseño impreso en tamaño pequeño, simulando un estampado tipo bolsillo.',
  'izquierda-bolsillo':
    'A la izquierda del pecho: el diseño impreso en tamaño pequeño, justo al lado de donde estaría un bolsillo.',
  'abajo-izquierda':
    'En la zona inferior izquierda del frontal, cerca del bajo: el diseño impreso en tamaño pequeño.',
  'abajo-derecha':
    'En la zona inferior derecha del frontal, cerca del bajo: el diseño impreso en tamaño pequeño.',
  'manga-izquierda':
    'En la manga izquierda: el diseño impreso en tamaño pequeño/medio.',
  'manga-derecha':
    'En la manga derecha: el diseño impreso en tamaño pequeño/medio.',
  'arriba-nuca':
    'En la parte superior de la espalda, justo debajo del cuello (tipo nuca): el diseño impreso en tamaño pequeño.',
  'abajo-bajo':
    'En la parte inferior de la espalda, cerca del bajo: el diseño impreso en tamaño grande.',
  'sin-diseno':
    'Camiseta totalmente lisa, sin ningún estampado principal en el pecho/espalda. Solo se permite el logo pequeño si se ha especificado.',
}

/**
 * Medidas y referencias concretas (en inglés) para que la colocación no dependa
 * de la interpretación del modelo. «Wearer's left/right» es el lado de la
 * persona que lleva la prenda, no el del espectador.
 */
const DESIGN_SPECIFICS: Record<DesignPositionId, string> = {
  'centrado-grande':
    'Centre the artwork horizontally on the visible panel with its top edge about 7 cm below the collar rib and its bottom edge well above the hem, covering roughly 65-70% of the panel width.',
  'centrado-pequeno':
    'Centre the artwork horizontally on the visible panel with its top edge about 8 cm below the collar rib, about 18-22 cm wide (roughly 30% of the panel width), leaving generous empty fabric around it.',
  bolsillo:
    "About 9 cm wide, centred on the wearer's left chest (viewer's right in a front view) exactly where a chest pocket would sit, about 10 cm below the collar seam.",
  'izquierda-bolsillo':
    "Small, about 5-6 cm wide, on the wearer's left chest right beside the pocket area, about 11 cm below the collar seam, with a clear gap before where a pocket would be.",
  'abajo-izquierda':
    'Small, about 9 cm wide, in the lower-left area of the front panel as seen in the photograph, about 7-9 cm above the bottom hem and roughly 10 cm from the side seam.',
  'abajo-derecha':
    'Small, about 9 cm wide, in the lower-right area of the front panel as seen in the photograph, about 7-9 cm above the bottom hem and roughly 10 cm from the side seam.',
  'manga-izquierda':
    "Printed flat on the front-facing surface of the wearer's left sleeve, about 8 cm wide, centred halfway between the shoulder seam and the sleeve hem and following the curve of the arm. The entire artwork must stay fully visible inside the sleeve outline, surrounded by unprinted fabric on all four sides; it must never be cropped, cut off or wrapped over the sleeve edge, the shoulder seam or the sleeve hem. If the sleeve is too narrow, scale the artwork down instead of cropping it.",
  'manga-derecha':
    "Printed flat on the front-facing surface of the wearer's right sleeve, about 8 cm wide, centred halfway between the shoulder seam and the sleeve hem and following the curve of the arm. The entire artwork must stay fully visible inside the sleeve outline, surrounded by unprinted fabric on all four sides; it must never be cropped, cut off or wrapped over the sleeve edge, the shoulder seam or the sleeve hem. If the sleeve is too narrow, scale the artwork down instead of cropping it.",
  'arriba-nuca':
    'Small, about 8-10 cm wide, centred horizontally just below the back collar seam (nape area), following the curve of the back yoke.',
  'abajo-bajo':
    'Large, covering roughly 55-65% of the back width, horizontally centred with its bottom edge about 6-8 cm above the back hem.',
  'sin-diseno':
    'The visible panel stays completely blank: no print, no embroidery, no patch, no appliqué and no added graphic of any kind — just the plain, evenly lit fabric.',
}

/**
 * Zona del logo por vista. `null` significa que ese logo cae en la cara oculta
 * de la prenda y no debe imprimirse en la vista solicitada.
 */
const LOGO_PLACEMENTS: Record<
  Exclude<LogoPositionId, 'sin-logo'>,
  Record<ShirtViewId, string | null>
> = {
  'manga-izquierda': {
    frontal:
      "on the outer side of the wearer's left sleeve (viewer's right), centred halfway between the shoulder seam and the sleeve hem",
    trasera:
      "on the outer side of the wearer's left sleeve, which falls on the viewer's left in this rear view, centred halfway between the shoulder seam and the sleeve hem",
  },
  'pecho-izquierdo': {
    frontal:
      "on the wearer's left chest (viewer's right), about 8 cm below the collar seam, roughly 7 cm wide, aligned like a polo chest logo",
    trasera: null,
  },
  'bajo-derecho': {
    frontal:
      "near the bottom hem on the wearer's right side (viewer's left), about 6 cm above the hem, roughly 6 cm wide",
    trasera:
      "near the bottom hem on the wearer's right side, which falls on the viewer's left in this rear view, about 6 cm above the hem, roughly 6 cm wide",
  },
}

/**
 * Construye el prompt completo del mockup a partir de las opciones del
 * formulario. Las imágenes se adjuntan por separado, en este orden:
 *   1) arte del diseño (opcional: con «Sin diseño» no se adjunta)
 *   2) logo de marca (opcional)
 * Con «Sin diseño» el bloque de estampado se sustituye por la instrucción de
 * camiseta lisa, así que el logo pasa a ser la única decoración de esa cara.
 */
export function buildMockupPrompt({
  color,
  view,
  designPosition,
  logoPosition,
  hasLogo,
}: MockupPromptInput): string {
  const shirt = getShirtColor(color)
  const design = getDesignPosition(designPosition)
  const logoOption = logoPosition === 'sin-logo' ? null : getLogoPosition(logoPosition)
  const logoPlacement =
    logoPosition === 'sin-logo' ? null : LOGO_PLACEMENTS[logoPosition][view]
  const sideLabel = view === 'trasera' ? 'back' : 'front'
  const noDesign = isDesignlessPosition(designPosition)
  // Sin arte de diseño el logo es la primera imagen adjunta, no la segunda.
  const logoImageRef = noDesign ? 'attached logo image' : 'second attached image'

  const blocks: string[] = []

  // 1. Vista: siempre la primera línea del prompt.
  blocks.push(VIEW_OPENERS[view])

  // 2. Fotografía de producto.
  blocks.push(
    [
      `Create a single photorealistic e-commerce product photograph of one ${fabricDescription(shirt)}, colour reference "${shirt.label}".`,
      `The t-shirt is presented on an invisible ghost mannequin in a perfectly straight, symmetrical ${sideLabel} view, filling about 80% of the frame. ${VIEW_DIRECTIVES[view]}`,
      'Lighting: soft, even studio light from the front, gentle falloff, no harsh highlights, subtle contact shadow. Background: seamless light-grey studio backdrop, empty.',
      'The garment must look real and premium: visible cotton knit texture, natural gentle folds, three-dimensional volume, ribbed collar, clean shoulder seams and double-stitched sleeve hems and bottom hem.',
    ].join(' '),
  )

  // 3. Estampado: línea de posición literal + medidas de referencia. Con «Sin
  //    diseño» no hay arte que reproducir, así que se describe la cara lisa.
  if (noDesign) {
    blocks.push(
      [
        `ARTWORK: none. ${DESIGN_PLACEMENTS[designPosition]}`,
        DESIGN_SPECIFICS[designPosition],
        'Do not invent any print, graphic or lettering to fill the empty fabric, and let the cotton texture and the shirt colour be the only visual interest of the panel.',
      ].join(' '),
    )
  } else {
    blocks.push(
      [
        `ARTWORK (${design.label}) — first attached image. ${DESIGN_PLACEMENTS[designPosition]}`,
        DESIGN_SPECIFICS[designPosition],
        'Print the artwork exactly as supplied: identical shapes, colours, line weights and typography. Do not redraw, recolour, crop, rotate or stylise it, and do not add extra text, letters, logos, watermarks or graphics of your own.',
      ].join(' '),
    )

    blocks.push(
      'PRINT INTEGRATION: make the print look physically real, like a genuine screen print on the fabric, never a flat sticker or a pasted overlay. It must follow the curvature of the body and the folds of the cloth, sit slightly inside the textile weave, keep crisp edges and reproduce the ink colours faithfully in the studio light.',
    )
  }

  // 4. Branding: solo si esa cara de la prenda lo muestra. Sin estampado
  //    principal, el logo es la única decoración y el texto no debe mencionar
  //    ninguna obra gráfica que no existe.
  const onlyDecoration = noDesign
    ? 'The logo is the only decoration on the garment: there is no main print, so nothing else may be added around it.'
    : 'The logo and the main artwork must never overlap. If the placements are close, scale the main artwork down slightly instead of moving either element.'
  const nothingElse = noDesign
    ? 'the visible panel must stay completely plain'
    : 'only the supplied artwork appears on the garment'

  if (!logoOption) {
    blocks.push(
      noDesign
        ? 'BRANDING: do not add any logo, brand mark, label or extra graphic anywhere on the t-shirt. The garment is completely plain.'
        : 'BRANDING: do not add any logo, brand mark, label or extra graphic anywhere on the t-shirt. Only the supplied artwork appears on the garment.',
    )
  } else if (!logoPlacement) {
    blocks.push(
      `BRANDING: the requested logo (${logoOption.label}) belongs to the front panel and is not visible in this ${sideLabel} view. Do not print it on the back and do not invent any other logo or lettering; ${nothingElse}.`,
    )
  } else if (hasLogo) {
    blocks.push(
      [
        `BRAND LOGO (${logoOption.label}) — ${logoImageRef}. Reproduce this logo exactly and unaltered, at a small scale, ${logoPlacement}.`,
        'The logo is a secondary detail: it must stay legible, keep its original proportions and colours, and never be redrawn or replaced by invented lettering.',
        onlyDecoration,
      ].join(' '),
    )
  } else {
    blocks.push(
      `BRANDING: do not invent any logo, brand mark or lettering that was not supplied; ${nothingElse}.`,
    )
  }

  // 5. Cierre: color, acabado y composición.
  blocks.push(
    [
      `Keep the shirt colour exactly as requested (${shirt.promptKeyword}, "${shirt.label}") with a neutral white balance and no colour cast.`,
      'Sharp focus, high resolution, square 1:1 composition suitable for an online store gallery, shot at eye level with a fixed focal length and no perspective distortion.',
      'No people, no mannequin parts, no hangers, no props, no text overlays and no watermarks.',
    ].join(' '),
  )

  return blocks.join('\n\n')
}
