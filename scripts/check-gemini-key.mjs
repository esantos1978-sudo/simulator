#!/usr/bin/env node
/**
 * Comprueba la GEMINI_API_KEY que ve el servidor y lista los modelos de imagen
 * disponibles para esa clave.
 *
 *   npm run check:key
 *
 * Da prioridad a los ficheros del proyecto (.env.local) igual que el servidor,
 * así que sirve para detectar una variable exportada en la terminal que tape la
 * clave buena.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const FILES = ['.env', '.env.local', '.env.development', '.env.development.local']
const CANDIDATES = [
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
]

function parseEnvFile(contents) {
  const values = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    } else {
      const comment = value.indexOf(' #')
      if (comment !== -1) value = value.slice(0, comment).trim()
    }
    values[match[1]] = value.replace(/\\n/g, '\n')
  }
  return values
}

function mask(value) {
  return value.length <= 14 ? '••••' : `${value.slice(0, 10)}…${value.slice(-4)}`
}

function readFromFiles() {
  const merged = {}
  const sources = {}
  for (const file of FILES) {
    const path = join(process.cwd(), file)
    if (!existsSync(path)) continue
    const values = parseEnvFile(readFileSync(path, 'utf8'))
    for (const [key, value] of Object.entries(values)) {
      if (value.length === 0) continue
      merged[key] = value
      sources[key] = file
    }
  }
  return { merged, sources }
}

const { merged, sources } = readFromFiles()
const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const fileKey = merged.GEMINI_API_KEY || merged.GOOGLE_API_KEY || ''
const raw = fileKey || envKey
const origin = fileKey
  ? sources.GEMINI_API_KEY || sources.GOOGLE_API_KEY
  : envKey
    ? 'entorno del proceso'
    : 'ninguno'

if (!raw) {
  console.error('❌ No hay GEMINI_API_KEY ni en .env.local ni en el entorno.')
  process.exit(1)
}

const key = raw
  .replace(/^(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*/i, '')
  .replace(/^['"]+|['"]+$/g, '')
  .replace(/\s+/g, '')

console.log(`🔑 Origen de la clave: ${origin}`)
console.log(`🔑 Clave: ${mask(key)} | longitud: ${key.length}`)

if (envKey && fileKey) {
  const envClean = envKey.replace(/\s+/g, '')
  if (envClean !== key) {
    console.log(
      `⚠️  Hay una GEMINI_API_KEY en el entorno del proceso (${mask(envClean)}) distinta de la del fichero.`,
    )
    console.log('    El servidor usa la del fichero; otras herramientas de tu terminal usarán la otra.')
  }
}

if (!/^AIza[0-9A-Za-z_-]{30,}$/.test(key) && !/^AQ\.[0-9A-Za-z._-]{20,}$/.test(key)) {
  console.log('⚠️  El formato no es el habitual de Google AI Studio (AIza… o AQ.…).')
}

const response = await fetch(
  `${API_BASE}/models?pageSize=200&key=${encodeURIComponent(key)}`,
)

if (!response.ok) {
  const detail = await response.text()
  console.error(`❌ Gemini rechazó la clave: HTTP ${response.status}`)
  console.error(detail.slice(0, 600))
  if (/api key not valid/i.test(detail)) {
    console.error('\nPistas: copiaste la clave incompleta, es de otro servicio o está revocada.')
  }
  process.exit(1)
}

const body = await response.json()
const models = Array.isArray(body.models) ? body.models : []
const imageModels = models
  .filter((model) => /image|nano-banana/i.test(model.name))
  .filter((model) =>
    (model.supportedGenerationMethods ?? []).includes('generateContent'),
  )
  .map((model) => model.name.replace(/^models\//, ''))

console.log(`✅ Clave válida: ${models.length} modelos visibles.`)
console.log(`🖼️  Modelos de imagen disponibles (${imageModels.length}):`)
for (const name of imageModels) console.log(`   • ${name}`)

console.log('\nCadena de respaldo del simulador:')
for (const name of CANDIDATES) {
  console.log(`   ${imageModels.includes(name) ? '✅' : '❌'} ${name}`)
}
