import type { Metadata } from 'next'
import Link from 'next/link'
import { resolveGeminiModels } from '@/lib/mockup/gemini'
import { SimulatorForm, type SimulatorAccess } from './simulator-form'

export const metadata: Metadata = {
  title: 'Simulador de mockups',
  description: 'Generador privado de mockups de camisetas de PATIO.',
}

// El acceso depende de variables de entorno: se resuelve en cada petición.
export const dynamic = 'force-dynamic'

function resolveAccess(): SimulatorAccess {
  if (process.env.NODE_ENV === 'development') return 'open'
  return process.env.MOCKUP_PASSWORD?.trim() ? 'password' : 'locked'
}

export default function SimuladorPage() {
  const models = resolveGeminiModels()

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <Link
            href="/"
            className="text-sm font-medium tracking-[0.42em] transition-opacity hover:opacity-60"
          >
            PATIO
          </Link>
          <h1 className="mt-4 text-2xl font-medium tracking-tight sm:text-3xl">
            Simulador de mockups
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-soft">
            Elige la prenda y las posiciones, sube el arte y genera la fotografía
            de producto con Gemini.
          </p>
        </div>
        <p className="patio-label">Uso interno · no indexar</p>
      </header>

      <SimulatorForm access={resolveAccess()} />

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="patio-label">PATIO · Estudio de producto</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-line-strong">
          {models.join(' · ')}
        </p>
      </footer>
    </main>
  )
}
