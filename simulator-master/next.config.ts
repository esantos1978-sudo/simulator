import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NextConfig } from 'next'

/**
 * `@next/env` NO sobrescribe las variables que ya existen en `process.env`, así
 * que una `GEMINI_API_KEY=dummy-key-…` exportada en la terminal (o inyectada por
 * el depurador de VS Code) gana a la de `.env.local` sin avisar, y el servidor
 * acaba enviando una clave que Google rechaza con «API key not valid».
 *
 * Aquí invertimos esa prioridad: los ficheros del proyecto mandan y, si tapan
 * una variable del entorno, lo decimos por consola con la clave enmascarada.
 */
const SKIP_KEYS = new Set(['NODE_ENV'])

function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {}

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue

    const [, key, rawValue] = match
    let value = rawValue.trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    } else {
      const commentIndex = value.indexOf(' #')
      if (commentIndex !== -1) value = value.slice(0, commentIndex).trim()
    }

    values[key] = value.replace(/\\n/g, '\n')
  }

  return values
}

function maskSecret(value: string): string {
  return value.length <= 14 ? '••••' : `${value.slice(0, 10)}…${value.slice(-4)}`
}

function applyProjectEnv(): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  // Mismo orden de precedencia que Next: el último fichero que exista manda.
  const files = ['.env', '.env.local', `.env.${nodeEnv}`, `.env.${nodeEnv}.local`]
  const applied: string[] = []

  for (const file of files) {
    const path = join(process.cwd(), file)
    if (!existsSync(path)) continue

    let values: Record<string, string>
    try {
      values = parseEnvFile(readFileSync(path, 'utf8'))
    } catch {
      continue
    }

    applied.push(file)

    for (const [key, value] of Object.entries(values)) {
      if (SKIP_KEYS.has(key) || value.length === 0) continue

      const current = process.env[key]
      if (current !== undefined && current !== value) {
        console.warn(
          `⚠️  ${key}: se ignora el valor del entorno (${maskSecret(current)}) y se usa el de ${file} (${maskSecret(value)}).`,
        )
      }

      process.env[key] = value
    }
  }

  if (applied.length > 0) {
    console.log(`🔧 Variables de entorno del proyecto aplicadas: ${applied.join(', ')}`)
  }
}

applyProjectEnv()

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig

