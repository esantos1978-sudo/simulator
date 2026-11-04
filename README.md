# PATIO · Simulador de mockups

Herramienta interna que genera fotografías de producto de camisetas con el arte
del cliente ya estampado, usando la API de generación de imágenes de Gemini.

- **Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS 4 · TypeScript.
- **Ruta privada:** `/simulador`.
- **API:** `POST /api/generate-mockup` (Route Handler, runtime `nodejs`).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # en Windows: Copy-Item .env.example .env.local
npm run dev                  # http://localhost:3000/simulador
```

En `next dev` el simulador está **abierto**: no pide contraseña.

## Variables de entorno

| Variable            | Obligatoria | Descripción                                                        |
| ------------------- | ----------- | ------------------------------------------------------------------ |
| `GEMINI_API_KEY`    | sí          | Clave de Google AI Studio. También se acepta `GOOGLE_API_KEY`.      |
| `MOCKUP_PASSWORD`   | en prod     | Contraseña del formulario. Sin ella, en producción el endpoint 401. |
| `GEMINI_IMAGE_MODEL`| no          | Fuerza un modelo concreto. Si se deja vacío se prueban por orden `gemini-nano-banana-2.1`, `gemini-3.1-flash-image` y `gemini-2.5-flash-image`. |

## Cómo funciona

1. El formulario (`app/simulador/simulator-form.tsx`) recoge color de la prenda,
   vista (frontal o trasera), posición del estampado —que cambia según la vista:
   9 opciones en el frontal y 5 en la espalda, contando «Sin diseño» en ambas—,
   posición del logo y los PNG (diseño obligatorio salvo con «Sin diseño», logo
   opcional; con «Sin logo» no se pide). «Sin diseño» genera la cara lisa, solo
   con el logo si se ha elegido: sirve para ver la tela/color o para una prenda
   minimalista con el logo como única decoración. Muestra un esquema vectorial de
   la camiseta mientras se elige, dibujando la cara seleccionada y sin marcar
   zona de estampado cuando no lo hay.
2. Envía todo como `FormData` a `/api/generate-mockup`.
3. La ruta valida contraseña, tamaños (máx. 8 MB), tipos de archivo y que la
   posición pertenezca a la vista pedida (si no, usa la primera de esa cara),
   convierte las imágenes a base64 y construye el prompt con `buildMockupPrompt`.
   Con «Sin logo» descarta el archivo del logo aunque el cliente lo envíe, para
   que una cara pueda llevarlo y la otra no; con «Sin diseño» hace lo mismo con
   el PNG del estampado, que además deja de ser obligatorio (la petición puede
   ir solo con el prompt).
4. `generateMockupImage` (`lib/mockup/gemini.ts`) llama a
   `models/{model}:generateContent` con `responseModalities: ['TEXT','IMAGE']`
   y devuelve la imagen en base64 (timeout de 90 s). Si el modelo no existe o la
   clave no tiene acceso (`404` / «not found»), pasa al siguiente de la cadena;
   cualquier otro error se devuelve tal cual.
5. El navegador muestra el resultado, permite descargarlo y deja ver el prompt
   exacto enviado a Gemini.
6. Tras una generación correcta aparece un paso 2 opcional dentro del panel de
   resultado: «¿Preparamos la vista contraria?». Al aceptar **no se lanza ninguna
   petición**: el formulario cambia a la cara opuesta, devuelve la posición del
   estampado a la de por defecto de esa cara (`centrado-grande`, o mantiene «Sin
   diseño» si la cara ya generada iba lisa) y conserva color y archivos, que
   pueden sustituirse antes de generar (habitual en streetwear: logo pequeño
   delante, estampado grande detrás). El usuario pulsa «Generar
   mockup» cuando el arte está listo y las dos vistas quedan lado a lado
   —apiladas en móvil— con su propia etiqueta (`Frontal · Abajo derecha`) y su
   propia descarga. «No, gracias» cierra la oferta sin tocar el mockup ya
   generado y «Nuevo mockup» limpia el resultado y devuelve el formulario a su
   estado inicial.

Las imágenes nunca se guardan en el servidor: se envían a Gemini y vuelven al
navegador en la misma petición.

## Estructura

```
app/
  api/generate-mockup/route.ts   validación + llamada a Gemini
  simulador/page.tsx             control de acceso y cabecera
  simulador/simulator-form.tsx   formulario, previsualización y resultado
  simulador/shirt-schematic.tsx  esquema SVG de la camiseta
lib/mockup/
  options.ts                     colores, vistas, posiciones y avisos de conflicto
  prompt.ts                      plantillas del prompt (vista en español, cuerpo en inglés)
  gemini.ts                      cliente REST de Gemini
  types.ts                       contratos compartidos cliente/servidor
scripts/
  check-gemini-key.mjs           diagnóstico de la clave contra la API
```

`next.config.ts` aplica los ficheros `.env*` del proyecto con prioridad sobre las
variables heredadas del proceso (ver «Depurar la clave de Gemini»).

## Comandos

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run start      # sirve el build
npm run typecheck  # tsc --noEmit
npm run check:key  # comprueba la clave y lista los modelos de imagen disponibles
```

## Depurar la clave de Gemini

`@next/env` **no sobrescribe** las variables que ya existen en `process.env`. Si
alguna vez exportaste una `GEMINI_API_KEY` en la terminal (o la inyectaste en
`launch.json` / en el panel de VS Code), esa variable gana a la de `.env.local`
y el servidor acaba enviando una clave que Google rechaza con
`400 API key not valid` — aunque la del fichero sea perfecta.

Por eso `next.config.ts` aplica los ficheros del proyecto **después** del
entorno y avisa por consola:

```
⚠️  GEMINI_API_KEY: se ignora el valor del entorno (dummy-key-…inal) y se usa el de .env.local (AQ.Ab8RN6K…CGkQ).
```

Cada generación imprime además, en la terminal del servidor, la clave
enmascarada, su longitud y la URL final llamada:

```
🔑 CLAVE LEÍDA: AQ.Ab8RN6K…CGkQ (origen: GEMINI_API_KEY)
🔑 LONGITUD: 53
🔑 URL FINAL: https://generativelanguage.googleapis.com/v1beta/models/gemini-nano-banana-2.1:generateContent?key=AQ.Ab8RN6K…CGkQ
```

Comprobaciones rápidas:

| Síntoma | Causa probable |
| ------- | -------------- |
| La longitud no coincide con la clave de AI Studio | Se está leyendo otra variable (revisa el `⚠️` del arranque) |
| Longitud correcta pero `400 API key not valid` | Clave revocada, de otro proyecto o con caracteres de más (comillas, saltos de línea) |
| `403 PERMISSION_DENIED` | La Generative Language API no está habilitada en ese proyecto |
| `404` con todos los modelos | Sin acceso a la generación de imágenes en esa clave |

`npm run check:key` hace la prueba real contra la API sin gastar generaciones:
valida la clave, cuenta los modelos visibles y marca con ✅/❌ la cadena de
respaldo del simulador.

## Despliegue

`/simulador` es dinámico (`force-dynamic`) porque el acceso depende de las
variables de entorno de cada entorno. En producción define siempre
`GEMINI_API_KEY` y `MOCKUP_PASSWORD`; sin la segunda el simulador queda
bloqueado y la API responde `401`.

La generación puede tardar entre 20 y 60 s. En Vercel, la ruta declara
`maxDuration = 60`, el máximo del plan Hobby; en planes superiores puedes
subirlo editando `app/api/generate-mockup/route.ts`.
